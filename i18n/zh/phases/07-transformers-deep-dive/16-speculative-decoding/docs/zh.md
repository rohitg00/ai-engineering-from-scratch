# 投机解码 — 起草、验证、重复

> 自回归解码是串行的。每个 token 都要等待前一个。投机解码打破了这个链条：用一个廉价模型起草 N 个 token，再让昂贵模型在一次前向传播中验证全部 N 个。当草稿正确时，你用一次大模型前向就换来了 N 个生成结果。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 07 (GPT Causal LM)、Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 分钟

## 问题所在

一个 70B 的 LLM 在 H100 上采样一个 token 大约需要 30 ms。而一个 3B 的草稿模型只需要约 3 ms。如果我们让 3B 模型提前起草 5 个 token，然后让 70B 模型运行*一次*来验证这 5 个，总耗时为 `5×3 + 30 = 45 ms`，最多可接受 5 个 token —— 相比之下，直线生成需要 `5×30 = 150 ms`。这就是投机解码的完整卖点：用少量额外的 GPU 显存（草稿模型）换取 2–4× 更低的解码延迟。

这个技巧必须保持分布不变。投机采样（speculative sampling）由 Leviathan 等人（2023）以及 Chen 等人同期提出，它保证输出序列与大型模型独立生成时的分布**完全相同**。没有质量上的折中，只是更快。

2026 年的推理领域由四类草稿-验证器组合主导：

1. **原生投机（Leviathan 2023）。** 独立的草稿模型（如 Llama 3 1B）+ 验证器（如 Llama 3 70B）。
2. **Medusa（Cai 2024）。** 在验证器上使用多个解码头并行预测位置 `t+1..t+k`。无需单独的草稿模型。
3. **EAGLE 系列（Li 2024、2025）。** 轻量级草稿模型复用验证器的隐藏状态；接受率高于原生方法；典型加速 3–4×。
4. **前瞻解码（Fu 2024）。** 基于 Jacobi 迭代；完全不需要草稿模型。自我投机。小众但无额外依赖。

2026 年的每个生产级推理栈默认都内置投机解码。vLLM、TensorRT-LLM、SGLang 和 llama.cpp 至少都支持原生方法 + EAGLE-2。

## 核心概念

### 核心算法

给定一个验证器 `M_q` 和一个更廉价的草稿模型 `M_p`：

1. 设 `x_1..x_k` 为已解码的前缀。
2. **起草**：使用 `M_p` 以草稿概率 `p_1..p_N` 自回归地提出 `d_{k+1}, d_{k+2}, ..., d_{k+N}`。
3. **并行验证**：让 `M_q` 对 `x_1..x_k, d_{k+1}, ..., d_{k+N}` 运行一次，得到位置 `k+1..k+N+1` 上的验证器概率 `q_1..q_{N+1}`。
4. **从左到右逐个接受/拒绝草稿 token**：对每个 `i`，以概率 `min(1, q_i(d_i) / p_i(d_i))` 接受。
5. 若在位置 `j` 首次拒绝：从归一化后的“残差”分布 `(q_j - p_j)_+` 中采样 `t_j`。丢弃 `j` 之后的所有草稿。
6. 若全部 `N` 个草稿被接受：从 `q_{N+1}` 中额外采样一个 token `t_{N+1}`（免费赠送的 token）。

残差分布技巧是数学上的关键洞察，它使输出分布与 `M_q` 独立采样时完全一致。

### 决定加速比的因素

设 `α` = 每个草稿 token 的期望接受率。设 `c` = 草稿与验证器的成本比。每步来看：

- 朴素生成每个 token 需要一次大模型调用。
- 当 `α` 较高时，投机生成每 `(1 - α^{N+1}) / (1 - α) ≈ 1/(1-α)` 个 token 才需要一次大模型调用。

在 `α = 0.75` 和 `N = 5` 条件下的典型经验法则：大模型调用次数减少 3×。草稿成本是廉价成本的 5 倍。总耗时下降约 2.5×。

