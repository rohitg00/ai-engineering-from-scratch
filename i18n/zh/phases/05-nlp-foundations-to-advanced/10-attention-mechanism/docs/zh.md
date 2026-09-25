# 注意力机制 — 突破性进展

> 解码器不再费力地盯着一个压缩后的摘要，而是开始查看整个源序列。此后的所有内容都是注意力加上工程实现。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 09(序列到序列模型)
**Time:** 约 45 分钟

## 问题所在

第 09 课以一次可量化的失败告终。在玩具复制任务上训练的 GRU 编码器-解码器，在长度为 5 时准确率为 89%,而在长度为 80 时接近随机水平。原因是结构性的，而不是训练 bug:编码器获取的每一点信息都必须塞进一个固定大小的隐藏状态中，而解码器再也看不到其他任何东西。

Bahdanau、Cho 和 Bengio 在 2014 年发表了一个三行代码式的修复方案。不要只给解码器最终的编码器状态，而是保留所有编码器状态。在解码器的每一步，计算编码器状态的加权平均，其中权重表示“解码器现在需要多关注编码器位置 `i` 的程度？”这个加权平均就是上下文，并且它在解码器的每一步都会变化。

这就是全部思想。Transformer 对其进行了扩展。Self-attention 将其应用于单个序列。Multi-head attention 将其并行化。但 2014 年的版本就已经打破了瓶颈，一旦你掌握了它，向 Transformer 的转变就是工程问题，而非概念问题。

## 核心概念

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

在解码器的每一步 `t`:

1. 使用上一步的解码器隐藏状态 `s_{t-1}` 作为 **query**。
2. 将其与每个编码器隐藏状态 `h_1, ..., h_T` 打分。每个编码器位置一个标量。
3. 对分数做 softmax,得到和为 1 的注意力权重 `α_{t,1}, ..., α_{t,T}`。
4. 上下文向量 `c_t = Σ α_{t,i} * h_i`:编码器状态的加权平均。
5. 解码器接收 `c_t` 加上一个输出 token,产生下一个 token。

加权平均是关键。当解码器需要把 "Je" 翻译成 "I" 时，它给 "Je" 对应的编码器状态很高的权重，其他状态权重很低。当它需要 "not" 时，它给 "pas" 高权重。上下文向量在每一步都被重塑。

## 形状(最容易坑人的地方)

这是每个注意力实现第一次都会出错的地方。请慢慢阅读。

| 对象 | 形状 | 说明 |
|-------|-------|-------|
| 编码器隐藏状态 `H` | `(T_enc, d_h)` | 如果是 BiLSTM,则为 `d_h = 2 * d_hidden` |
| 解码器隐藏状态 `s_{t-1}` | `(d_s,)` | 单个向量 |
| 注意力分数 `e_{t,i}` | 标量 | 每个编码器位置一个 |
| 注意力权重 `α_{t,i}` | 标量 | 对所有 `i` 做 softmax 之后 |
| 上下文向量 `c_t` | `(d_h,)` | 与单个编码器状态形状相同 |

