# 25 · 推测解码与 EAGLE

> 一个前沿 LLM 每生成一个 token，都需要对数十亿参数做一次完整的前向传播。这次前向传播在算力上严重过剩：大多数情况下，一个小得多的模型就能正确猜出接下来的 3-5 个 token，而大模型只需要*验证*这个猜测即可。当猜测正确时，你就用一次前向的成本拿到了 5 个 token。推测解码（speculative decoding，Leviathan 等人 2023）让这件事变得精确可证，而 EAGLE-3（2025）把接受率推高到了每次验证约 4.5 个 token —— 在输出分布完全一致的前提下实现了 4-5 倍加速。

**类型：** 构建
**语言：** Python（配合 numpy）
**前置：** 阶段 10 第 12 课（推理优化），阶段 10 第 04 课（预训练 Mini-GPT）
**时长：** 约 75 分钟

## 问题所在

一个 70B 级别模型在 H100 上的解码吞吐量通常是 40-80 tokens/秒。每个 token 都需要一次完整的前向传播，从 HBM 中读取全部模型权重。你无法在不改变输出的前提下把模型变小；你也无法把批大小（batch size）增大到超出显存上限。你被卡住了 —— 除非你能让模型在一次前向传播中输出不止一个 token。

自回归生成看起来天生是串行的：`x_{t+1} = sample(p(· | x_{1:t}))`。但这里存在一个并发机会。如果你有一个廉价的预测器，告诉你"接下来 4 个 token 大概是 [a, b, c, d]"，你就可以在**大模型的单次前向传播**中验证全部 5 个位置，并接受最长的匹配前缀。

Leviathan、Kalai、Matias（2023，《Fast Inference from Transformers via Speculative Decoding》）通过一条巧妙的接受/拒绝规则把这件事做到了精确，该规则保持了目标模型的采样分布不变。输出分布完全相同，速度快了 2-4 倍。

## 核心概念

### 双模型架构

- **目标模型（target model）** `M_p`：你真正想要采样的那个大、慢、高质量模型。分布为 `p(x)`。
- **草稿模型（draft model）** `M_q`：一个小、快、质量较低的模型。分布为 `q(x)`。比目标模型小 5-30 倍。

每一步：

1. 草稿模型自回归地提议 `K` 个 token：`x_1, x_2, ..., x_K ~ q`。
2. 目标模型对全部 `K+1` 个位置并行运行一次前向传播，为每个被提议的 token 产出 `p(x_k)`。
3. 用下文的改进版拒绝采样规则，从左到右对每个 token 做接受/拒绝判定。接受最长的匹配前缀。
4. 如果有任何 token 被拒绝，则从校正后的分布中采样替换 token 并停止。否则，从 `p(· | x_1...x_K)` 中采样一个额外的奖励（bonus）token。

如果草稿与目标完全吻合，每次目标前向你能拿到 K+1 个 token。如果草稿在第 1 个位置就错了，你只能拿到 1 个 token。

### 精确性规则

推测解码在分布上**可证明等价于从 p 中采样**。拒绝规则如下：

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

其中 `(p - q)+` 表示逐点差值的正部。当草稿与目标一致（`p ≈ q`）时，接受概率接近 1。当二者不一致时，残差分布（residual distribution）的构造方式保证了整体采样结果仍然精确等于 `p`。

**贪心情形。** 对于 temperature=0 的采样，只需检查 `argmax(p) == x_t`。若相等则接受；若不等则输出 `argmax(p)` 并停止。

### 期望加速

如果草稿模型的逐 token 接受率为 `α`，那么每次目标前向传播产出的 token 数期望为：

```
E[tokens] = (1 - α^{K+1}) / (1 - α)        # K = draft length, α in [0, 1]
```

在 `α = 0.8, K = 4` 时：`(1 - 0.8^5)/(1 - 0.8) = 3.36`，即每次前向 3.36 个 token。一次目标前向的成本大致为 `cost_q * K + cost_p`（K 个草稿步加上一次目标验证）。如果 `cost_p >> cost_q * K`，那么吞吐量上的加速比就是 `3.36× / 1 = 3.36×`。

唯一真正的参数是 `α`，它完全取决于草稿与目标的对齐程度。一个好的草稿决定一切。

### 训练草稿：蒸馏

随机初始化的小模型是个糟糕的草稿。标准做法是从目标模型蒸馏：