**α 取决于：**

- 草稿对验证器的近似程度。同一家族 / 相同训练数据能显著提高 α。
- 解码策略。贪心草稿对贪心验证器：α 高。温度采样：更难匹配；接受率下降。
- 任务类型。代码和结构化输出的接受率更高（可预测性强）；自由创作的写作接受率更低。

### Medusa — 无需草稿模型的草稿

Medusa 用验证器上的额外输出头取代草稿模型。在位置 `t`：

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

每个头输出自己的 logits。推理时，从每个头采样得到候选序列，然后使用树注意力（tree-attention）方案进行一次前向验证，同时考虑所有候选续写。

优点：无需第二个模型。缺点：增加可训练参数；需要监督微调阶段（约 1B token）；接受率比使用优秀草稿模型的原生投机略低。

### EAGLE — 通过复用隐藏状态获得更好的草稿

EAGLE-1/2/3（Li 等人，2024–2025）将草稿模型做成了一个微型 Transformer（通常 1 层），它接收验证器最后一层的隐藏状态。由于草稿模型能看到验证器的特征表示，其预测与验证器的输出分布高度相关。接受率从约 0.6（原生方法）提升至 0.85 以上。

EAGLE-3（2025）增加了对候选续写的树搜索。vLLM 和 SGLang 将 EAGLE-2/3 作为 Llama 3/4 和 Qwen 3 的默认投机通路。

### KV 缓存的舞蹈

验证过程在一次前向传播中将 `N` 个草稿 token 输入验证器。这会将验证器的 KV 缓存扩展 `N` 个条目。如果部分草稿被拒绝，必须将缓存回滚到已接受前缀的长度。

生产级实现（vLLM 的 `--speculative-model`、TensorRT-LLM 的 LookaheadDecoder）通过临时 KV 缓冲区来处理。先写入，接受后提交。概念上并不难，但实现繁琐。

```figure
draft-verify-tokens
```

## 动手实现

参见 `code/main.py`。我们实现核心的投机采样算法（拒绝步骤 + 残差分布），包含：

- 一个“大模型”，即对手写分布进行确定性 softmax（这样我们可以解析地验证接受数学）。
- 一个“草稿模型”，即对大模型的扰动。
- 一个接受/拒绝循环，其产出与直接采样具有相同的边缘分布。

### 步骤 1：拒绝步骤

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u` 是一个均匀随机数。`q_prob` 是验证器对草稿 token 的概率。`p_prob` 是草稿模型的概率。Leviathan 定理表明：这个伯努利决策，加上拒绝时从残差分布采样，能精确保持验证器的分布。

### 步骤 2：残差分布

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

将 `q` 逐元素减去 `p`，将负值截断为零，重新归一化。任何拒绝发生时都从此分布采样。

### 步骤 3：一次投机步骤

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

接受 5 个 → 赠送 1 个 → 验证器一次前向产出 6 个 token。

### 步骤 4：测量接受率

在不同草稿质量水平下运行 10,000 次投机步骤。绘制接受率与草稿、验证器分布之间 KL 散度的关系图。你应该会看到清晰的单调关系。

### 步骤 5：验证分布等价性

实证检验：投机循环产出的 token 直方图应与直接从验证器采样得到的直方图一致。这就是 Leviathan 定理的实践验证。卡方检验在采样误差范围内予以确认。

## 应用实践

生产级方案：

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model /models/llama-3.1-eagle-70b \
    --speculative-draft-tensor-parallel-size 1 \
    --num-speculative-tokens 5

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-model meta-llama/Llama-3.2-1B-Instruct \
    --num-speculative-tokens 5
```

截至 2026 年年中，TensorRT-LLM 拥有最快的 Medusa 通路。`faster-whisper` 使用小型草稿模型为 Whisper-large 封装了投机解码。

**选择草稿：**

