# 推测解码（Speculative Decoding）——草稿、验证、重复

> 自回归解码是串行的。每个 token 都等待前一个 token。推测解码打破了这种链条：一个廉价模型草稿生成 N 个 token，昂贵模型在一次前向传播中验证所有 N 个 token。当草稿正确时，你只需为生成了 N 个 token 支付一次大型前向传播的代价。

**类型：** 构建  
**语言：** Python  
**前置知识：** 阶段7·07（GPT 因果语言模型），阶段7·12（KV 缓存与 Flash Attention）  
**时长：** ~60 分钟

## 问题

一个 70B 的大语言模型（LLM）在 H100 上采样一个 token 大约需要 30 毫秒。一个 3B 的草稿模型大约需要 3 毫秒。如果我们让 3B 模型提前草稿 5 个 token，然后运行一次 70B 模型来验证所有 5 个 token，那么对于最多 5 个被接受的 token，总时间为 `5×3 + 30 = 45 毫秒`——而直线生成则需要 `5×30 = 150 毫秒`。这就是推测解码（Speculative Decoding）的全部核心理念：用少量的额外 GPU 内存（草稿模型）换取 2–4 倍更低的解码延迟。

这个技巧必须保持分布不变。由 Leviathan 等人（2023）以及 Chen 等人同时提出的推测采样（Speculative Sampling），保证了输出序列与大型模型自行生成的序列**同分布**。没有质量折衷。只是更快。

2026 年的推理中，有四类草稿-验证器对占据主导地位：

1. **标准推测（Vanilla Speculative, Leviathan 2023）。** 独立的草稿模型（例如 Llama 3 1B）+ 验证器（例如 Llama 3 70B）。
2. **Medusa（Cai 2024）。** 验证器上的多个解码头并行预测位置 `t+1..t+k`。无需独立的草稿模型。
3. **EAGLE 系列（Li 2024, 2025）。** 轻量级草稿模型，复用验证器的隐藏状态；接受率高于标准推测；通常快 3–4 倍。
4. **前瞻解码（Lookahead Decoding, Fu 2024）。** 雅可比迭代；完全不需要草稿模型。自我推测。小众但无依赖。

到 2026 年，每个生产推理栈都默认集成了推测解码。vLLM、TensorRT-LLM、SGLang 和 llama.cpp 都至少支持标准推测 + EAGLE-2。

## 概念

### 核心算法

给定一个验证器 `M_q` 和一个更廉价的草稿模型 `M_p`：

1. 设 `x_1..x_k` 是已解码的前缀。
2. **草稿阶段**：使用 `M_p` 自回归地提出 `d_{k+1}, d_{k+2}, ..., d_{k+N}`，并附带草稿概率 `p_1..p_N`。
3. **并行验证**：对 `x_1..x_k, d_{k+1}, ..., d_{k+N}` 运行一次 `M_q`，得到位置 `k+1..k+N+1` 的验证器概率 `q_1..q_{N+1}`。
4. **从左到右接受/拒绝每个草稿 token**：对于每个 `i`，以概率 `min(1, q_i(d_i) / p_i(d_i))` 接受。
5. 在位置 `j` 首次拒绝时：从归一化的“残差”分布 `(q_j - p_j)_+` 中采样 `t_j`。所有 `j` 之后的草稿都被丢弃。
6. 如果所有 N 个都被接受：从 `q_{N+1}` 中采样一个额外的 token `t_{N+1}`（免费的奖励 token）。

残差分布的技巧是关键的数学洞察，它使得输出分布与 `M_q` 从头采样时的分布完全相同。

### 决定加速比的因素

令 `α` = 每个草稿 token 的预期接受率。令 `c` = 草稿模型与验证器的成本比。每一步：

- 朴素生成每个 token 调用一次大型模型。
- 推测生成每 `(1 - α^{N+1}) / (1 - α) ≈ 1/(1-α)` 个 token 调用一次大型模型，当 `α` 较高时。

典型经验法则：`α = 0.75`，`N = 5` 时，大型模型调用次数减少约 3 倍。草稿成本为廉价的 5 倍。总墙钟时间下降约 2.5 倍。

