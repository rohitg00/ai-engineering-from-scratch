# 注意力机制（Attention Mechanism）——突破性进展

> 解码器不再眯着眼看压缩摘要，而是开始关注整个源序列。此后的一切都是注意力加工程。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 09（序列到序列模型）
**时间：** 约45分钟

## 问题

第9课结束于一次有意义的失败。在一个玩具复制任务上训练的GRU编码器-解码器在序列长度为5时准确率高达89%，到长度80时却降至接近随机水平。原因是结构性的，而非训练错误：编码器收集到的每一丝信息都必须塞进一个固定大小的隐藏状态中，而解码器从未看到过其他任何信息。

Bahdanau、Cho和Bengio在2014年发表了一个三行代码的修复方案。与其只给解码器最终的编码器状态，不如保留每一个编码器状态。在每个解码步骤中，计算编码器状态的加权平均值，其中权重表示“解码器当前需要从编码器位置`i`看到多少信息？”这个加权平均值就是上下文（context），它随每个解码步骤变化。

这就是全部思想。Transformer扩展了它。自注意力（Self-attention）将其应用于单个序列。多头注意力（Multi-head attention）使其并行运行。但2014年的版本已经打破了瓶颈，一旦你拥有了它，向Transformer的转变就只是工程问题，而非概念问题。

## 概念

![Bahdanau注意力：解码器查询所有编码器状态](../assets/attention.svg)

在每个解码步骤 `t`：

1. 使用先前的解码器隐藏状态 `s_{t-1}` 作为**查询**（query）。
2. 对每个编码器隐藏状态 `h_1, ..., h_T` 计算分数。每个编码器位置一个标量。
3. 对分数施加softmax，得到注意力权重 `α_{t,1}, ..., α_{t,T}`，这些权重之和为1。
4. 上下文向量 `c_t = Σ α_{t,i} * h_i`。编码器状态的加权平均。
5. 解码器接受 `c_t` 加上先前的输出令牌，生成下一个令牌。

加权平均是关键点。当解码器需要将“Je”翻译为“I”时，它会给“Je”对应的编码器状态高权重，给其他状态低权重。当需要翻译“not”时，它给“pas”高权重。上下文向量在每个步骤中重塑。

## 形状（最容易出错的地方）

这是每次注意力实现第一个出错的地方。请慢慢阅读。

| 项目 | 形状 | 备注 |
|------|------|------|
| 编码器隐藏状态 `H` | `(T_enc, d_h)` | 如果为BiLSTM，则 `d_h = 2 * d_hidden` |
| 解码器隐藏状态 `s_{t-1}` | `(d_s,)` | 单个向量 |
| 注意力分数 `e_{t,i}` | 标量 | 每个编码器位置一个 |
| 注意力权重 `α_{t,i}` | 标量 | 对所有 `i` 进行softmax后 |
| 上下文向量 `c_t` | `(d_h,)` | 与编码器状态形状相同 |

**Bahdanau（加法）分数。** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`。

- `s_{t-1}` 形状为 `(d_s,)`，`h_i` 形状为 `(d_h,)`。
- `W_a` 形状为 `(d_attn, d_s)`。`U_a` 形状为 `(d_attn, d_h)`。
- 它们在tanh内的和形状为 `(d_attn,)`。
- `v_α` 形状为 `(d_attn,)`。与 `v_α` 的内积坍缩为标量。**这就是 `v_α` 的作用。** 并非魔法，而是将注意力维度向量转换为标量分数的投影。

**Luong（乘法）分数。** 三种变体：

- `dot`：`e_{t,i} = s_t^T * h_i`。要求 `d_s == d_h`。硬约束。如果你的编码器是双向的，请跳过。
- `general`：`e_{t,i} = s_t^T * W * h_i`，其中 `W` 形状为 `(d_s, d_h)`。消除了等维度约束。
- `concat`：本质上就是Bahdanau形式。由于前两种计算量更小，很少使用。

**一个值得指出的Bahdanau/Luong陷阱。** Bahdanau使用 `s_{t-1}`（生成当前词*之前*的解码器状态）。Luong使用 `s_t`（*之后*的状态）。混淆它们会产生微妙的错误梯度，极难调试。选择一篇论文并坚持其约定。

## 构建

### 步骤 1：加法（Bahdanau）注意力

```python
import numpy as np


def additive_attention(decoder_state, encoder_states, W_a, U_a, v_a):
    projected_dec = W_a @ decoder_state
    projected_enc = encoder_states @ U_a.T
    combined = np.tanh(projected_enc + projected_dec)
    scores = combined @ v_a
    weights = softmax(scores)
    context = weights @ encoder_states
    return context, weights


def softmax(x):
    x = x - np.max(x)
    e = np.exp(x)
    return e / e.sum()
```

对照上表检查你的形状。`encoder_states` 形状为 `(T_enc, d_h)`。`projected_enc` 形状为 `(T_enc, d_attn)`。`projected_dec` 形状为 `(d_attn,)` 并进行广播。`combined` 形状为 `(T_enc, d_attn)`。`scores` 形状为 `(T_enc,)`。`weights` 形状为 `(T_enc,)`。`context` 形状为 `(d_h,)`。搞定。

### 步骤 2：Luong点积和通用

```python
def dot_attention(decoder_state, encoder_states):
    scores = encoder_states @ decoder_state
    weights = softmax(scores)
    return weights @ encoder_states, weights


def general_attention(decoder_state, encoder_states, W):
    projected = W.T @ decoder_state
    scores = encoder_states @ projected
    weights = softmax(scores)
    return weights @ encoder_states, weights
