# 16 · 投机解码——草拟、验证、循环

> 自回归解码是串行的。每个 token 都要等待前一个 token。投机解码（speculative decoding）打破了这条链：一个廉价模型草拟 N 个 token，昂贵模型在一次前向传播中一次性验证全部 N 个。当草稿正确时，你只用一次大模型前向传播就换来了 N 个生成结果。

**类型：** 构建
**语言：** Python
**前置：** 阶段 7 · 07（GPT 因果语言模型）、阶段 7 · 12（KV 缓存与 Flash Attention）
**时长：** 约 60 分钟

## 问题所在

一个 70B 大语言模型在 H100 上采样一个 token 大约需要 30 ms。一个 3B 的草稿模型（draft model）大约只需 3 ms。如果让这个 3B 模型向前草拟 5 个 token，然后让 70B 模型*只运行一次*来验证全部 5 个，那么对于最多 5 个被接受的 token，总耗时为 `5×3 + 30 = 45 ms`——而直线式生成则需要 `5×30 = 150 ms`。这就是投机解码的完整卖点：用少量额外的 GPU 显存（草稿模型）换取 2–4 倍更低的解码延迟。

这个技巧必须保持分布不变。投机采样（speculative sampling）由 Leviathan 等人（2023）提出，Chen 等人同期也独立提出，它保证输出序列与大模型独立生成时的分布**完全相同**。没有任何质量上的折中，只是更快。

2026 年的推理领域主要由四类草稿—验证器（draft-verifier）组合主导：

1. **原始投机解码（Leviathan 2023）。** 独立的草稿模型（例如 Llama 3 1B）+ 验证器（verifier，例如 Llama 3 70B）。
2. **Medusa（Cai 2024）。** 在验证器上挂载多个解码头（decoding head），并行预测位置 `t+1..t+k`。无需独立的草稿模型。
3. **EAGLE 系列（Li 2024、2025）。** 轻量级草稿，复用验证器的隐藏状态（hidden state）；接受率比原始方案更接近验证器；通常可达 3–4 倍加速。
4. **前瞻解码（lookahead decoding，Fu 2024）。** Jacobi 迭代；完全不需要草稿模型。自投机（self-speculation）。较为小众，但无依赖。

2026 年所有生产级推理栈都默认搭载投机解码。vLLM、TensorRT-LLM、SGLang 和 llama.cpp 都至少支持原始方案 + EAGLE-2。

## 核心概念

### 核心算法

给定一个验证器 `M_q` 和一个更廉价的草稿模型 `M_p`：

1. 设 `x_1..x_k` 为已经解码出的前缀。
2. **草拟**：用 `M_p` 自回归地提议 `d_{k+1}, d_{k+2}, ..., d_{k+N}`，并得到草稿概率 `p_1..p_N`。
3. **并行验证**：在 `x_1..x_k, d_{k+1}, ..., d_{k+N}` 上运行一次 `M_q`，得到位置 `k+1..k+N+1` 的验证器概率 `q_1..q_{N+1}`。
4. **从左到右逐个接受/拒绝草稿 token**：对每个 `i`，以概率 `min(1, q_i(d_i) / p_i(d_i))` 接受。
5. 在位置 `j` 处首次拒绝时：从归一化后的「残差（residual）」分布 `(q_j - p_j)_+` 中采样 `t_j`。`j` 之后的所有草稿都被丢弃。
6. 若全部 `N` 个均被接受：从 `q_{N+1}` 中额外采样一个 token `t_{N+1}`（免费的奖励 token）。

残差分布这一技巧正是关键的数学洞见，它使得输出分布与 `M_q` 从头独立采样时完全一致。

### 决定加速比的因素

设 `α` = 每个草稿 token 的期望接受率，`c` = 草稿对验证器的成本比。每一步：

- 朴素生成每生成一个 token 就调用一次大模型。
- 当 `α` 较高时，投机解码平均每 `(1 - α^{N+1}) / (1 - α) ≈ 1/(1-α)` 个 token 才调用一次大模型。

