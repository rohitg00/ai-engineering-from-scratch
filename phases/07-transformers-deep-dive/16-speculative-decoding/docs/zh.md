# Speculative Decoding（投机解码）——起草、验证、循环

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Autoregressive（自回归）解码是串行的。每个 token 都得等上一个 token。Speculative decoding（投机解码）打破了这条链：一个便宜的模型一次起草 N 个 token，昂贵的模型在一次 forward pass 里验证所有 N 个。当草稿正确时，你只用一次大模型的 forward 就拿到了 N 个生成结果。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## 问题（The Problem）

70B 的 LLM 在 H100 上采样一个 token 大约要 30 ms。3B 的 draft model（草稿模型）只要 3 ms。如果让 3B 先起草未来 5 个 token，再让 70B *只跑一次* 来验证这 5 个，总耗时是 `5×3 + 30 = 45 ms`，最多能拿到 5 个被接受的 token——而直线生成需要 `5×30 = 150 ms`。这就是 speculative decoding 的全部卖点：拿一点点额外的 GPU 显存（draft model）换 2–4× 的解码延迟下降。

这套技巧必须保留分布。Speculative sampling 由 Leviathan 等人（2023）提出，Chen 等人同期独立提出，**保证输出序列与大模型独自生成的分布完全一致**。没有质量牺牲。只是更快。

2026 年的推理栈里，draft-verifier 配对主要有四个家族：

1. **Vanilla speculative（Leviathan 2023）**。独立的 draft model（如 Llama 3 1B）+ verifier（验证器，如 Llama 3 70B）。
2. **Medusa（Cai 2024）**。在 verifier 上加多个解码 head，并行预测 `t+1..t+k` 位置。不需要单独的 draft model。
3. **EAGLE 家族（Li 2024, 2025）**。复用 verifier 隐藏状态的轻量 draft；接受率比 vanilla 更接近 verifier；典型 3–4×。
4. **Lookahead decoding（Fu 2024）**。Jacobi 迭代；完全不需要 draft model。Self-speculation。小众但无依赖。

2026 年所有生产级推理栈都默认开启 speculative decoding。vLLM、TensorRT-LLM、SGLang、llama.cpp 至少都支持 vanilla + EAGLE-2。

## 概念（The Concept）

### 核心算法（The core algorithm）

给定 verifier `M_q` 和更便宜的 draft `M_p`：

1. 设 `x_1..x_k` 为已经解码出的前缀。
2. **Draft（起草）**：用 `M_p` 自回归地提出 `d_{k+1}, d_{k+2}, ..., d_{k+N}`，对应 draft 概率 `p_1..p_N`。
3. **并行验证**：在 `x_1..x_k, d_{k+1}, ..., d_{k+N}` 上跑一次 `M_q`，得到位置 `k+1..k+N+1` 的 verifier 概率 `q_1..q_{N+1}`。
4. **从左到右逐个接受/拒绝草稿 token**：对每个 `i`，以概率 `min(1, q_i(d_i) / p_i(d_i))` 接受。
5. 在位置 `j` 第一次被拒绝时：从「残差」分布 `(q_j - p_j)_+` 归一化后采样 `t_j`。`j` 之后的草稿全部丢弃。
6. 如果 `N` 个全部被接受：再从 `q_{N+1}` 采一个额外的 token `t_{N+1}`（免费奖励 token）。

残差分布这个技巧是关键的数学洞见，正是它保证了输出分布和 `M_q` 从头采样完全一致。

### 决定加速比的因素（What determines speedup）

设 `α` = 每个草稿 token 的期望接受率，`c` = draft 与 verifier 的成本比。每一步：

- 朴素生成每个 token 调用 1 次大模型。
- Speculative 在 `α` 较高时大约每 `(1 - α^{N+1}) / (1 - α) ≈ 1/(1-α)` 个 token 才调用 1 次大模型。

`α = 0.75`、`N = 5` 的经验值：大模型调用次数减少 3×。Draft 成本是 5× 便宜。整体 wall-clock 下降约 2.5×。