1. 选一个小架构（对 70B 目标用约 1B，对 7B 目标用约 500M）。
2. 在大规模文本语料上运行目标模型；存下它的下一 token 分布。
3. 用 KL 散度（KL divergence）针对目标的分布来训练草稿（而不是针对真实标签 token）。

结果：`α` 在代码任务上通常为 0.6-0.8，在自然语言对话上为 0.7-0.85。生产环境中加速 2-3 倍。

### EAGLE：树状草稿 + 特征复用

Li、Wei、Zhang、Zhang（2024，《EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty》）观察到标准推测解码中的两处低效：

1. 草稿要做 K 个串行步骤，每一步都是完整的全栈推理。但草稿其实可以复用目标模型在最近一次验证时算出的特征（隐藏状态）—— 目标模型已经算出了丰富的表示，而草稿却在从零重新推导这些表示。
2. 草稿输出的是一条线性链。如果草稿能输出一棵候选*树*（每个节点有多个猜测），那么目标模型的单次前向传播就可以通过一个树注意力掩码（tree attention mask）并行验证多条候选路径，并选出被接受的最长分支。

EAGLE-1 的改动：
- 草稿输入 = 目标模型在位置 t 的最终隐藏状态，而非原始 token。
- 草稿架构 = 1 个 transformer 解码器层（而非一个独立的小模型）。
- 输出 = 每个深度 K = 4-8 个候选的树，深度 4-6。

EAGLE-2（2024）增加了动态树拓扑：草稿不确定的地方树就长得更宽，自信的地方就保持窄。在不增加验证成本的前提下提升了 `α_effective`（有效接受率）。

EAGLE-3（Li 等人 2025，《EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test》）移除了对固定顶层特征的依赖，并用一种新的"测试时模拟（test-time simulation）"损失来训练草稿 —— 草稿在匹配目标测试时分布的输出上训练，而非在教师强制（teacher-forced）的训练分布上训练。接受率从 0.75（EAGLE-2）升至 0.82（EAGLE-3），平均每次验证的 token 数从 3.0 升至 4.5。

### 树注意力验证

当草稿输出一棵树时，目标模型用一个**树注意力掩码**在单次前向传播中完成验证 —— 这是一个编码了树拓扑而非纯线性结构的因果掩码。每个 token 只关注它在树中的祖先节点。验证仍然是一次前向、一次矩阵乘法；拓扑掩码只额外消耗几个 KV 条目。

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

如果 `a, b` 是相互竞争的首 token 候选，`c, d, e, f` 是第二 token 候选，那么全部六个位置在一次前向传播中被验证。输出是任意被接受路径上的最长前缀。

### 何时取胜，何时失效

**取胜：**
- 文本可预测的对话/补全场景（代码、常见英语、结构化输出）。`α` 很高。
- 解码期间存在闲置 GPU 算力的场景（内存受限阶段）。树状草稿能用上这些可用的 FLOPs。

**失效/无收益：**
- 高度随机的输出（高温度下的创意写作）。`α` 会跌向 `1/|vocab|`。
- 极高并发的批量服务 —— 批处理已经把 FLOPs 填满，几乎没有树验证的余地。
- 极小的目标模型，此时草稿模型并不会小多少。

生产团队通常报告：对话场景墙钟时间加速 2-3 倍，代码生成 3-5 倍，创意写作几乎为零。

## 动手构建

`code/main.py`：

- 一个参考实现 `speculative_decode(target, draft, prompt, K, temperature)`，实现精确拒绝规则，并验证它保持了目标分布（与朴素目标采样相比，经验 KL < 0.01）。
- 一个 EAGLE 风格的树状草稿器，用 top-p 分叉构建一棵深度为 K 的树。
- 一个树注意力掩码构建器，为验证器生成正确的因果模式。
- 一个接受率测试框架，在一个微型 LM 上运行两者（从一个 GPT-2-medium 目标蒸馏出一个 GPT-2-small）。

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """推测解码的一轮。返回被接受的 token 列表。"""
    # 1. 草稿出 K 个 token
    draft_tokens = []
    q_probs = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_probs.append(probs[t])
        state = draft_step(state, t)

    # 2. 目标模型在每个草稿位置 + 1 个额外位置上计算 p
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. 从左到右接受/拒绝
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
    # 4. K 个全部接受 → 从目标模型采样一个奖励 token
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## 上手使用

