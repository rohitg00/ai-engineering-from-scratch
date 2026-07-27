# 投机解码与 EAGLE

> 前沿大语言模型生成一个 token 就需要对整个千亿参数做一次完整的前向传播。这种前向传播是严重超配的：大多数情况下，一个更小的模型就能正确猜出接下来的 3-5 个 token，大模型只需*验证*这个猜测。当猜测正确时，你用一个前向传播的代价得到了 5 个 token。投机解码（Leviathan 等人，2023）使这一过程保持精确，而 EAGLE-3（2025）将接受率推高到每次验证约 4.5 个 token——在保持输出分布一致的情况下实现 4-5 倍的加速。

**类型：** 构建
**语言：** Python（使用 numpy）
**前置条件：** 阶段 10 第 12 课（推理优化），阶段 10 第 04 课（预训练 Mini-GPT）
**时间：** 约 75 分钟

## 问题

在 H100 上，一个 70B 规模模型的解码吞吐量通常为 40-80 token/秒。每个 token 都需要一次完整的前向传播，从 HBM 读取所有模型权重。你无法在不改变模型输出的情况下缩小模型，也无法将批大小增加到超过内存限制。你陷入了困境——除非你能让模型在每次前向传播中输出多个 token。

自回归生成看起来本质上是串行的：`x_{t+1} = sample(p(· | x_{1:t}))`。但实际上存在并发的机会。如果你有一个廉价的预测器说"接下来的 4 个 token 很可能是 [a, b, c, d]"，你就可以用大模型的**一次前向传播**验证所有 5 个位置，并接受最长匹配前缀。

Leviathan、Kalai、Matias（2023，"Fast Inference from Transformers via Speculative Decoding"）通过一个巧妙的接受/拒绝规则使这一过程保持精确，该规则保留了目标模型的采样分布。相同的输出分布，速度提升 2-4 倍。

## 核心概念

### 双模型设置

- **目标模型** `M_p`：你想从中采样的大而慢、高质量的模型。分布：`p(x)`。
- **草稿模型** `M_q`：小而快、质量较低的模型。分布：`q(x)`。小 5-30 倍。

每一步：

1. 草稿模型自回归地提出 `K` 个 token：`x_1, x_2, ..., x_K ~ q`。
2. 目标模型对所有 `K+1` 个位置运行**一次**前向传播，为每个被提议的 token 生成 `p(x_k)`。
3. 通过下面所述的改进拒绝采样规则从左到右接受/拒绝每个 token。接受最长匹配前缀。
4. 如果任何 token 被拒绝，从修正后的分布中采样替换 token 并停止。否则从 `p(· | x_1...x_K)` 中采样一个奖励 token。

如果草稿与目标完全匹配，你可以在每次目标前向传播中获得 K+1 个 token。如果草稿在位置 1 就出错，你只能得到 1 个 token。

### 精确性规则

投机解码**在分布上可证明等价于从 p 采样**。拒绝规则如下：

```
对于每个被草稿的 token x_t：
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        接受 x_t
    else:
        从残差分布中采样替换 token：(p - q)+ / ||(p - q)+||_1
        停止
```

其中 `(p - q)+` 表示逐点差值的正部。当草稿与目标一致时（`p ≈ q`），接受率接近 1。当它们不一致时，需要构造残差分布，使得整体采样结果仍然精确地服从 `p`。

**贪婪解码情况。** 对于 temperature=0 采样，只需检查 `argmax(p) == x_t`。如果是，则接受；如果不是，则输出 `argmax(p)` 并停止。

### 预期加速

如果草稿模型在 token 级别的接受率为 `α`，则每次目标前向传播预期的 token 输出数为：

```
E[tokens] = (1 - α^{K+1}) / (1 - α)        # K = 草稿长度, α ∈ [0, 1]
```

当 `α = 0.8, K = 4` 时：`(1 - 0.8^5)/(1 - 0.8) = 3.36` 个 token/次前向传播。单次目标前向传播的成本约为 `cost_q * K + cost_p`（K 步草稿加一次目标验证）。如果 `cost_p >> cost_q * K`，则吞吐量的加速比为 `3.36× / 1 = 3.36×`。

