# Attention 机制——突破

> 解码器不再眯着眼看压缩摘要，而是开始查看整个源。此后的所有内容都是 attention 加工程优化。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 09（序列到序列模型）
**时间：** ~45 分钟

## 问题

第 09 课以一个可测量的失败告终。在玩具复制任务上训练的 GRU 编码器-解码器从长度 5 时的 89% 准确率下降到长度 80 时的接近随机水平。原因是结构性的，而非训练错误：编码器收集到的每一点信息都必须塞进一个固定大小的隐藏状态中，解码器从未看到其他任何东西。

Bahdanau、Cho 和 Bengio 在 2014 年发表了一个三行修复。不是只给解码器最终的编码器状态，而是保留每个编码器状态。在每个解码器步骤，计算编码器状态的加权平均，其中权重表示"解码器现在需要看编码器位置 `i` 多少？"这个加权平均就是上下文，并且每个解码器步骤都会变化。

这就是整个想法。Transformer 扩展了它。Self-attention 将其应用于单个序列。Multi-head attention 并行运行它。但 2014 年的版本已经打破了瓶颈，一旦你掌握了它，转向 transformer 就是工程问题，而非概念问题。

## 概念

在每个解码器步骤 `t`：

1. 使用之前的解码器隐藏状态 `s_{t-1}` 作为**查询（query）**。
2. 对每个编码器隐藏状态 `h_1, ..., h_T` 打分。每个编码器位置一个标量。
3. 对分数进行 softmax，得到 attention 权重 `α_{t,1}, ..., α_{t,T}`，总和为 1。
4. 上下文向量 `c_t = Σ α_{t,i} * h_i`。编码器状态的加权平均。
5. 解码器接收 `c_t` 加上之前的输出 token，产生下一个 token。

加权平均就是关键。当解码器需要将 "Je" 翻译为 "I" 时，它将 "Je" 上的编码器状态权重设高，其他设低。当需要 "not" 时，它将 "pas" 的权重设高。上下文向量每一步都在重塑。

## 形状（最容易出错的地方）

每个 attention 实现第一次都会在这里出错。请慢慢阅读。

| 项 | 形状 | 说明 |
|-------|-------|-------|
| 编码器隐藏状态 `H` | `(T_enc, d_h)` | 如果是 BiLSTM，则 `d_h = 2 * d_hidden` |
| 解码器隐藏状态 `s_{t-1}` | `(d_s,)` | 一个向量 |
| Attention 分数 `e_{t,i}` | 标量 | 每个编码器位置一个 |
| Attention 权重 `α_{t,i}` | 标量 | 对所有 `i` 做 softmax 之后 |
| 上下文向量 `c_t` | `(d_h,)` | 与编码器状态形状相同 |

**Bahdanau（加性）分数。** `e_{t,i} = v_a^T * tanh(W_a * s_{t-1} + U_a * h_i)`。

- `s_{t-1}` 形状为 `(d_s,)`，`h_i` 形状为 `(d_h,)`。
- `W_a` 形状为 `(d_attn, d_s)`。`U_a` 形状为 `(d_attn, d_h)`。
- 它们在 tanh 内的和形状为 `(d_attn,)`。
- `v_a` 形状为 `(d_attn,)`。与 `v_a` 的点积坍缩为标量。**这就是 `v_a` 的作用。** 不是魔法。它是将注意力维度的向量转为标量分数的投影。

**Luong（乘性）分数。** 三种变体：

- `dot`：`e_{t,i} = s_t^T * h_i`。要求 `d_s == d_h`。硬约束。如果你的编码器是双向的，跳过此选项。
- `general`：`e_{t,i} = s_t^T * W * h_i`，`W` 形状为 `(d_s, d_h)`。消除了等维约束。
- `concat`：本质上就是 Bahdanau 形式。由于前两种更便宜，很少使用。

**一个值得指出的 Bahdanau / Luong 陷阱。** Bahdanau 使用 `s_{t-1}`（生成当前词*之前*的解码器状态）。Luong 使用 `s_t`（*之后*的状态）。混淆它们会产生微妙的错误梯度，极难调试。选取一篇论文并坚持其约定。

```figure
attention-heatmap
```

## 开始构建

### 第 1 步：加性（Bahdanau）attention

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

对照上表检查你的形状。`encoder_states` 形状为 `(T_enc, d_h)`。`projected_enc` 形状为 `(T_enc, d_attn)`。`projected_dec` 形状为 `(d_attn,)` 并广播。`combined` 形状为 `(T_enc, d_attn)`。`scores` 形状为 `(T_enc,)`。`weights` 形状为 `(T_enc,)`。`context` 形状为 `(d_h,)`。完成。

### 第 2 步：Luong dot 和 general

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

每个三行。这就是 Luong 的论文成功的原因。在大多数任务上准确率相同，代码少得多。