**Bahdanau(加性)分数。** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`。

- `s_{t-1}` 的形状为 `(d_s,)`,`h_i` 的形状为 `(d_h,)`。
- `W_a` 的形状为 `(d_attn, d_s)`。`U_a` 的形状为 `(d_attn, d_h)`。
- 它们在 tanh 内部相加后的形状为 `(d_attn,)`。
- `v_α` 的形状为 `(d_attn,)`。与 `v_α` 的内积坍缩为一个标量。**这就是 `v_α` 所做的事情。** 它并不神秘。它就是把注意力维度的向量投影为标量分数的投影层。

**Luong(乘性)分数。** 三种变体：

- `dot`:`e_{t,i} = s_t^T * h_i`。要求 `d_s == d_h`。硬性约束。如果编码器是双向的，请跳过。
- `general`:`e_{t,i} = s_t^T * W * h_i`,其中 `W` 的形状为 `(d_s, d_h)`。消除了等维度约束。
- `concat`:本质上是 Bahdanau 形式。由于前两种更便宜，很少使用。

**一个值得指出的 Bahdanau / Luong 陷阱。** Bahdanau 使用 `s_{t-1}`(生成当前单词*之前*的解码器状态)。Luong 使用 `s_t`(*之后*的状态)。搞混它们会产生微妙错误的梯度，极难调试。选定一篇论文并坚持其约定。

```figure
attention-heatmap
```

## 动手实现

### 步骤 1:加性(Bahdanau)注意力

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

对照上表检查你的形状。`encoder_states` 的形状为 `(T_enc, d_h)`。`projected_enc` 的形状为 `(T_enc, d_attn)`。`projected_dec` 的形状为 `(d_attn,)` 且可广播。`combined` 的形状为 `(T_enc, d_attn)`。`scores` 的形状为 `(T_enc,)`。`weights` 的形状为 `(T_enc,)`。`context` 的形状为 `(d_h,)`。收工。

### 步骤 2:Luong 的 dot 和 general

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

每种只需三行代码。这就是 Luong 的论文能产生影响力的原因。在大多数任务上准确率相同，代码却少得多。

### 步骤 3:一个数值演算示例

给定三个编码器状态(大致对应 "cat"、"sat"、"mat")和一个与第一个对齐程度最高的解码器状态，注意力分布集中在位置 0。如果解码器状态移动到与最后一个对齐，注意力就移到位置 2。上下文向量随之变化。

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

第一行胜出。然后把解码器状态移近第三个编码器状态，观察权重的转移。就是这样。注意力就是显式的对齐。

### 步骤 4:为什么这是通往 Transformer 的桥梁

把上面的语言翻译成 Q/K/V:

- **Query** = 解码器状态 `s_{t-1}`
- **Key** = 编码器状态(我们要打分的对象)
- **Value** = 编码器状态(我们要加权求和的对象)

在经典注意力中，key 和 value 是同一个东西。Self-attention 将它们分离：你可以让一个序列对自身进行查询，K 和 V 使用不同的可学习投影。Multi-head attention 使用不同的可学习投影并行运行这一过程。Transformer 将整个流程堆叠很多层，并去掉 RNN。

数学是一样的。形状是一样的。从 Bahdanau 注意力到 scaled dot-product attention 的教学跨越，主要是记号上的差异。

## 使用现成实现

PyTorch 和 TensorFlow 都直接提供了注意力机制。

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

这就是一个 Transformer 注意力层。对 5 个位置的 query 批次、10 个位置的 key/value 批次进行操作，每个 128 维，8 个头。`output` 是新的、融合了上下文的 query。`weights` 是可以可视化的 5x10 对齐矩阵。

### 经典注意力仍然重要的场景

- 教学价值。单头、单层、基于 RNN 的版本让每个概念都清晰可见。
- Transformer 无法适配的设备端序列任务。
- 2014-2017 年的任何论文。不了解 Bahdanau 的约定，你就会误读它们。
- 机器翻译中的细粒度对齐分析。原始注意力权重即使在 Transformer 模型上也是一种可解释性工具，而解读它们需要知道它们是什么。

### “注意力权重即解释”的陷阱

注意力权重看起来是可解释的。它们是在各个位置上和为 1 的权重；你可以绘制它们；高值意味着“关注了这里”。审稿人喜欢它们。

但它们并不像看起来那么可解释。Jain 和 Wallace(2019)证明，在某些任务上，注意力分布可以被置换并替换为任意替代分布，而不会改变模型的预测。在没有消融实验或反事实检验的情况下，切勿将注意力权重作为推理过程的证据。

## 交付

保存为 `outputs/prompt-attention-shapes.md`:

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

1. **简单。** 实现 `softmax` 掩码，使编码器中的填充 token 的注意力权重为零。在一个包含变长序列的批次上进行测试。
2. **中等。** 为 Luong 的 `general` 形式添加多头注意力。将 `d_h` 拆分为 `n_heads` 组，每个头分别运行注意力，然后拼接。验证单头情形与你之前的实现结果一致。
3. **困难。** 在第 09 课的玩具复制任务上，训练一个带 Bahdanau 注意力的 GRU 编码器-解码器。绘制准确率随序列长度的变化曲线。与无注意力基线进行对比。你应该会看到随着长度增长差距拉大，从而证实注意力突破了瓶颈。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Attention | 看着某些东西 | 对一个 value 序列做加权平均，权重由 query-key 相似度计算得出。 |
| Query, Key, Value | QKV | 三个投影:Q 提问,K 是用来匹配的内容,V 是要返回的内容。 |
| 加性注意力 | Bahdanau | 前馈分数:`v^T tanh(W q + U k)`。 |
| 乘性注意力 | Luong dot / general | 分数为 `q^T k` 或 `q^T W k`。更便宜，在大多数任务上准确率相同。 |
| 对齐矩阵 | 那张漂亮的图 | 以 `(T_dec, T_enc)` 网格形式呈现的注意力权重。通过阅读它来了解模型关注了什么。 |

## 延伸阅读

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — 原始论文。
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) — 三种分数变体及其对比。
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) — 关于可解释性的警示。
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) — 基于 PyTorch 的可运行教程。