唯一真正的参数是 `α`，它完全取决于草稿与目标的对齐程度。一个好的草稿模型就是一切。

### 训练草稿：蒸馏

随机选择的小模型不是好的草稿。标准方法是从目标模型进行蒸馏：

1. 选择一个小的架构（对于 70B 目标约 1B，对于 7B 目标约 500M）。
2. 在大型文本语料库上运行目标模型，存储其下一个 token 的分布。
3. 使用 KL 散度针对目标模型的分布（而非真实 token）训练草稿模型。

结果：`α` 在编码任务上通常为 0.6-0.8，在自然语言对话上为 0.7-0.85。生产中加速比为 2-3 倍。

### EAGLE：树形草稿 + 特征复用

Li、Wei、Zhang、Zhang（2024，"EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"）观察到标准投机解码的两个低效问题：

1. 草稿模型执行 K 步串行步骤，每一步都是完整计算堆栈。但草稿模型可以复用最近一次验证中目标模型的特征（隐藏状态）——目标模型已经计算了丰富的表示，而草稿模型却从头开始重新推导。
2. 草稿模型输出的是线性链。如果草稿模型可以输出一个*树形*候选结构（每个节点有多个猜测），目标模型的一次前向传播就可以通过树注意力掩码并行验证多个候选路径，并选择最长被接受的分支。

EAGLE-1 的改进：
- 草稿输入 = 目标模型在位置 t 的最终隐藏状态，而非原始 token。
- 草稿架构 = 1 个 transformer 解码器层（而非独立的小模型）。
- 输出 = 每层 K = 4-8 个候选的树，深度 4-6。

EAGLE-2（2024）增加了动态树拓扑：树在草稿模型不确定的地方变宽，在确定的地方保持狭窄。在不增加验证成本的情况下提高了 `α_effective`。

EAGLE-3（Li 等人，2025，"EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"）移除了固定的顶层特征依赖，并使用新的"测试时模拟"损失来训练草稿——草稿模型在与目标测试时分布匹配的输出上训练，而非在教师强制的训练分布上训练。接受率从 0.75（EAGLE-2）提升到 0.82（EAGLE-3），平均 token/验证从 3.0 提升到 4.5。

### 树注意力验证

当草稿输出一棵树时，目标模型使用**树注意力掩码**在一次前向传播中完成验证——这是一种编码树拓扑结构的因果掩码，而非纯粹的线性掩码。每个 token 只关注其在树中的祖先。验证仍然是一次前向传播、一次矩阵乘法；拓扑掩码只增加少量额外的 KV 条目。

```
        root（根）
       /      \
      a        b
     / \      / \
    c  d     e   f
```

如果 `a, b` 是竞争的第一 token 候选，而 `c, d, e, f` 是第二 token 候选，则所有六个位置在一次前向传播中得到验证。输出是沿任意被接受路径的最长前缀。

### 何时有效，何时无效

**有效：**
- 可预测文本（代码、常见英语、结构化输出）的聊天/补全任务。`α` 很高。
- 解码期间 GPU 计算能力未被充分利用的场景（内存受限阶段）。树形草稿利用了可用的 FLOPs。

**无效/无收益：**
- 高度随机的输出（高温下的创意写作）。`α` 下降到 `1/|vocab|` 附近。
- 极高并发度的批量服务——批处理已经填满了 FLOPs，几乎没有留给树验证的空间。
- 非常小的目标模型，此时草稿模型并不小多少。

生产环境下通常报告聊天场景 2-3 倍的墙上时钟加速，代码生成 3-5 倍，创意写作接近零加速。

```figure
speculative-decoding
```

## 动手构建

`code/main.py`：

- 一个参考实现 `speculative_decode(target, draft, prompt, K, temperature)`，实现精确拒绝规则并验证其保持目标分布（经验 KL < 0.01，与纯目标采样相比）。
- 一个 EAGLE 风格的树形草稿器，构建深度 K 的树，使用 top-p 分支策略。
- 一个树注意力掩码构建器，为验证器生成正确的因果模式。
- 一个接受率测试框架，在一个小型 LM 上运行两者（从 GPT-2-medium 目标蒸馏一个 GPT-2-small）。

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """一轮投机解码。返回接受的 token 列表。"""
    # 1. 草稿模型生成 K 个 token
    draft_tokens = []
    q_probs = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_probs.append(probs[t])
        state = draft_step(state, t)

    # 2. 目标模型计算每个被草稿位置的概率 + 额外 1 个位置
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
    # 4. 所有 K 个 token 都接受 → 从目标模型采样奖励 token
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## 使用方式

