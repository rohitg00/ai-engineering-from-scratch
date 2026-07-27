# Speculative Decoding — 起草、验证、重复

> 自回归解码是串行的。每个 token 等待前一个。Speculative decoding 打破了链条：一个廉价模型起草 N 个 token，昂贵模型在一次前向传播中验证所有 N 个。当起草正确时，你为 N 次生成支付一次大模型前向传播。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 分钟

## 问题

一个 70B LLM 采样一个 token 在 H100 上约需 30 ms。一个 3B draft 模型约需 3 ms。如果我们让 3B 起草 5 个 token，然后运行 70B *一次*来验证所有 5 个，总计为 `5×3 + 30 = 45 ms` 用于最多 5 个被接受的 token——相比于直线生成的 `5×30 = 150 ms`。这就是 speculative decoding 的全部推销：用少量额外的 GPU 内存（draft 模型）换取 2–4× 更低的解码延迟。

这个技巧必须保持分布。Speculative sampling，由 Leviathan 等人（2023）和 Chen 等人同时引入，保证了输出序列与大模型自己产生的输出**分布相同**。没有质量折衷。只是更快。

支配 2026 年推理的四个 draft-verifier 家族：

1. **Vanilla speculative（Leviathan 2023）。** 独立的 draft 模型（如 Llama 3 1B）+ verifier（如 Llama 3 70B）。
2. **Medusa（Cai 2024）。** verifier 上的多个解码头并行预测位置 `t+1..t+k`。没有独立的 draft 模型。
3. **EAGLE 家族（Li 2024, 2025）。** 轻量级 draft，重用 verifier 的隐藏状态；接受率比 vanilla 更接近；典型 3–4×。
4. **Lookahead decoding（Fu 2024）。** Jacobi 迭代；根本不需要 draft 模型。自我推测。小众但无依赖。

2026 年的每个生产推理堆栈默认都提供 speculative decoding。vLLM、TensorRT-LLM、SGLang 和 llama.cpp 都至少支持 vanilla + EAGLE-2。

## 概念

### 核心算法

给定 verifier `M_q` 和更便宜的 draft `M_p`：

1. 令 `x_1..x_k` 为已解码的前缀。
2. **Draft**：使用 `M_p` 自回归地提出 `d_{k+1}, d_{k+2}, ..., d_{k+N}`，附带 draft 概率 `p_1..p_N`。
3. **并行验证**：在 `x_1..x_k, d_{k+1}, ..., d_{k+N}` 上运行一次 `M_q`，获取位置 `k+1..k+N+1` 的 verifier 概率 `q_1..q_{N+1}`。
4. **从左到右接受/拒绝每个 draft token**：对每个 `i`，以概率 `min(1, q_i(d_i) / p_i(d_i))` 接受。
5. 在位置 `j` 首次拒绝时：从归一化的"残差"分布 `(q_j - p_j)_+` 中采样 `t_j`。`j` 之后的所有 drafts 被丢弃。
6. 在接受所有 `N` 个时：从 `q_{N+1}` 中采样一个额外 token `t_{N+1}`（免费奖励 token）。

残差分布技巧是数学上的洞察，它保持了输出分布与 `M_q` 从头采样完全相同。

### 什么决定加速

令 `α` = 每个 draft token 的期望接受率。令 `c` = draft 与 verifier 的成本比。每步：

- 天真的生成每次大模型调用产生 1 个 token。
- Speculative 每次大模型调用产生 `(1 - α^{N+1}) / (1 - α) ≈ 1/(1-α)` 个 token（当 `α` 高时）。

在 `α = 0.75` 和 `N = 5` 时的典型经验法则：大模型调用减少 3×。Draft 成本为 5× 便宜。总墙钟下降约 2.5×。

**`α` 取决于：**

- Draft 近似 verifier 的程度。同族 / 相同训练数据显著提升 α。
- 解码策略。Greedy draft 对 greedy verifier：α 高。Temperature 采样：更难匹配；接受率下降。
- 任务类型。代码和结构化输出接受更多（可预测的）；自由形式创意写作接受较少。

### Medusa — 无需 draft 模型的起草

Medusa 用 verifier 上的额外输出头替换 draft 模型。在位置 `t`：

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

每个头输出自己的 logits。推理时你从每个头采样获取候选序列，然后使用树注意力方案一次前向传播验证，该方案同时考虑所有候选延续。

优点：没有第二个模型。缺点：增加了可训练参数；需要监督微调阶段（约 1B token）；接受率略低于带有良好 draft 的 vanilla speculative。

### EAGLE — 通过重用隐藏状态实现更好的起草

EAGLE-1/2/3（Li et al., 2024–2025）使 draft 模型成为一个微小的 transformer（通常 1 层），接收 verifier 最后一层的隐藏状态。因为 draft 看到 verifier 的特征表示，其预测与 verifier 的输出分布高度相关。接受率从约 0.6（vanilla）攀升到 0.85+。

EAGLE-3（2025）增加了对候选延续的树搜索。vLLM 和 SGLang 将 EAGLE-2/3 作为 Llama 3/4 和 Qwen 3 的默认 spec 路径。

### KV cache 之舞

验证在一次前向传播中将 `N` 个 draft token 送入 verifier。这使 verifier 的 KV cache 扩展了 `N` 个条目。如果一些 drafts 被拒绝，你必须将缓存回滚到已接受的前缀长度。