- **vLLM** 和 **SGLang** 都内置了一流的推测解码支持。参数：`--speculative_model`、`--num_speculative_tokens`。EAGLE-2/3 通过 `--spec_decoding_algorithm eagle` 参数启用。
- **NVIDIA TensorRT-LLM** 原生支持 Medusa 和 EAGLE 树。
- **参考草稿模型**：`Qwen/Qwen3-0.6B-spec`（为 Qwen3-32B 草稿），`meta-llama/Llama-3.2-1B-Instruct-spec`（为 70B 草稿）。
- **Medusa 头（Medusa heads）**（Cai 等人 2024，《Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads》）：不使用独立草稿模型，而是在目标模型本身上加 K 个并行预测头。部署更简单，接受率略低于 EAGLE。

## 交付落地

本课会产出 `outputs/skill-speculative-tuning.md` —— 一个技能（skill），它会剖析目标模型的工作负载并据此选择：草稿模型、K（草稿长度）、树宽度、temperature，以及何时回退到朴素解码。

## 练习

1. 实现精确拒绝规则并做经验验证。分别通过 `speculative_decode` 和朴素目标采样各跑 10K 个样本；计算两个输出分布之间的 TV 距离（total variation distance）。应当 < 0.01。

2. 推导加速公式。给定固定的 `α` 和 `K`，画出每次目标前向的期望 token 数。为 α ∈ {0.5, 0.7, 0.9} 找出最优 K。

3. 训练一个微型草稿。取一个 124M 的 GPT-2 目标，在 100M token 上用 KL 损失蒸馏出一个 30M 的 GPT-2 草稿。在留出文本上测量 `α`。预期：0.6-0.7。

4. 实现 EAGLE 风格的树状草稿。让草稿在每个深度输出 top-3 分支，而非一条链。构建树注意力掩码。验证目标模型接受了最长的正确分支。

5. 测量失效模式。在 temperature=1.5（高随机性）下运行推测解码。展示 α 崩塌，且由于草稿开销，算法比朴素解码更慢。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 目标模型（Target model） | "那个大模型" | 你想要采样的那个慢、高质量模型（p 分布） |
| 草稿模型（Draft model） | "推测器" | 小而快的预测器（q 分布）；小 5-30 倍 |
| K / 草稿长度 | "前瞻（Look-ahead）" | 每次验证传播推测的 token 数量 |
| α / 接受率 | "命中率（Hit rate）" | 草稿提议被接受的逐 token 概率 |
| 精确拒绝规则 | "接受测试" | r < p/q 的比较，保持目标分布不变 |
| 残差分布 | "校正后的 p-q" | (p - q)+ / ||(p - q)+||_1，拒绝时用于采样的分布 |
| 树状草稿（Tree drafting） | "分叉推测" | 草稿输出一棵候选树，用树结构注意力掩码一次验证 |
| 树注意力掩码 | "拓扑掩码" | 编码树拓扑的因果掩码，使每个节点只关注其祖先 |
| Medusa 头 | "并行头" | 目标模型本身上的 K 个额外预测头；无独立草稿模型 |
| EAGLE 特征复用 | "隐藏状态草稿" | 草稿输入是目标的最后一层隐藏状态而非原始 token，从而缩小草稿 |
| 测试时模拟损失 | "EAGLE-3 训练" | 在匹配目标测试时分布的输出上训练草稿，而非教师强制 |

## 延伸阅读

- [Leviathan, Kalai, Matias, 2023 — 《Fast Inference from Transformers via Speculative Decoding》](https://arxiv.org/abs/2211.17192) —— 精确拒绝规则与理论加速分析
- [Chen, Borgeaud, Irving et al., 2023 — 《Accelerating Large Language Model Decoding with Speculative Sampling》](https://arxiv.org/abs/2302.01318) —— DeepMind 同期的推测采样论文
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — 《Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads》](https://arxiv.org/abs/2401.10774) —— 草稿模型之外的并行头替代方案
- [Li, Wei, Zhang, Zhang, 2024 — 《EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty》](https://arxiv.org/abs/2401.15077) —— 特征复用与树状草稿
- [Li et al., 2024 — 《EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees》](https://arxiv.org/abs/2406.16858) —— 动态树拓扑
- [Li et al., 2025 — 《EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test》](https://arxiv.org/abs/2503.01840) —— 训练时与测试时的匹配
- [Fu, Haotian, Peng et al., 2024 — 《Break the Sequential Dependency of LLM Inference Using Lookahead Decoding》](https://arxiv.org/abs/2402.02057) —— Jacobi/前瞻解码，一种无推测器的替代方案