**α 取决于：**

- 草稿模型与验证器的近似程度。相同的模型家族/相同的训练数据会显著提高 α。
- 解码策略。贪心草稿配合贪心验证器：α 较高。温度采样：更难匹配；接受率下降。
- 任务类型。代码和结构化输出接受率更高（可预测）；自由形式的创意写作接受率较低。

### Medusa——无需草稿模型的草稿

Medusa 用验证器上的额外输出头取代了草稿模型。在位置 `t` 处：

```
共享主干 → 隐藏状态 h_t
    ├── 头_0: 预测 t+1 位置的 token（标准 LM 头）
    ├── 头_1: 预测 t+2 位置的 token
    ├── 头_2: 预测 t+3 位置的 token
    ├── 头_3: 预测 t+4 位置的 token
```

每个头输出自己的 logits。推理时，从每个头采样得到一个候选序列，然后使用树注意力（Tree-Attention）方案一次性验证所有候选延续，只需一次前向传播。

优点：无需第二个模型。缺点：增加了可训练参数；需要监督微调阶段（约 10 亿 token）；接受率略低于使用良好草稿模型的标准推测。

### EAGLE——通过复用隐藏状态实现更好的草稿

EAGLE-1/2/3（Li 等人，2024–2025）将草稿模型设计成一个极小的 Transformer（通常只有一层），它接收验证器最后一层的隐藏状态。由于草稿模型看到了验证器的特征表示，其预测与验证器的输出分布高度相关。接受率从 ~0.6（标准推测）上升到 0.85 以上。

EAGLE-3（2025）增加了候选延续的树搜索。vLLM 和 SGLang 将 EAGLE-2/3 作为 Llama 3/4 和 Qwen 3 的默认推测路径。

### KV 缓存的舞蹈

验证阶段在一次前向传播中向验证器提供 N 个草稿 token。这将验证器的 KV 缓存扩展了 N 个条目。如果某些草稿被拒绝，你必须将缓存回滚到已接受前缀的长度。

生产实现（vLLM 的 `--speculative-model`，TensorRT-LLM 的 LookaheadDecoder）使用临时 KV 缓冲区来处理这个问题。先写入，接受后提交。这在概念上并不难，但需要精细处理。

## 构建

参见 `code/main.py`。我们实现核心的推测采样算法（拒绝步骤 + 残差分布），其中：

- “大模型”是一个基于手动编码分布的确定性 softmax（这样我们可以用数学方法验证接受率）。
- “草稿模型”是大模型的扰动版本。
- 一个接受/拒绝循环，产生与直接采样相同的边际分布。

### 步骤 1：拒绝步骤

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u` 是一个均匀随机数。`q_prob` 是验证器对草稿 token 的概率。`p_prob` 是草稿模型的概率。Leviathan 定理指出，这个伯努利决策，随后在拒绝时从残差分布中采样，正好保持验证器的分布不变。

### 步骤 2：残差分布

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

逐元素从 `q` 中减去 `p`，将负值钳制为零，重新归一化。在任何拒绝时从中采样。

### 步骤 3：一次推测步骤

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

五个被接受 → 一个奖励 → 一次验证器调用产生六个 token。

### 步骤 4：测量接受率

在不同的草稿质量水平下运行 10,000 次推测步骤。绘制接受率与草稿模型和验证器分布之间的 KL 散度图。你应该会看到一个清晰的单调关系。

### 步骤 5：验证分布等价性

经验上：推测循环产生的 token 直方图应与直接从验证器采样产生的直方图匹配。这是 Leviathan 定理的实践。卡方检验确认在采样误差范围内是一致的。

## 使用

生产环境：

```bash
# vLLM 搭配 EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model /models/llama-3.1-eagle-70b \
    --speculative-draft-tensor-parallel-size 1 \
    --num-speculative-tokens 5

# vLLM 搭配标准草稿模型
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model meta-llama/Llama-3.2-1B-Instruct \
    --num-speculative-tokens 5