在 `α = 0.75` 且 `N = 5` 时的经验法则：大模型调用次数减少约 3 倍。草稿成本便宜 5 倍。总的实际墙钟时间下降约 2.5 倍。

**α 取决于：**

- 草稿对验证器的逼近程度。同系列 / 同训练数据能显著提升 α。
- 解码策略。贪心草稿对贪心验证器：α 高。温度采样：更难匹配，接受率下降。
- 任务类型。代码和结构化输出接受率更高（可预测性强）；自由发挥的创意写作接受率更低。

### Medusa——无草稿模型的草拟

Medusa 用验证器上额外的输出头取代了草稿模型。在位置 `t`：

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

每个头输出自己的 logits。推理时从每个头采样得到一个候选序列，然后用一种树注意力（tree-attention）方案在一次前向传播中验证，该方案会同时考虑所有候选续写。

优点：无需第二个模型。缺点：增加了可训练参数；需要一个监督微调阶段（约 1B token）；接受率比配有优质草稿的原始投机方案略低。

### EAGLE——通过复用隐藏状态获得更好的草稿

EAGLE-1/2/3（Li 等人，2024–2025）让草稿模型变成一个极小的 transformer（通常 1 层），它吸收验证器最后一层的隐藏状态。由于草稿能看到验证器的特征表示，其预测与验证器的输出分布高度相关。接受率从约 0.6（原始方案）攀升到 0.85 以上。

EAGLE-3（2025）增加了对候选续写的树搜索。vLLM 和 SGLang 将 EAGLE-2/3 作为 Llama 3/4 和 Qwen 3 的默认投机路径。

### KV 缓存的腾挪

验证会在一次前向传播中把 `N` 个草稿 token 喂给验证器。这会让验证器的 KV 缓存扩展 `N` 个条目。如果某些草稿被拒绝，你必须把缓存回滚（roll back）到已接受前缀的长度。

生产级实现（vLLM 的 `--speculative-model`、TensorRT-LLM 的 LookaheadDecoder）用临时 KV 缓冲区来处理这件事：先写入，接受后再提交。从概念上讲不难，但实现起来很琐碎。

## 动手构建

参见 `code/main.py`。我们实现核心的投机采样算法（拒绝步骤 + 残差分布），其中包括：

- 一个「大模型」，它是对一个手写分布做确定性 softmax（这样我们就能用解析方法验证接受率的数学正确性）。
- 一个「草稿模型」，它是对大模型的扰动。
- 一个接受 / 拒绝循环，它产生的边缘分布与直接采样相同。

### 第 1 步：拒绝步骤

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u` 是一个均匀随机数。`q_prob` 是验证器对该草稿 token 的概率。`p_prob` 是草稿模型的概率。Leviathan 定理指出：这个伯努利（Bernoulli）决策，加上拒绝时从残差分布采样，能够精确保持验证器的分布。

### 第 2 步：残差分布

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

逐元素地用 `q` 减去 `p`，将负值钳制为零，再重新归一化。任何拒绝发生时都从此分布采样。

### 第 3 步：一次投机步骤

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

接受 5 个 → 1 个奖励 token → 一次验证器传播产出 6 个 token。

### 第 4 步：测量接受率

在不同草稿质量水平下运行 10,000 次投机步骤。绘制接受率与草稿、验证器分布之间 KL 散度（KL divergence）的关系图。你应当看到一条干净的单调关系。

### 第 5 步：验证分布等价性

经验上：投机循环产出的 token 直方图，应当与直接从验证器采样产出的直方图相匹配。这就是 Leviathan 定理在实践中的体现。卡方检验（chi-square test）会在采样误差范围内确认这一点。

## 实际使用

生产环境：

```bash
# vLLM 配合 EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model /models/llama-3.1-eagle-70b \
    --speculative-draft-tensor-parallel-size 1 \
    --num-speculative-tokens 5

# vLLM 配合原始草稿模型
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model meta-llama/Llama-3.2-1B-Instruct \
    --num-speculative-tokens 5