- **vLLM** 和 **SGLang** 内置了一流的投机解码支持。相关标志：`--speculative_model`、`--num_speculative_tokens`。EAGLE-2/3 支持通过 `--spec_decoding_algorithm eagle` 标志启用。
- **NVIDIA TensorRT-LLM** 原生支持 Medusa 和 EAGLE 树。
- **参考草稿模型**：`Qwen/Qwen3-0.6B-spec`（为 Qwen3-32B 提供草稿）、`meta-llama/Llama-3.2-1B-Instruct-spec`（为 70B 模型提供草稿）。
- **Medusa 多头结构**（Cai 等人，2024，"Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"）：不另设草稿模型，而是在目标模型本身上添加 K 个并行的预测头。部署更简单，接受率略低于 EAGLE。

## 交付物

本课程产出 `outputs/skill-speculative-tuning.md`——一个技能文件，用于分析目标模型的工作负载并选择：草稿模型、K（草稿长度）、树宽度、温度，以及何时回退到普通解码。

## 练习

1. 实现精确拒绝规则并进行经验验证。通过 `speculative_decode` 和普通目标采样各运行 10K 个样本，计算两个输出分布之间的总变差距离。应小于 0.01。

2. 计算加速公式。给定固定的 `α` 和 `K`，绘制每次目标前向传播的预期 token 数。找出 α ∈ {0.5, 0.7, 0.9} 时的最优 K。

3. 训练一个微型草稿模型。以 124M GPT-2 为目标模型，通过 KL 损失在 1 亿 token 上蒸馏一个 30M GPT-2 草稿模型。在保留文本上测量 `α`。预期值：0.6-0.7。

4. 实现 EAGLE 风格的树形草稿。草稿模型输出每层 top-3 分支（而非单链）。构建树注意力掩码。验证目标模型接受最长正确分支。

5. 测量失效模式。在 temperature=1.5（高随机性）下运行投机解码。展示 α 崩溃，且由于草稿开销，算法比普通解码更慢。

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|----------|----------|
| 目标模型 | "大模型" | 你想从中采样的大而慢、高质量的模型（p 分布） |
| 草稿模型 | "投机者" | 小而快的预测器（q 分布）；小 5-30 倍 |
| K / 草稿长度 | "预视步数" | 每次验证回合中推测的 token 数量 |
| α / 接受率 | "命中率" | 草稿模型提议被接受的每个 token 的概率 |
| 精确拒绝规则 | "接受测试" | r < p/q 的比较，保持目标分布的采样规则 |
| 残差分布 | "修正 p-q" | (p - q)+ / ||(p - q)+||_1，拒绝时要采样的分布 |
| 树形草稿 | "分支推测" | 草稿输出候选树，通过树结构注意力掩码一次验证 |
| 树注意力掩码 | "拓扑掩码" | 编码树拓扑结构的因果掩码，使每个节点只关注其祖先 |
| Medusa 多头 | "并行头" | 在目标模型本身上添加 K 个额外的预测头；无需独立的草稿模型 |
| EAGLE 特征复用 | "隐藏状态草稿" | 草稿输入是目标模型的最后一层隐藏状态，而非原始 token，从而缩小草稿模型 |
| 测试时模拟损失 | "EAGLE-3 训练" | 在与目标测试时分布匹配的输出上训练草稿，而非教师强制 |

## 延伸阅读

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) —— 精确拒绝规则与理论加速分析
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) —— DeepMind 同期发表的投机采样论文
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) —— 草稿模型的并行多头替代方案
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) —— 特征复用与树形草稿
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) —— 动态树拓扑
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) —— 训练时与测试时分布匹配
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) —— Jacobi/前瞻解码，一种无需投机模型的替代方案
