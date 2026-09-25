# 投机解码与 EAGLE

> 前沿 LLM 生成一个 token 需要对数十亿参数进行一次完整前向传播。这次前向传播被极度过度配置了：大多数时候，一个小得多的模型就能正确猜出接下来的 3-5 个 token，而大模型只需*验证*这个猜测。猜对时，你花一次前向传播的代价得到了 5 个 token。投机解码（Leviathan 等，2023）使这一点做到了精确，EAGLE-3（2025）将接受率推至每次验证约 4.5 个 token——在输出分布完全一致的情况下实现 4-5 倍加速。

**类型：** 构建
**语言：** Python（配合 numpy）
**先修要求：** Phase 10 Lesson 12（推理优化），Phase 10 Lesson 04（Mini-GPT 预训练）
**时间：** 约 75 分钟

## 问题所在

在 H100 上，70B 级模型的解码吞吐量通常为 40-80 token/秒。每个 token 都需要一次完整前向传播，从 HBM 读取所有模型权重。在不改变模型输出的前提下，你无法让模型变小。在内存限制之外，你无法增大批大小。你被困住了——除非能让模型在每次前向传播中输出多个 token。

自回归生成看起来本质上是串行的：`x_{t+1} = sample(p(· | x_{1:t}))`。但这里存在并发机会。如果你有一个廉价的预测器，它说"接下来的 4 个 token 可能是 [a, b, c, d]"，你可以在**大模型的一次前向传播中**并行验证所有 5 个位置，并接受最长匹配前缀。

Leviathan、Kalai、Matias（2023，"Fast Inference from Transformers via Speculative Decoding"）通过一条巧妙的接受/拒绝规则做到了精确，该规则保持了目标模型的采样分布。同样的输出分布，快 2-4 倍。

## 核心概念

### 双模型设置

- **目标模型** `M_p`：你真正想从中采样的、大而慢、高质量模型。分布：`p(x)`。
- **草稿模型** `M_q`：一个小的、快的、质量较低的模型。分布：`q(x)`。规模小 5-30 倍。

每步流程：

1. 草稿模型自回归地提出 `K` 个 token：`x_1, x_2, ..., x_K ~ q`。
2. 目标模型对所有 `K+1` 个位置并行进行一次前向传播，为每个提议的 token 产生 `p(x_k)`。
3. 通过下面的修改版拒绝采样规则，从左到右接受/拒绝每个 token。接受最长匹配前缀。
4. 如果任何 token 被拒绝，从修正后的分布中采样替代 token 并停止。否则从 `p(· | x_1...x_K)` 中额外采样一个 token。

如果草稿与目标完全一致，每次目标前向传播可获得 K+1 个 token。如果草稿在位置 1 就错了，只能得到 1 个 token。

### 精确性规则

投机解码**可证明在分布上等价于从 p 采样**。拒绝规则为：

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

其中 `(p - q)+` 表示逐点差值的正部。当草稿与目标一致（`p ≈ q`）时，接受率接近 1。当它们不一致时，残差分布的构造方式保证了整体样本仍然严格服从 `p`。

**贪心情形。** 对于 temperature=0 的采样，只需检查 `argmax(p) == x_t`。是则接受；否则输出 `argmax(p)` 并停止。

### 预期加速比

如果草稿模型的 token 级接受率为 `α`，则每次目标前向传播的期望产出 token 数为：

```
E[tokens] = (1 - α^{K+1}) / (1 - α)        # K = draft length, α in [0, 1]
```

当 `α = 0.8, K = 4` 时：每次前向传播产出 `(1 - 0.8^5)/(1 - 0.8) = 3.36` 个 token。单次目标前向传播的成本约为 `cost_q * K + cost_p`（K 步草稿加上一次目标验证）。若 `cost_p >> cost_q * K`，吞吐量上的加速比为 `3.36× / 1 = 3.36×`。

唯一真正的参数是 `α`，它完全取决于草稿与目标的对齐程度。好的草稿就是一切。

### 训练草稿模型：蒸馏

随机的小模型做不好草稿。标准方法是从目标模型蒸馏：

1. 选择一个小架构（70B 目标配约 1B，7B 目标配约 500M）。
2. 在大型文本语料上运行目标模型；存储其下一 token 分布。
3. 用 KL 散度相对目标分布（而非真实 token）训练草稿模型。

结果：`α` 在代码任务上通常为 0.6-0.8，自然语言对话上为 0.7-0.85。生产环境中加速 2-3 倍。

### EAGLE：树状草稿 + 特征复用

Li、Wei、Zhang、Zhang（2024，"EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"）发现了标准投机解码中的两个低效之处：

1. 草稿要做 K 个串行步骤，每步都是完整流水线。但草稿可以复用目标模型最近一次验证产生的特征（隐藏状态）——目标模型已经计算出了丰富的表示，而草稿正在从零重新推导它们。
2. 草稿输出一条线性链。如果草稿能输出候选的*树*（每个节点多个猜测），目标模型的一次前向传播就可以通过树注意力掩码并行验证多条候选路径，并选出最长被接受的分支。

EAGLE-1 的改动：
- 草稿输入 = 目标模型在位置 t 的最终隐藏状态，而非原始 token。
- 草稿架构 = 1 层 transformer 解码器层（而非独立的小模型）。
- 输出 = 每层深度 K = 4-8 个候选的树，深度 4-6。

EAGLE-2（2024）增加了动态树拓扑：草稿不确定的地方树变宽，自信的地方树保持窄。在不增加验证成本的前提下提高 `α_effective`。

EAGLE-3（Li 等，2025，"EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"）移除了对固定顶层特征的依赖，并用一种新的"训练时测试模拟"损失来训练草稿——草稿是在与目标模型测试时分布相匹配的输出上训练的，而非教师强制的训练分布。接受率从 0.75（EAGLE-2）升至 0.82（EAGLE-3），每次验证的平均 token 数从 3.0 升至 4.5。