生产实现（vLLM 的 `--speculative-model`、TensorRT-LLM 的 LookaheadDecoder）使用 scratch KV 缓冲区处理这个问题。先写，接受时提交。概念上不难，但很繁琐。

## 动手构建

参见 `code/main.py`。我们实现核心的 speculative-sampling 算法（拒绝步骤 + 残差分布），使用：

- 一个"大模型"，它对硬编码分布进行确定性 softmax（这样我们可以解析地验证接受数学）。
- 一个"draft 模型"，它是大模型的扰动版本。
- 一个接受/拒绝循环，产生与直接采样相同的边际分布。

### 步骤 1：拒绝步骤

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u` 是一个均匀随机数。`q_prob` 是 verifier 对起草 token 的概率。`p_prob` 是 draft 模型的概率。Leviathan 定理表明，这个 Bernoulli 决策，随后在拒绝时从残差中采样，精确地保持了 verifier 的分布。

### 步骤 2：残差分布

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

逐元素从 `q` 中减去 `p`，将负值钳位为零，重新归一化。在任何拒绝时从此采样。

### 步骤 3：一个 speculative 步骤

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

五个接受 → 一个奖励 → 一次 verifier 传递中产生六个 token。

### 步骤 4：测量接受率

在变化 draft 质量水平下运行 10,000 个 speculative 步骤。绘制接受率 vs draft 和 verifier 分布之间的 KL 散度。你应该看到清晰的单调关系。

### 步骤 5：验证分布等价性

经验性地：speculative 循环产生的 token 直方图应与直接从 verifier 采样产生的直方图匹配。这是 Leviathan 定理的实践。卡方检验确认在采样误差范围内。

## 实际应用

生产环境：

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

截至 2026 年中，TensorRT-LLM 拥有最快的 Medusa 路径。`faster-whisper` 为 Whisper-large 封装了带有小型 draft 的 speculative decoding。

**选择 draft：**

| 策略 | 何时选择 | 加速 |
|----------|--------------|---------|
| Vanilla draft（1B/3B Llama 家族） | 快速原型，无训练 | 1.8–2.3× |
| Medusa heads | 你可以微调 verifier | 2–3× |
| EAGLE-2 / 3 | 生产，最大速度 | 3–4× |
| Lookahead | 无 draft，无训练，无额外参数 | 1.3–1.6× |

**何时不进行 spec-decode：**

- 1–5 个 token 的单序列生成。开销占主导。
- 极度创意 / 高温采样（α 下降）。
- 内存受限的部署（draft 模型增加 VRAM）。

## 交付

参见 `outputs/skill-spec-decode-picker.md`。该 skill 为新的推理工作负载选择 speculative decoding 策略（vanilla / Medusa / EAGLE / lookahead）和调优参数（N、draft temperature）。

## 练习

1. **简单。** 运行 `code/main.py`。确认 speculative token 分布在 50,000 个 token 上，在卡方 p > 0.05 内与 verifier 的直接采样分布匹配。
2. **中等。** 绘制对于 `α = 0.5, 0.7, 0.85`，作为 `N` 函数的加速（每次大模型前向的 token 数）。确定每个 α 的最优 `N`。（提示：每次验证调用的期望 token 数 = `(1 - α^{N+1}) / (1 - α)`。）
3. **困难。** 实现一个微型 Medusa：从第 14 课的收官 GPT 出发，添加 3 个额外的 LM 头，预测位置 t+2、t+3、t+4。在 tinyshakespeare 上使用联合多头损失进行训练。与通过截断相同模型制作的 vanilla draft 比较接受率。
4. **困难。** 实现回滚：从一个 10-token 前缀 KV cache 开始，输入 5 个 draft token，模拟位置 3 的拒绝。验证你的缓存读取在下一次迭代中正确地对应"前缀 + 前 2 个接受的 drafts"。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|-----------------|-----------------------|
| Draft model | "便宜的那个" | 提出候选 token 的较小模型；通常比 verifier 便宜 10–50×。 |
| Verifier | "大的那个" | 目标模型，我们保持其分布；每个 speculative 步骤运行一次。 |
| Acceptance rate (α) | "draft 正确的频率" | Verifier 接受 draft 的每 token 概率。典型 0.7–0.9。 |
| Residual distribution | "拒绝后的后备" | `(q - p)_+` 归一化；在拒绝时从此采样以保持 verifier 的分布。 |
| Bonus token | "免费的那个" | 当所有 N 个 drafts 被接受时，再从 verifier 的下一步分布中采样一个。 |
| Medusa | "无需 draft 的 speculative" | Verifier 上的多个 LM 头并行预测位置 t+1..t+k。 |
| EAGLE | "隐藏状态 draft" | 以 verifier 最后一层隐藏状态为条件的微型 transformer draft。 |
| Lookahead decoding | "Jacobi 迭代" | 使用不动点迭代的自我推测；无需 draft 模型。 |
| Tree attention | "一次验证多个候选" | 分支验证，同时考虑多个 draft 延续。 |
| KV rollback | "撤销被拒的 drafts" | Scratch KV 缓冲区；接受时提交，拒绝时丢弃。 |

## 延伸阅读

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — 核心算法和等价性定理。
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) — 同期引入；干净的 Bernoulli 拒绝证明。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — Medusa 论文；树注意力验证。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — EAGLE-1；隐藏状态条件的 draft。
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) — EAGLE-2；动态树深度。
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) — EAGLE-3。
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) — lookahead，无 draft 方法。
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) — 典范的生产参考，所有四种策略已接线。
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) — EAGLE-1/2/3 的参考代码。
