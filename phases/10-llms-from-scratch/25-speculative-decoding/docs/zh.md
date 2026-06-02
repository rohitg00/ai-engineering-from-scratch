# 投机解码与 EAGLE（Speculative Decoding and EAGLE）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个前沿 LLM 每生成一个 token，都要做一次完整的、跨越数十亿参数的前向传播。这次前向传播严重过度配置：大多数时候，一个小得多的模型就能正确猜出接下来 3-5 个 token，大模型只需要*验证*这个猜测。猜对的时候，你就用一次前向的代价拿到了 5 个 token。投机解码（speculative decoding，Leviathan et al. 2023）让这件事变得精确可证；EAGLE-3（2025）把接受率推到每次 verify 约 4.5 个 token —— 在保持输出分布一致的前提下，4-5 倍加速。

**Type:** Build
**Languages:** Python（with numpy）
**Prerequisites:** Phase 10 Lesson 12（Inference Optimization）, Phase 10 Lesson 04（Pre-training Mini-GPT）
**Time:** ~75 分钟

## 问题（Problem）

H100 上 70B 级模型的解码（decode）吞吐通常是 40-80 tokens/秒。每生成一个 token 都要做一次完整的前向传播，把所有模型权重从 HBM 里读一遍。你不能在不改变输出的前提下把模型变小，也不能把 batch size 加到超过显存上限。你卡死了 —— 除非你能让模型在一次前向传播里输出多于一个 token。

autoregressive 生成看起来天然是串行的：`x_{t+1} = sample(p(· | x_{1:t}))`。但这里有并发的机会。如果你有一个便宜的预测器告诉你「接下来 4 个 token 大概是 [a, b, c, d]」，你就可以**用大模型的一次前向传播**同时验证全部 5 个位置，并接受最长的匹配前缀。

Leviathan、Kalai、Matias（2023, "Fast Inference from Transformers via Speculative Decoding"）通过一条巧妙的接受/拒绝（accept/reject）规则让这件事变得精确：保留 target 模型的采样分布，但提速 2-4 倍。

## 概念（Concept）

### 双模型设置（The Two-Model Setup）

- **Target 模型** `M_p`：你真正想从中采样的那个又大又慢、质量高的模型。分布：`p(x)`。
- **Draft 模型** `M_q`：一个又小又快、质量较低的模型。分布：`q(x)`。比 target 小 5-30 倍。

每一步：

1. Draft 模型 autoregressive 地提议 `K` 个 token：`x_1, x_2, ..., x_K ~ q`。
2. Target 模型对全部 `K+1` 个位置并行做一次前向传播，得到每个被提议 token 的 `p(x_k)`。
3. 按下面的修正拒绝采样规则从左到右逐个决定接受或拒绝。接受最长匹配前缀。
4. 如果某个 token 被拒绝，从修正后的分布里采样一个替代 token，然后停下。如果全部接受，就再从 `p(· | x_1...x_K)` 采一个 bonus token。

如果 draft 与 target 完全对齐，那么每次 target 前向能拿 K+1 个 token。如果第 1 个位置就被拒，就只拿到 1 个。

### 精确性规则（The Exactness Rule）

投机解码**在分布上可证地等价于直接从 p 采样**。拒绝规则如下：

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

其中 `(p - q)+` 表示逐点之差的正部。当 draft 和 target 一致时（`p ≈ q`），接受概率几乎为 1。当它们不一致时，残差分布（residual distribution）的构造保证整体采样仍然精确等于 `p`。

**Greedy 情形。** 对 temperature=0 采样，只需检查 `argmax(p) == x_t`。是则接受；否则输出 `argmax(p)` 并停下。

### 期望加速比（Expected Speedup）

如果 draft 模型的逐 token 接受率为 `α`，那么每次 target 前向期望产生的 token 数为：

```
E[tokens] = (1 - α^{K+1}) / (1 - α)        # K = draft length, α in [0, 1]
```

当 `α = 0.8, K = 4`：`(1 - 0.8^5)/(1 - 0.8) = 3.36` 个 token / 前向。一次 target 前向的总成本大约是 `cost_q * K + cost_p`（K 步 draft 加一次 target verify）。如果 `cost_p >> cost_q * K`，吞吐加速比就是 `3.36× / 1 = 3.36×`。