| 策略 | 何时选择 | 加速比 |
|----------|--------------|---------|
| 原生草稿（1B/3B Llama 家族） | 快速原型，无需训练 | 1.8–2.3× |
| Medusa 头 | 可以微调验证器 | 2–3× |
| EAGLE-2 / 3 | 生产环境，追求最高速度 | 3–4× |
| Lookahead | 无草稿、无训练、无额外参数 | 1.3–1.6× |

**何时不使用投机解码：**

- 单序列生成 1–5 个 token。开销占主导。
- 高度创造性 / 高温度采样（α 下降）。
- 显存受限的部署（草稿模型增加显存）。

## 上线部署

参见 `outputs/skill-spec-decode-picker.md`。该技能为新的推理工作负载选择投机解码策略（原生 / Medusa / EAGLE / lookahead）及调优参数（N、草稿温度）。

## 练习

1. **简单。** 运行 `code/main.py`。确认在 50,000 个 token 上，投机 token 分布与验证器的直接采样分布在卡方检验 p > 0.05 下一致。
2. **中等。** 对 `α = 0.5, 0.7, 0.85` 绘制加速比（每次大模型前向产出的 token 数）随 `N` 变化的曲线。为每个 α 找出最优的 `N`。（提示：每次验证调用的期望 token 数 = `(1 - α^{N+1}) / (1 - α)`。）
3. **困难。** 实现一个微型 Medusa：取第 14 课的 GPT 综合项目，添加 3 个额外 LM 头，分别预测位置 t+2、t+3、t+4。在 tinyshakespeare 上用联合多头损失训练。将其接受率与通过截断同一模型得到的原生草稿进行比较。
4. **困难。** 实现回滚：以 10 个 token 的前缀 KV 缓存开始，输入 5 个草稿 token，模拟在位置 3 的拒绝。验证你的缓存读取在下一次迭代中与“前缀 + 前 2 个被接受的草稿”正确匹配。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 草稿模型 | “便宜的那个” | 提出候选 token 的较小模型；通常比验证器便宜 10–50×。 |
| 验证器 | “大的那个” | 我们要保持其分布的目标模型；每次投机步骤运行一次。 |
| 接受率（α） | “草稿有多准” | 验证器接受草稿的单 token 概率。典型值 0.7–0.9。 |
| 残差分布 | “拒绝时的备选” | `(q - p)_+` 归一化后的结果；拒绝时从此采样可保持验证器的分布。 |
| 赠送 token | “免费的那个” | 当全部 N 个草稿被接受时，从验证器的下一步分布再采样一个。 |
| Medusa | “无草稿的投机” | 验证器上的多个 LM 头并行预测位置 t+1..t+k。 |
| EAGLE | “隐藏状态草稿” | 以验证器最后一层隐藏状态为条件的微型 Transformer 草稿。 |
| Lookahead 解码 | “Jacobi 迭代” | 使用不动点迭代的自我投机；无需草稿模型。 |
| 树注意力 | “一次验证多个候选” | 同时考虑多个草稿续写的分支式验证。 |
| KV 回滚 | “撤销被拒绝的草稿” | 临时 KV 缓冲区；接受则提交，拒绝则丢弃。 |

## 延伸阅读

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — 核心算法与等价性定理。
- [Chen 等人 (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) — 同期独立提出；干净的伯努利拒绝证明。
- [Cai 等人 (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — Medusa 论文；树注意力验证。
- [Li 等人 (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — EAGLE-1；基于隐藏状态条件的草稿。
- [Li 等人 (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) — EAGLE-2；动态树深度。
- [Li 等人 (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) — EAGLE-3。
- [Fu 等人 (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) — 前瞻式、无草稿的方法。
- [vLLM 文档 — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) — 集成全部四种策略的权威生产参考。
- [SafeAILab / EAGLE 参考实现](https://github.com/SafeAILab/EAGLE) — EAGLE-1/2/3 的参考代码。