### 树注意力验证

当草稿输出一棵树时，目标模型通过**树注意力掩码**在单次前向传播中验证它——这是一个编码树拓扑而非纯线性序列的因果掩码。每个 token 只关注它在树中的祖先。验证过程仍然是一次前向、一次矩阵乘；拓扑掩码只增加少量额外的 KV 条目。

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

如果 `a, b` 是相互竞争的首 token 候选，`c, d, e, f` 是次 token 候选，则全部六个位置在一次前向传播中完成验证。输出是任何被接受路径上的最长前缀。

### 何时有效，何时无效

**有效场景：**
- 文本可预测的聊天 / 补全（代码、常见英语、结构化输出）。`α` 很高。
- 解码期间（访存受限阶段）GPU 算力未充分利用的场景。树状草稿利用了可用的 FLOPs。

**无效 / 无收益场景：**
- 高随机性输出（高温度下的创意写作）。`α` 趋向 `1/|vocab|`。
- 极高并发的批量服务——批处理已经填满了 FLOPs，树验证几乎没有提升空间。
- 目标模型本身很小、草稿没有小多少的场景。

生产环境通常报告：聊天上 2-3 倍实际加速，代码生成上 3-5 倍，创意写作上接近零。

```figure
speculative-decoding
```

## 动手构建

`code/main.py`：

- 一个参考 `speculative_decode(target, draft, prompt, K, temperature)`，实现精确拒绝规则，并验证它保持目标分布（相比直接目标采样，经验 KL < 0.01）。
- 一个 EAGLE 风格的树状草稿器，以 top-p 分支方式构建深度为 K 的树。
- 一个树注意力掩码构建器，为验证器生成正确的因果模式。
- 一个接受率测试工具，在微型 LM 上运行两者（从 GPT-2-medium 目标蒸馏一个 GPT-2-small）。

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

## 使用现成工具

- **vLLM** 和 **SGLang** 提供一流的投机解码支持。相关标志：`--speculative_model`、`--num_speculative_tokens`。通过 `--spec_decoding_algorithm eagle` 标志支持 EAGLE-2/3。
- **NVIDIA TensorRT-LLM** 原生支持 Medusa 与 EAGLE 树。
- **参考草稿模型**：`Qwen/Qwen3-0.6B-spec`（Qwen3-32B 的草稿模型）、`meta-llama/Llama-3.2-1B-Instruct-spec`（70B 的草稿模型）。
- **Medusa 头**（Cai 等，2024，"Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"）：不使用草稿模型，而是在目标模型自身上添加 K 个并行预测头。部署更简单，接受率略低于 EAGLE。

## 上线部署

本课产出 `outputs/skill-speculative-tuning.md` —— 一项技能：分析目标模型的工作负载，并选择草稿模型、K（草稿长度）、树宽度、温度，以及何时回退到普通解码。

## 练习

1. 实现精确拒绝规则并进行经验验证。通过 `speculative_decode` 与直接目标采样各运行 10K 个样本；计算两个输出分布之间的 TV 距离。应 < 0.01。

2. 推导加速比公式。给定固定的 `α` 和 `K`，绘制每次目标前向传播的期望 token 数曲线。为 α ∈ {0.5, 0.7, 0.9} 找出最优 K。

3. 训练一个微型草稿模型。以 124M 的 GPT-2 为目标，用 KL 损失在 100M token 上蒸馏出一个 30M 的 GPT-2 草稿模型。在留出文本上测量 `α`。预期：0.6-0.7。

4. 实现 EAGLE 风格的树状草稿。让草稿在每层深度输出 top-3 分支而非链式结构。构建树注意力掩码。验证目标模型接受最长正确分支。

5. 测量失效模式。在 temperature=1.5（高随机性）下运行投机解码。展示 α 崩溃，且由于草稿开销，算法比普通解码更慢。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 目标模型 | "大模型" | 你想从中采样的慢速高质量模型（p 分布） |
| 草稿模型 | "投机者" | 小而快的预测器（q 分布）；小 5-30 倍 |
| K / 草稿长度 | "前瞻" | 每次验证回合推测的 token 数 |
| α / 接受率 | "命中率" | 草稿提议被接受的逐 token 概率 |
| 精确拒绝规则 | "接受测试" | 保持目标分布的 r < p/q 比较 |
| 残差分布 | "修正后的 p-q" | (p - q)+ / ‖(p - q)+‖₁，被拒绝时用于采样的分布 |
| 树状草稿 | "分支投机" | 草稿输出候选树，用树结构注意力掩码在一次前向传播中验证 |
| 树注意力掩码 | "拓扑掩码" | 编码树拓扑的因果掩码，使每个节点只关注其祖先 |
| Medusa 头 | "并行头" | 目标模型自身的 K 个额外预测头；无需单独草稿模型 |
| EAGLE 特征复用 | "隐藏状态草稿" | 草稿输入是目标的最终隐藏状态而非原始 token，从而缩小草稿 |
| 测试时模拟损失 | "EAGLE-3 训练" | 在与目标测试时分布匹配的输出上训练草稿，而非教师强制 |

## 延伸阅读

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) — 精确拒绝规则与理论加速分析
- [Chen, Borgeaud, Irving 等，2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) — DeepMind 同期发表的投机采样论文
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) — 草稿模型的并行头替代方案
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) — 特征复用与树状草稿
- [Li 等，2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) — 动态树拓扑
- [Li 等，2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) — 训练时-测试时分布匹配
- [Fu, Haotian, Peng 等，2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) — Jacobi/前瞻解码，一种无需投机器的替代方案