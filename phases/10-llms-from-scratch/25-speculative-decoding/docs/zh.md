# 推测解码（Speculative Decoding）与EAGLE

> 前沿的大语言模型生成一个token需要对数十亿参数进行一次完整前向传播。这种前向传播严重过度配置：大多数时候，一个小得多的模型就能正确猜测接下来的3-5个token，而大模型只需*验证*这个猜测。当猜测正确时，你就能用一个前向传播的代价获得5个token。推测解码（Leviathan等人，2023）使这种设想变得精确，而EAGLE-3（2025）将接受率推高到每次验证约4.5个token——在保持输出分布一致的情况下实现4-5倍加速。

**类型：** 构建
**语言：** Python（含numpy）
**预备知识：** 阶段10 第12课（推理优化），阶段10 第04课（预训练Mini-GPT）
**时间：** 约75分钟

## 问题

70B级别模型在H100上的解码吞吐量通常为40-80 tokens/秒。每个token都需要一次完整的前向传播，从HBM中读取所有模型权重。你不能在不改变模型输出的情况下缩小模型。你也不能在内存限制下增大批量大小。你被困住了——除非你能让模型每次前向传播输出多个token。

自回归生成本质上是串行的：`x_{t+1} = sample(p(· | x_{1:t}))`。但这里存在并发机会。如果你有一个廉价的预测器，可以预测"接下来4个token很可能是[a, b, c, d]"，那么你就可以在**大模型的一次前向传播**中验证所有5个位置，并接受最长的匹配前缀。

Leviathan、Kalai、Matias（2023年，"通过推测解码实现Transformer快速推理"）通过巧妙的接受/拒绝规则使这一过程变得精确，同时保留了目标模型的采样分布。相同的输出分布，速度提升2-4倍。

## 概念

### 双模型设置

- **目标模型** `M_p`：你实际想要从中采样的大、慢、高质量的模型。分布：`p(x)`。
- **草稿模型** `M_q`：一个小、快、低质量的模型。分布：`q(x)`。大小为目标的5-30倍。

每步：

1. 草稿模型自回归地提出`K`个token：`x_1, x_2, ..., x_K ~ q`。
2. 目标模型在所有的`K+1`个位置上并行运行**一次**前向传播，为每个提议的token生成`p(x_k)`。
3. 通过下面的修正拒绝采样规则从左到右接受/拒绝每个token。接受最长的匹配前缀。
4. 如果任何token被拒绝，则从修正后的分布中采样替代项并停止。否则，从`p(· | x_1...x_K)`中采样一个额外的奖励token。

如果草稿与目标完全匹配，你就能为每个目标前向传播获得K+1个token。如果草稿在第1个位置就错误，你只能获得1个token。

### 精确性规则

推测解码在**分布上被证明等同于从p采样**。拒绝规则：

```
对于每个草稿token x_t：
    r ~ Uniform(0, 1)
    如果 r < p(x_t) / q(x_t)：
        接受 x_t
    否则：
        从残差分布采样替代项：(p - q)+ / ||(p - q)+||_1
        停止
```

其中`(p - q)+`表示逐点差值的正部分。当草稿和目标一致时（`p ≈ q`），接受率接近1。当它们不一致时，构造残差分布使得整体样本仍然精确等于`p`。

**贪婪情况。** 对于temperature=0的采样，只需检查`argmax(p) == x_t`。如果相等则接受；如果不相等，输出`argmax(p)`并停止。

### 预期加速

如果草稿模型的token级接受率为`α`，则每次目标前向传播预期的token数为：

```
E[token数] = (1 - α^{K+1}) / (1 - α)        # K = 草稿长度，α ∈ [0, 1]
```

在`α = 0.8, K = 4`时：`(1 - 0.8^5)/(1 - 0.8) = 3.36` tokens/前向。一次目标前向传播成本约为`cost_q * K + cost_p`（K步草稿加上一次目标验证）。如果`cost_p >> cost_q * K`，则吞吐量的加速比为`3.36× / 1 = 3.36×`。

唯一的真实参数是`α`，它完全取决于草稿与目标的对齐程度。一个好的草稿就是一切。

### 训练草稿：蒸馏

随机的小模型无法成为好的草稿。标准方法是使用目标模型进行蒸馏：