```

截至 2026 年中，TensorRT-LLM 拥有最快的 Medusa 路径。`faster-whisper` 使用小型草稿模型为 Whisper-large 封装了推测解码。

**选择草稿模型：**

| 策略 | 何时选用 | 加速比 |
|------|----------|--------|
| 标准草稿模型（1B/3B Llama 系列） | 快速原型，无需训练 | 1.8–2.3× |
| Medusa 头 | 可以对验证器进行微调 | 2–3× |
| EAGLE-2 / 3 | 生产环境，追求最大速度 | 3–4× |
| 前瞻解码 | 无草稿模型，无需训练，无额外参数 | 1.3–1.6× |

**何时不使用推测解码：**

- 单序列生成长度为 1–5 个 token。开销占主导。
- 极度创意/高温度采样（α 下降）。
- 内存受限的部署（草稿模型增加显存消耗）。

## 部署

参见 `outputs/skill-spec-decode-picker.md`。该技能文件为一个新的推理工作负载选择推测解码策略（标准 / Medusa / EAGLE / 前瞻解码）和调优参数（N，草稿温度）。

## 练习

1. **简单。** 运行 `code/main.py`。在 50,000 个 token 上，确认推测 token 分布与验证器的直接采样分布匹配，卡方检验 p > 0.05。
2. **中等。** 对于 `α = 0.5, 0.7, 0.85`，绘制加速比（token 数 / 大模型前向次数）作为 `N` 的函数。找出每个 α 对应的最优 `N`。（提示：每次验证调用期望的 token 数 = `(1 - α^{N+1}) / (1 - α)`。）
3. **困难。** 实现一个小型 Medusa：将第 14 课中的顶层 GPT 模型作为基础，添加 3 个额外的 LM 头，分别预测位置 t+2, t+3, t+4。在 tinyshakespeare 上使用联合多头损失进行训练。与通过截断同一模型得到的标准草稿模型比较接受率。
4. **困难。** 实现回滚：从一个 10 token 前缀的 KV 缓存开始，输入 5 个草稿 token，模拟在位置 3 拒绝。验证下一次迭代时缓存读取正确匹配“前缀 + 前 2 个已接受的草稿”。

## 关键术语

| 术语 | 人们通常说 | 实际含义 |
|------|-----------|---------|
| 草稿模型（Draft model） | “便宜的那个” | 一个较小的模型，用于提出候选 token；通常比验证器便宜 10–50 倍。 |
| 验证器（Verifier） | “大的那个” | 目标模型，其分布被保留；每个推测步骤运行一次。 |
| 接受率（Acceptance rate, α） | “草稿正确的频率” | 每个 token 被验证器接受的概率。典型值为 0.7–0.9。 |
| 残差分布（Residual distribution） | “拒绝时的回退” | 归一化的 `(q - p)_+`；在拒绝时从中采样以保持验证器的分布。 |
| 奖励 token（Bonus token） | “免费的” | 当所有 N 个草稿都被接受时，从验证器的下一步分布中再采样一个。 |
| Medusa | “无草稿推测” | 验证器上的多个 LM 头并行预测位置 t+1..t+k。 |
| EAGLE | “隐藏状态草稿” | 微型 Transformer 草稿，以验证器最后一层的隐藏状态为条件。 |
| 前瞻解码（Lookahead decoding） | “雅可比迭代” | 使用不动点迭代的自我推测；无需草稿模型。 |
| 树注意力（Tree attention） | “一次验证多个候选” | 分支验证，同时考虑多个草稿延续。 |
| KV 回滚（KV rollback） | “撤销被拒绝的草稿” | 临时 KV 缓冲区；接受时提交，拒绝时丢弃。 |

## 延伸阅读

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — 核心算法与等价性定理。
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) — 同期引入；清晰的伯努利拒绝证明。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — Medusa 论文；树注意力验证。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — EAGLE-1；隐藏状态条件草稿。
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) — EAGLE-2；动态树深度。
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) — EAGLE-3。
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) — 前瞻解码，无草稿方法。
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) — 规范性的生产参考，包含所有四种策略的实现。
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) — EAGLE-1/2