唯一真正的可调参数是 `α`，它完全取决于 draft 与 target 的对齐程度。**好的 draft 就是一切。**

### 训练 draft：蒸馏（Training the Draft: Distillation）

随便找个小模型来当 draft，效果会很差。标准做法是从 target 蒸馏（distillation）：

1. 选一个小架构（target 是 70B 就用 ~1B，target 是 7B 就用 ~500M）。
2. 在大规模文本语料上跑 target 模型，存下它的下一 token 分布。
3. 用 KL 散度（KL divergence）让 draft 去拟合 target 的分布（不是拟合 ground-truth token）。

结果：`α` 在代码上通常 0.6-0.8，在自然语言对话上 0.7-0.85。生产环境里 2-3 倍加速。

### EAGLE：树形 draft + 特征复用（EAGLE: Tree Drafting + Feature Reuse）

Li、Wei、Zhang、Zhang（2024, "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"）观察到标准投机解码有两处低效：

1. Draft 要做 K 步串行、每步都跑完整网络。但 draft 本可以复用 target 在最近一次 verify 时算出的特征（hidden states）—— target 已经算好了丰富的表示，draft 却在从零再推导一遍。
2. Draft 输出的是一条线性链。如果 draft 能输出一棵*树*的候选（每个节点多个猜测），target 的一次前向就可以借助 tree attention mask 并行验证多条候选路径，挑出最长被接受的分支。

EAGLE-1 的改动：
- Draft 的输入 = target 在位置 t 的最后一层 hidden state，而不是原始 token。
- Draft 的架构 = 1 层 transformer decoder（不是单独的小模型）。
- 输出 = 每层深度 K = 4-8 个候选构成的树，深度 4-6。

EAGLE-2（2024）增加了动态树拓扑：draft 不确定的地方树就更宽，确定的地方就更窄。在不增加 verify 成本的情况下抬高了 `α_effective`。

EAGLE-3（Li et al. 2025, "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"）去掉了对固定顶层特征的依赖，并用一种新的「test-time 模拟」损失训练 draft —— draft 是在匹配 target 测试时分布的输出上训练的，而不是 teacher-forcing 的训练分布。接受率从 EAGLE-2 的 0.75 提升到 EAGLE-3 的 0.82，每次 verify 平均 token 数从 3.0 提到 4.5。

### Tree attention 验证（Tree Attention Verification）

当 draft 输出一棵树时，target 模型用一张 **tree attention mask** 在一次前向里完成验证 —— 这是一张编码了树拓扑（而不是单纯一条链）的因果 mask。每个 token 只 attend 到它在树中的祖先。Verify 仍然只是一次前向、一次 matmul；拓扑 mask 只多花几个 KV 项的代价。

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

如果 `a, b` 是相互竞争的第一个 token 候选、`c, d, e, f` 是第二个 token 候选，那么这 6 个位置在一次前向里就全部验证完。输出是任意被接受路径上的最长前缀。

### 何时见效，何时无效（When It Wins, When It Doesn't）

**见效：**
- 文本可预测性高的对话 / 续写（代码、常见英文、结构化输出）。`α` 高。
- 解码阶段 GPU 算力没用满（memory-bound 阶段）。Tree drafting 把空闲的 FLOPs 用起来。

**不见效 / 没好处：**
- 高度随机的输出（高 temperature 的创意写作）。`α` 会跌到 `1/|vocab|` 附近。
- 高并发的 batch serving —— batching 已经把 FLOPs 填满，留给 tree verification 的余地很小。
- Target 本身就很小，draft 没小多少。

生产环境里的常见报告：对话场景 2-3 倍墙钟加速，代码生成 3-5 倍，创意写作几乎没收益。

## 动手实现（Build It）

`code/main.py`：