1. 选择一个小的架构（70B目标约1B，7B目标约500M）。
2. 在大型文本语料库上运行目标模型；存储其下一个token的分布。
3. 使用与目标分布之间的KL散度训练草稿（而不是针对真实token）。

结果：`α`在代码任务上通常为0.6-0.8，在自然语言对话上为0.7-0.85。生产环境中可实现2-3倍加速。

### EAGLE：树草稿（Tree Drafting）+ 特征重用（Feature Reuse）

Li、Wei、Zhang、Zhang（2024年，"EAGLE：推测采样需要重新思考特征不确定性"）观察到标准推测解码中的两个低效点：

1. 草稿执行K个串行步骤，每一步都是完整堆栈。但草稿可以重用目标在最近一次验证中计算出的特征（隐藏状态）——目标已经计算了丰富的表示，而草稿却在从头重新推导。
2. 草稿输出一个线性链。如果草稿能输出一个*树*结构的候选（每个节点包含多个猜测），那么目标的一次前向传播可以通过树注意力掩码并行验证多个候选路径，并选择最长的已接受分支。

EAGLE-1的变化：
- 草稿输入 = 目标在位置t的最终隐藏状态，而非原始token。
- 草稿架构 = 1个Transformer解码层（而非独立的小模型）。
- 输出 = 每层K = 4-8个候选，深度为4-6的树。

EAGLE-2（2024）增加了动态树拓扑：在草稿不确定的地方树变宽，在确信的地方保持狭窄。提高了`α_effective`而不增加验证成本。

EAGLE-3（Li等人，2025年，"EAGLE-3：通过训练时测试扩展大语言模型的推理加速"）移除了固定的顶层特征依赖，并使用新的"测试时模拟"损失训练草稿——草稿在与目标测试时分布相匹配的输出上训练，而不是在教师强迫的训练分布上训练。接受率从0.75（EAGLE-2）提升到0.82（EAGLE-3），平均token数/验证从3.0提升到4.5。

### 树注意力验证

当草稿输出一棵树时，目标模型使用**树注意力掩码**在一次前向传播中验证它——这是一种因果掩码，编码了树拓扑而不是纯线性关系。每个token只关注其在树中的祖先。验证仍然是一次前向传播，一次矩阵乘法；拓扑掩码只增加少量KV条目。

```
        根
       /   \
      a     b
     / \   / \
    c  d  e   f
```

如果`a, b`是竞争的第一个token候选，而`c, d, e, f`是第二个token候选，则所有六个位置在一次前向传播中被验证。输出是沿任何已接受路径的最长前缀。

### 何时有效，何时无效

**有效：**
- 文本可预测的聊天/补全（代码、常见英语、结构化输出）。`α`很高。
- 解码过程中存在未使用的GPU计算资源（内存受限阶段）。树草稿利用了可用的FLOPs。

**无效/无收益：**
- 高度随机的输出（高temperature下的创造性写作）。`α`向`1/|词汇表|`下降。
- 并发度极高的批量服务——批处理已经占满了FLOPs，几乎没有空间进行树验证。
- 目标模型非常小，草稿模型并不比它小多少。

生产环境中通常报告对话场景2-3倍的时钟加速，代码生成3-5倍，创造性写作接近为零。

## 动手实现

`code/main.py`：

- 一个参考的`speculative_decode(target, draft, prompt, K, temperature)`，实现了精确拒绝规则，并验证其保留了目标分布（经验KL < 0.01，与纯目标采样相比）。
- 一个EAGLE风格的树草稿生成器，构建深度为K且具有top-p分支的树。
- 一个树注意力掩码构建器，为验证器生成正确的因果模式。
- 一个接受率测试框架，在小语言模型上运行（从一个GPT-2-medium目标蒸馏出一个GPT-2-small草稿）。

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """推测解码的一轮。返回已接受token列表。"""
    # 1. 草稿K个token
    draft_tokens = []
    q_probs = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_probs.append(probs[t])
        state = draft_step(state, t)

    # 2. 目标计算每个草稿位置 + 额外一个位置的p
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
    # 4. 所有K个都被接受 → 从目标采样一个奖励token
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## 使用它