### 第 3 步：一个完整数值示例

给定三个编码器状态（大致对应 "cat"、"sat"、"mat"）和一个与第一个最对齐的解码器状态，attention 分布集中在位置 0。如果解码器状态转移到与最后一个对齐，attention 移动到位置 2。上下文向量随之变化。

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

第一行获胜。然后将解码器状态移近第三个编码器状态，观察权重变化。就是这样。Attention 就是显式对齐。

### 第 4 步：为什么这是通往 transformer 的桥梁

将上述语言翻译为 Q/K/V：

- **Query** = 解码器状态 `s_{t-1}`
- **Key** = 编码器状态（我们用来打分的对象）
- **Value** = 编码器状态（我们加权求和的对象）

在经典 attention 中，keys 和 values 是同一事物。Self-attention 将它们分开：你可以用不同的学习投影对 K 和 V 对自己查询一个序列。Multi-head attention 用不同的学习投影并行运行它。Transformer 将整个阶段叠加多次并丢弃 RNN。

数学相同。形状相同。从 Bahdanau attention 到 scaled dot-product attention 的教学跳跃主要是符号上的变化。

## 使用现成工具

PyTorch 和 TensorFlow 直接提供 attention。

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

这就是 transformer attention 层。Query 批处理 5 个位置，key/value 批处理 10 个位置，每个 128 维，8 个头。`output` 是新的上下文增强查询。`weights` 是你可以可视化的 5x10 对齐矩阵。

### 经典 attention 仍然重要的场景

- 教学。基于 RNN 的单头、单层版本让每个概念清晰可见。
- 不适合 transformer 的设备端序列任务。
- 2014-2017 年的任何论文。不了解 Bahdanau 的约定，你会误读。
- 机器翻译中的细粒度对齐分析。即使在 transformer 模型上，原始 attention 权重也是一种可解释性工具，阅读它们需要知道它们是什么。

### 将 attention 权重作为解释的陷阱

Attention 权重看起来是可解释的。它们是跨位置总和为 1 的权重；你可以绘制它们；高值意味着"看了这个"。评审者喜欢它们。

但它们并不像看起来那么可解释。Jain 和 Wallace（2019）表明，对于某些任务，attention 分布可以被置换并被任意替代方案替换而不改变模型预测。在没有消融或反事实检查的情况下，永远不要将 attention 权重报告为推理的证据。

## 交付

保存为 `outputs/prompt-attention-shapes.md`：

```markdown
---
name: attention-shapes
description: Debug shape bugs in attention implementations.
phase: 5
lesson: 10
---

Given a broken attention implementation, you identify the shape mismatch. Output:

1. Which matrix has the wrong shape. Name the tensor.
2. What its shape should be, derived from (d_s, d_h, d_attn, T_enc, T_dec, batch_size).
3. One-line fix. Transpose, reshape, or project.
4. A test to catch regressions. Typically: assert `output.shape == (batch, T_dec, d_h)` and `weights.shape == (batch, T_dec, T_enc)` and `weights.sum(dim=-1) close to 1`.

Refuse to recommend fixes that silently broadcast. Broadcast-hiding bugs surface later as silent accuracy degradation, the worst kind of attention bug.

For Bahdanau confusion, insist the decoder input is `s_{t-1}` (pre-step state). For Luong, `s_t` (post-step state). For dot-product, flag dimension mismatch between query and key as the most common first-time error.
```

## 练习

1. **简单。** 实现带掩码的 `softmax`，使编码器中的填充 token 获得 attention 权重为零。在变长序列的批处理上测试。
2. **中等。** 为 Luong `general` 形式添加 multi-head attention。将 `d_h` 拆分为 `n_heads` 组，每头运行 attention，拼接。验证单头情况与你之前的实现一致。
3. **困难。** 在第 09 课的玩具复制任务上训练带 Bahdanau attention 的 GRU 编码器-解码器。绘制准确率与序列长度的关系。与无 attention 基线进行比较。你应该看到差距随着长度增加而扩大，确认 attention 消除了瓶颈。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| Attention | 看东西 | 值序列的加权平均，权重从查询-键相似度计算。 |
| Query, Key, Value | QKV | 三个投影：Q 询问，K 是匹配对象，V 是返回内容。 |
| Additive attention | Bahdanau | 前馈分数：`v^T tanh(W q + U k)`。 |
| Multiplicative attention | Luong dot / general | 分数为 `q^T k` 或 `q^T W k`。更便宜，大多数任务上准确率相同。 |
| Alignment matrix | 漂亮的图 | 作为 `(T_dec, T_enc)` 网格的 attention 权重。阅读它来查看模型关注了什么。 |

## 延伸阅读

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) —— 论文。
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) —— 三种分数变体及其比较。
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) —— 可解释性注意事项。
- [Dive into Deep Learning —— Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) —— 使用 PyTorch 的可运行教程。