**α 取决于：**

- Draft 对 verifier 的近似程度。同家族 / 同训练数据会显著抬高 α。
- 解码策略。Greedy draft 配 greedy verifier：α 高。Temperature 采样：更难匹配；接受率下降。
- 任务类型。代码和结构化输出更容易接受（可预测性强）；自由发挥的创意写作接受率更低。

### Medusa——没有 draft model 的草稿（Medusa — drafts without a draft model）

Medusa 用 verifier 上的多个额外输出 head 替代 draft model。在位置 `t`：

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

每个 head 输出自己的 logits。推理时从每个 head 采样得到一个候选序列，然后用一种 tree-attention 方案在一次 forward pass 里同时验证所有候选续写。

优点：不需要第二个模型。缺点：增加可训练参数；需要一轮有监督 fine-tune（约 1B token）；接受率比配上好 draft 的 vanilla speculative 略低。

### EAGLE——靠复用隐藏状态做出更好的 draft（EAGLE — better draft by reusing hidden states）

EAGLE-1/2/3（Li 等人，2024–2025）把 draft model 设计成一个微型 transformer（通常 1 层），输入是 verifier 最后一层的 hidden states。因为 draft 看到了 verifier 的特征表示，它的预测和 verifier 的输出分布高度相关。接受率从 vanilla 的 ~0.6 拉到 0.85+。

EAGLE-3（2025）在候选续写上加了树搜索。vLLM 和 SGLang 把 EAGLE-2/3 作为 Llama 3/4 和 Qwen 3 的默认 spec 路径。

### KV cache 的腾挪（The KV cache dance）

验证阶段会把 `N` 个草稿 token 一次性喂给 verifier。这会让 verifier 的 KV cache 多出 `N` 项。如果某些草稿被拒绝，你必须把 cache 回滚到被接受的前缀长度。

生产实现（vLLM 的 `--speculative-model`、TensorRT-LLM 的 LookaheadDecoder）用临时 KV 缓冲区处理这件事。先写入，接受时再提交。概念上不难，但很琐碎。

## 动手实现（Build It）

参见 `code/main.py`。我们实现 speculative-sampling 的核心算法（拒绝步骤 + 残差分布），配套有：

- 一个「大模型」，是手写分布上的确定性 softmax（这样我们能解析地验证接受率数学）。
- 一个「draft model」，是大模型的扰动版本。
- 一个 accept / reject 循环，输出与从 verifier 直接采样相同的边缘分布。