- **vLLM** 和 **SGLang** 原生支持一等公民的推测解码。标志：`--speculative_model`、`--num_speculative_tokens`。通过 `--spec_decoding_algorithm eagle` 标志支持EAGLE-2/3。
- **NVIDIA TensorRT-LLM** 原生支持Medusa和EAGLE树。
- **参考草稿模型**：`Qwen/Qwen3-0.6B-spec`（为Qwen3-32B草稿）、`meta-llama/Llama-3.2-1B-Instruct-spec`（为70B草稿）。
- **Medusa头**（Cai等人，2024，"Medusa：具有多个解码头的简单LLM推理加速框架"）：不是添加草稿模型，而是在目标模型上添加K个并行预测头。部署更简单，但接受率略低于EAGLE。

## 交付

本课程产生 `outputs/skill-speculative-tuning.md` —— 一项技能，用于分析目标模型的工作负载并选择：草稿模型、K（草稿长度）、树宽度、temperature，以及何时回退到普通解码。

## 练习

1. 实现精确拒绝规则并进行经验验证。通过`speculative_decode`和纯目标采样运行10K个样本；计算两个输出分布之间的TV距离。应 < 0.01。

2. 计算加速公式。给定固定的`α`和`K`，绘制每次目标前向传播的预期token数。找出α ∈ {0.5, 0.7, 0.9}的最佳K。

3. 训练一个微型草稿。以124M的GPT-2作为目标，在1亿token的KL损失上蒸馏出一个30M的GPT-2草稿。在保留文本上测量`α`。预期：0.6-0.7。

4. 实现EAGLE风格的树草稿。不是链式结构，而是让草稿在每层输出top-3分支。构建树注意力掩码。验证目标接受最长的正确分支。

5. 测量失败模式。在temperature=1.5（高随机性）下运行推测解码。展示α崩塌，并且由于草稿开销，算法比普通解码更慢。

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|----------|----------|
| 目标模型 (Target model) | "大模型" | 你希望从中采样的慢、高质量模型（p分布） |
| 草稿模型 (Draft model) | "推测器" | 小、快的预测器（q分布）；大小为目标的5-30倍 |
| K / 草稿长度 (draft length) | "前瞻" | 每次验证推测的token数量 |
| α / 接受率 (acceptance rate) | "命中率" | 每个token上草稿提议被接受的概率 |
| 精确拒绝规则 (Exact rejection rule) | "接受测试" | r < p/q 比较，保留目标分布 |
| 残差分布 (Residual distribution) | "修正p-q" | (p - q)+ / ||(p - q)+||_1，拒绝时从中采样的分布 |
| 树草稿 (Tree drafting) | "分支推测" | 草稿输出候选树，通过树结构注意力掩码一次性验证 |
| 树注意力掩码 (Tree attention mask) | "拓扑掩码" | 编码树拓扑的因果掩码，使每个节点只关注其祖先 |
| Medusa头 (Medusa heads) | "并行头" | 目标模型上的K个额外预测头；无需单独的草稿模型 |
| EAGLE特征重用 (EAGLE feature reuse) | "隐藏状态草稿" | 草稿输入是目标的最后隐藏状态，而非原始token，缩小草稿规模 |
| 测试时模拟损失 (Test-time simulation loss) | "EAGLE-3训练" | 在与目标测试时分布匹配的输出上训练草稿，而非教师强迫 |

## 延伸阅读

- [Leviathan, Kalai, Matias, 2023 — "通过推测解码实现Transformer快速推理"](https://arxiv.org/abs/2211.17192) — 精确拒绝规则和理论加速分析
- [Chen, Borgeaud, Irving 等, 2023 — "使用推测采样加速大语言模型解码"](https://arxiv.org/abs/2302.01318) — DeepMind同时期的推测采样论文
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa：具有多个解码头的简单LLM推理加速框架"](https://arxiv.org/abs/2401.10774) — 草稿模型的并行头替代方案
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE：推测采样需要重新思考特征不确定性"](https://arxiv.org/abs/2401.15077) — 特征重用和树草稿
- [Li 等, 2024 — "EAGLE-2：使用动态草稿树实现更快的语言模型推理"](https://arxiv.org/abs/2406.16858) — 动态树拓扑
- [Li 等, 2025 — "EAGLE-3：通过训练时测试扩展大语言模型的推理加速"](https://arxiv.org/abs/2503.01840) — 训练时与测试时匹配
- [Fu, Haotian, Peng 等, 2024 — "使用前瞻解码打破LLM推理的序列依赖"](https://arxiv.org/abs/2402.02057) — Jacobi/前瞻解码，一种无需推测器的替代方案