- 一个参考实现 `speculative_decode(target, draft, prompt, K, temperature)`，实现精确拒绝规则，并验证它保留 target 的分布（与朴素 target 采样相比，empirical KL < 0.01）。
- 一个 EAGLE 风格的 tree drafter，按 top-p 分支构建深度 K 的树。
- 一个 tree attention mask 构造器，为 verifier 产生正确的因果模式。
- 一套接受率评测脚手架，在一个小 LM 上跑（用 GPT-2-medium 作为 target，蒸馏一个 GPT-2-small）。

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_probs = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_probs.append(probs[t])
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_probs[k]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_probs[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## 用起来（Use It）

- **vLLM** 和 **SGLang** 都有一等公民级的投机解码支持。参数：`--speculative_model`、`--num_speculative_tokens`。EAGLE-2/3 通过 `--spec_decoding_algorithm eagle` 启用。
- **NVIDIA TensorRT-LLM** 原生支持 Medusa 和 EAGLE 树。
- **参考 draft 模型**：`Qwen/Qwen3-0.6B-spec`（给 Qwen3-32B 做 draft）、`meta-llama/Llama-3.2-1B-Instruct-spec`（给 70B 做 draft）。
- **Medusa heads**（Cai et al. 2024, "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"）：不用单独的 draft 模型，而是在 target 上加 K 个并行预测头。部署更简单，接受率比 EAGLE 略低。

## 上线部署（Ship It）

本 lesson 产出 `outputs/skill-speculative-tuning.md` —— 一个 skill：分析 target 模型的工作负载，并选择 draft 模型、K（draft 长度）、树宽度、temperature，以及何时退回到普通解码。

## 练习（Exercises）

1. 实现精确拒绝规则并经验性地验证它。用 `speculative_decode` 跑 1 万样本，再用朴素 target 采样跑 1 万样本，计算两个输出分布之间的 TV 距离。应小于 0.01。

2. 推导加速公式。给定固定的 `α` 和 `K`，画出每次 target 前向的期望 token 数。找出 α ∈ {0.5, 0.7, 0.9} 各自的最优 K。

3. 训练一个微型 draft。拿 124M 的 GPT-2 作 target，在 100M token 上用 KL 损失蒸馏一个 30M 的 GPT-2 draft。在留出文本上测量 `α`。预期：0.6-0.7。

4. 实现 EAGLE 风格的 tree drafting。让 draft 在每个深度输出 top-3 分支，而不是一条链。构造对应的 tree attention mask。验证 target 接受了最长正确分支。

5. 测量失效模式。在 temperature=1.5（高随机性）下跑投机解码。展示 α 崩塌、并且因为 draft 开销，整体反而比普通解码更慢。

## 关键术语（Key Terms）

| Term | 大家怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Target model | 「大模型」 | 你想从中采样的那个慢而高质量的模型（p 分布） |
| Draft model | 「投机者」 | 又小又快的预测器（q 分布）；小 5-30 倍 |
| K / draft length | 「前瞻」 | 每次 verify 之前投机的 token 数 |
| α / acceptance rate | 「命中率」 | Draft 的提议被接受的逐 token 概率 |
| Exact rejection rule | 「接受测试」 | `r < p/q` 比较，保留 target 的分布 |
| Residual distribution | 「修正后的 p-q」 | `(p - q)+ / ||(p - q)+||_1`，被拒时用来重采的分布 |
| Tree drafting | 「分支投机」 | Draft 输出候选树，借助 tree-structured attention mask 一次性验证 |
| Tree attention mask | 「拓扑 mask」 | 编码树拓扑的因果 mask，让每个节点只 attend 到祖先 |
| Medusa heads | 「并行头」 | 在 target 自身上加 K 个额外预测头；不需要单独的 draft 模型 |
| EAGLE feature reuse | 「Hidden-state draft」 | Draft 的输入是 target 的最后 hidden state，不是原始 token，因此 draft 可以更小 |
| Test-time simulation loss | 「EAGLE-3 训练」 | 在匹配 target 测试时分布的输出上训练 draft，而不是 teacher forcing |

## 延伸阅读（Further Reading）

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) —— 精确拒绝规则与理论加速分析
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) —— DeepMind 的同期投机采样论文
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) —— 用并行头替代独立 draft 模型
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) —— 特征复用与 tree drafting
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) —— 动态树拓扑
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) —— 训练时与测试时分布的匹配
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) —— Jacobi / lookahead decoding，一种不需要投机者的替代方案