```

截至 2026 年年中，TensorRT-LLM 拥有最快的 Medusa 路径。`faster-whisper` 为 Whisper-large 封装了配合小型草稿的投机解码。

**如何挑选草稿方案：**

| 策略 | 何时选用 | 加速比 |
|----------|--------------|---------|
| 原始草稿（1B/3B Llama 系列） | 快速原型，无需训练 | 1.8–2.3× |
| Medusa 头 | 你能够微调验证器 | 2–3× |
| EAGLE-2 / 3 | 生产环境，追求极致速度 | 3–4× |
| 前瞻解码 | 无草稿、无训练、无额外参数 | 1.3–1.6× |

**何时不该用投机解码：**

- 单序列只生成 1–5 个 token。开销占主导。
- 极度创意 / 高温度采样（α 下降）。
- 显存受限的部署（草稿模型会占用额外 VRAM）。

## 交付落地

参见 `outputs/skill-spec-decode-picker.md`。该技能会为新的推理工作负载挑选一种投机解码策略（原始 / Medusa / EAGLE / 前瞻）以及调优参数（N、草稿温度）。

## 练习

1. **简单。** 运行 `code/main.py`。确认在 50,000 个 token 上，投机产出的 token 分布与验证器直接采样的分布相匹配，卡方检验 p > 0.05。
2. **中等。** 对 `α = 0.5, 0.7, 0.85`，绘制加速比（每次大模型前向传播产出的 token 数）随 `N` 变化的曲线。找出每个 α 对应的最优 `N`。（提示：每次验证调用的期望产出 token 数 = `(1 - α^{N+1}) / (1 - α)`。）
3. **困难。** 实现一个微型 Medusa：取第 14 课的压轴 GPT，添加 3 个额外的 LM 头，分别预测位置 t+2、t+3、t+4。在 tinyshakespeare 上用联合多头损失训练。将其接受率与通过截断同一模型得到的原始草稿做对比。
4. **困难。** 实现回滚：从一个 10-token 前缀的 KV 缓存开始，喂入 5 个草稿 token，模拟在位置 3 处发生拒绝。验证在下一轮迭代时，你的缓存读取结果正确匹配「前缀 + 前 2 个被接受的草稿」。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 草稿模型（Draft model） | “那个便宜的” | 一个更小的模型，用于提议候选 token；通常比验证器便宜 10–50 倍。 |
| 验证器（Verifier） | “那个大的” | 目标模型，我们要保持它的分布；每个投机步骤运行一次。 |
| 接受率（Acceptance rate, α） | “草稿对的频率有多高” | 验证器接受草稿的每 token 概率。典型值 0.7–0.9。 |
| 残差分布（Residual distribution） | “拒绝时的兜底” | 归一化的 `(q - p)_+`；拒绝时从中采样可保持验证器的分布。 |
| 奖励 token（Bonus token） | “那个免费的” | 当全部 N 个草稿都被接受时，从验证器的下一步分布中再采样一个。 |
| Medusa | “无草稿投机” | 验证器上的多个 LM 头并行预测位置 t+1..t+k。 |
| EAGLE | “隐藏状态草稿” | 一个微型 transformer 草稿，以验证器最后一层的隐藏状态为条件。 |
| 前瞻解码（Lookahead decoding） | “Jacobi 迭代” | 使用不动点迭代的自投机；无需草稿模型。 |
| 树注意力（Tree attention） | “一次验证多个候选” | 分支式验证，同时考虑多条草稿续写。 |
| KV 回滚（KV rollback） | “撤销被拒绝的草稿” | 临时 KV 缓冲区；接受时提交，拒绝时丢弃。 |

## 延伸阅读

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) —— 核心算法与等价性定理。
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) —— 同期独立提出；简洁的伯努利拒绝证明。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) —— Medusa 论文；树注意力验证。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) —— EAGLE-1；以隐藏状态为条件的草稿。
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) —— EAGLE-2；动态树深度。
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) —— EAGLE-3。
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) —— 前瞻解码，无草稿方案。
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) —— 权威的生产参考，四种策略均已接入。
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) —— EAGLE-1/2/3 的参考代码。