```

每段三行。这就是Luong论文受欢迎的原因。在大多数任务上精度相同，代码少得多。

### 步骤 3：一个完整的数值示例

给定三个编码器状态（大致对应“cat”，“sat”，“mat”）和一个与第一个最对齐的解码器状态，注意力分布集中在位置0。如果解码器状态转向与最后一个对齐，注意力移动到位置2。上下文向量随之变化。

```python
H = np.array([
    [1.0, 0.0, 0.2],
    [0.5, 0.5, 0.1],
    [0.1, 0.9, 0.3],
])

s_close_to_cat = np.array([0.9, 0.1, 0.2])
ctx, w = dot_attention(s_close_to_cat, H)
print("weights:", w.round(3))
```

```
weights: [0.464 0.305 0.231]
```

第一行胜出。然后移动解码器状态使其更接近第三个编码器状态，观察权重的变化。就这样。注意力就是显式的对齐。

### 步骤 4：为何这是通向Transformer的桥梁

将上面的语言翻译成Q/K/V：

- **查询（Query）** = 解码器状态 `s_{t-1}`
- **键（Key）** = 编码器状态（我们要与之计算分数的东西）
- **值（Value）** = 编码器状态（我们要加权求和的东西）

在经典注意力中，键和值是同一个东西。自注意力将它们分离：你可以对序列自身进行查询，并为K和V使用不同的学习投影。多头注意力使用不同的学习投影并行运行。Transformer将整个阶段堆叠多次，并丢弃了RNN。

数学是相同的。形状是相同的。从Bahdanau注意力到缩放点积注意力（scaled dot-product attention）的教学跳跃主要在于符号表示。

## 使用

PyTorch和TensorFlow直接提供了注意力机制。

```python
import torch
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=128, num_heads=8, batch_first=True)
query = torch.randn(2, 5, 128)
key = torch.randn(2, 10, 128)
value = torch.randn(2, 10, 128)

output, weights = mha(query, key, value)
print(output.shape, weights.shape)
```

```
torch.Size([2, 5, 128]) torch.Size([2, 5, 10])
```

这是一个Transformer注意力层。查询批次有5个位置，键/值批次有10个位置，每个128维，8个头。`output` 是新的上下文增强后的查询。`weights` 是一个5x10的对齐矩阵，你可以进行可视化。

### 经典注意力仍然重要的场合

- 教学。单头、单层、基于RNN的版本使每个概念都清晰可见。
- 设备上的序列任务，Transformer无法胜任。
- 2014-2017年的任何论文。不了解Bahdanau的约定，你可能会误读。
- 机器翻译中的细粒度对齐分析。即使在Transformer模型上，原始注意力权重也是一种可解释性工具，而读懂它们需要知道它们是什么。

### 注意力权重即为解释的陷阱

注意力权重看起来是可解释的。它们是跨位置求和为1的权重；你可以画出来；高权重表示“看了这里”。审稿人喜欢它们。

但它们并不像看起来那样可解释。Jain和Wallace（2019）指出，对于某些任务，注意力分布可以被置换甚至替换为任意替代方案，而不会改变模型预测。在没有消融或反事实检验的情况下，切勿将注意力权重报告为推理的依据。

## 输出

保存为 `outputs/prompt-attention-shades.md`：

```markdown
---
name: attention-shapes
description: 调试注意力实现中的形状错误。
phase: 5
lesson: 10
---

给定一个存在问题的注意力实现，你需要识别形状不匹配。输出：

1. 哪个矩阵的形状错误。命名该张量。
2. 根据 (d_s, d_h, d_attn, T_enc, T_dec, batch_size) 推导其应有的形状。
3. 一行修复。转置、重塑或投影。
4. 用于捕获回归的测试。通常：断言 `output.shape == (batch, T_dec, d_h)` 且 `weights.shape == (batch, T_dec, T_enc)` 且 `weights.sum(dim=-1)` 接近1。

拒绝推荐会静默广播的修复方案。广播隐藏的错误会在后期表现为静默的精度下降，这是最糟糕的注意力bug。

对于Bahdanau混淆，坚持解码器输入为 `s_{t-1}`（步骤前状态）。对于Luong，为 `s_t`（步骤后状态）。对于点积，将查询和键之间的维度不匹配标记为最常见的初次错误。
```

## 练习

1. **简单。** 实现`softmax`掩码，使编码器中的填充令牌获得零注意力权重。在包含变长序列的批次上进行测试。
2. **中等。** 在Luong的 `general` 形式中加入多头注意力。将 `d_h` 拆分为 `n_heads` 组，每头运行注意力，然后拼接。验证单头情况与之前的实现一致。
3. **困难。** 在第9课的玩具复制任务上，用Bahdanau注意力训练一个GRU编码器-解码器。绘制准确率与序列长度的关系图。与无注意力基线进行比较。你应该会看到随着长度增加差距扩大，证实注意力打破了瓶颈。

## 关键术语

| 术语 | 人们所说 | 实际含义 |
|------|---------|----------|
| 注意力（Attention） | 看东西 | 对值序列的加权平均，权重由查询-键相似度计算得出。 |
| 查询、键、值（Query, Key, Value） | QKV | 三个投影：Q提问，K是要匹配的内容，V是要返回的内容。 |
| 加法注意力（Additive attention） | Bahdanau | 前馈分数：`v^T tanh(W q + U k)`。 |
| 乘法注意力（Multiplicative attention） | Luong dot / general | 分数为 `q^T k` 或 `q^T W k`。更便宜，在大多数任务上精度相同。 |
| 对齐矩阵（Alignment matrix） | 漂亮图片 | 注意力权重构成一个 `(T_dec, T_enc)` 网格。阅读它可以看到模型关注了什么。 |

## 延伸阅读

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — 原论文。
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) — 三种分数变体及其比较。
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) — 可解释性注意事项。
- [动手学深度学习 — Bahdanau 注意力](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) — 带PyTorch的可运行教程。