### 第 1 步：拒绝步骤（Step 1: the rejection step）

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u` 是一个均匀随机数。`q_prob` 是 verifier 对所起草 token 的概率，`p_prob` 是 draft model 的概率。Leviathan 定理说：这个伯努利判定加上拒绝时从残差里采样，能精确保留 verifier 的分布。

### 第 2 步：残差分布（Step 2: residual distribution）

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

逐元素从 `q` 里减去 `p`，把负值截到零，再重新归一化。任何一次拒绝都从这个分布里采样。

### 第 3 步：一次 speculative 步骤（Step 3: one speculative step）

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

5 个被接受 → 1 个奖励 → 一次 verifier pass 产出 6 个 token。

### 第 4 步：测量接受率（Step 4: measure acceptance rate）

在不同 draft 质量等级下跑 10,000 次 speculative 步骤。把接受率对 draft 与 verifier 分布之间的 KL 散度作图。你应该能看到一条干净的单调关系。

### 第 5 步：验证分布等价性（Step 5: verify distribution equivalence）

经验上：speculative 循环产出的 token 直方图，应当与直接从 verifier 采样得到的直方图一致。这就是 Leviathan 定理的实测版。卡方检验在采样误差范围内确认。

## 用起来（Use It）

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

截至 2026 年中，TensorRT-LLM 拥有最快的 Medusa 路径。`faster-whisper` 用一个小 draft 把 speculative decoding 包到了 Whisper-large 上。

**怎么选 draft：**

| 策略 | 何时选用 | 加速比 |
|----------|--------------|---------|
| Vanilla draft（1B/3B Llama 家族） | 快速原型，无需训练 | 1.8–2.3× |
| Medusa heads | 你能 fine-tune verifier | 2–3× |
| EAGLE-2 / 3 | 生产环境，追求最大速度 | 3–4× |
| Lookahead | 不要 draft、不要训练、不要额外参数 | 1.3–1.6× |

**什么时候不要用 spec-decode：**

- 单序列、只生成 1–5 个 token。开销占主导。
- 极度发散 / 高 temperature 的采样（α 下降）。
- 显存吃紧的部署（draft model 增加 VRAM 占用）。

## 上线部署（Ship It）

参见 `outputs/skill-spec-decode-picker.md`。这个 skill 会为新的推理工作负载挑选 speculative decoding 策略（vanilla / Medusa / EAGLE / lookahead）和调参参数（N、draft 温度）。

## 练习（Exercises）

1. **Easy.** 跑 `code/main.py`。在 50,000 个 token 上确认 speculative 产出的 token 分布与 verifier 直接采样的分布一致，卡方 p > 0.05。
2. **Medium.** 把每次 verify 调用产出的 token 数（speedup）作为 `N` 的函数，分别在 `α = 0.5, 0.7, 0.85` 下作图。找出每个 α 下的最优 `N`。（提示：每次 verify 调用的期望 token 数 = `(1 - α^{N+1}) / (1 - α)`。）
3. **Hard.** 实现一个微型 Medusa：拿第 14 课的 capstone GPT，加 3 个额外 LM head，预测位置 t+2、t+3、t+4。在 tinyshakespeare 上用联合多 head 损失训练。把接受率和「直接截断同一模型得到的 vanilla draft」对比。
4. **Hard.** 实现回滚：从 10 个 token 的前缀 KV cache 开始，喂 5 个草稿 token，模拟在位置 3 被拒绝。在下一轮迭代中验证你的 cache 读出来正好等于「prefix + 前 2 个被接受的草稿」。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际是什么 |
|------|-----------------|-----------------------|
| Draft model | 「便宜那个」 | 提出候选 token 的较小模型；通常比 verifier 便宜 10–50×。 |
| Verifier | 「大那个」 | 我们要保留其分布的目标模型；每个 speculative 步骤跑一次。 |
| Acceptance rate（α） | 「draft 多常猜对」 | verifier 接受 draft 的逐 token 概率。典型 0.7–0.9。 |
| Residual distribution（残差分布） | 「拒绝时的兜底」 | `(q - p)_+` 归一化；拒绝时从这里采样能保留 verifier 分布。 |
| Bonus token | 「免费那个」 | 当 N 个 draft 全被接受时，再从 verifier 的下一步分布多采一个。 |
| Medusa | 「无 draft 的 speculative」 | verifier 上的多个 LM head 并行预测 t+1..t+k。 |
| EAGLE | 「隐藏状态 draft」 | 微型 transformer draft，以 verifier 最后一层 hidden states 为条件。 |
| Lookahead decoding | 「Jacobi 迭代」 | 用不动点迭代实现 self-speculation；不需要 draft model。 |
| Tree attention | 「一次验证多个候选」 | 分支验证，同时考虑多个 draft 续写。 |
| KV rollback | 「撤销被拒绝的 draft」 | 临时 KV 缓冲区；接受时提交，拒绝时丢弃。 |

## 延伸阅读（Further Reading）

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — 核心算法和等价性定理。
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) — 同期独立工作；干净的伯努利-拒绝证明。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — Medusa 论文；tree-attention 验证。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — EAGLE-1；以 hidden-state 为条件的 draft。
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) — EAGLE-2；动态 tree 深度。
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) — EAGLE-3。
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) — lookahead，无 draft 的方案。
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) — 生产参考的权威文档，四种策略全都接通。
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) — EAGLE-1/2/3 的参考代码。
