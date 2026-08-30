# 10 · 注意力机制——突破性进展

> 解码器不再眯着眼盯着一份压缩后的摘要，而是开始审视整个源序列。从此往后的一切，都不过是注意力加上工程实现而已。

**类型：** 动手实践
**语言：** Python
**前置：** 阶段 5 · 09（序列到序列模型）
**时长：** 约 45 分钟

## 问题所在

第 09 课在一次有分寸的失败中结束。一个在玩具复制任务上训练的「GRU 编码器-解码器（GRU encoder-decoder）」，在序列长度为 5 时准确率有 89%，到长度 80 时却跌到接近随机猜测的水平。原因是结构性的，而非训练上的 bug：编码器搜集到的每一份信息都必须塞进一个固定大小的「隐藏状态（hidden state）」里，而解码器看不到别的任何东西。

Bahdanau、Cho 和 Bengio 在 2014 年发表了一个三行就能讲清的修正方案。不要只把编码器的最终状态交给解码器，而是把每一个编码器状态都保留下来。在解码器的每一步，计算编码器状态的加权平均，其权重表达的含义是「解码器此刻需要在多大程度上去看编码器位置 `i`？」这个加权平均就是「上下文（context）」，它在每一个解码步骤都会变化。

这就是全部思想。Transformer 对它做了扩展。「自注意力（self-attention）」把它应用到单个序列上。「多头注意力（multi-head attention）」让它并行运行。但 2014 年的这一版本就已经打破了瓶颈，而一旦你掌握了它，向 transformer 的转变就是工程问题，而非概念问题。

## 核心概念

〔图：Bahdanau 注意力——解码器对所有编码器状态进行查询〕

在每个解码步骤 `t`：

1. 把上一步的解码器隐藏状态 `s_{t-1}` 用作**查询（query）**。
2. 用它对每一个编码器隐藏状态 `h_1, ..., h_T` 打分。每个编码器位置得到一个标量。
3. 对这些分数做 softmax，得到注意力权重 `α_{t,1}, ..., α_{t,T}`，它们之和为 1。
4. 上下文向量 `c_t = Σ α_{t,i} * h_i`，即编码器状态的加权平均。
5. 解码器接收 `c_t` 以及上一步的输出 token，产生下一个 token。

加权平均才是关键所在。当解码器需要把「Je」翻译成「I」时，它会给「Je」对应的编码器状态高权重，给其他状态低权重。当它需要生成「not」时，它会给「pas」高权重。上下文向量在每一步都会重新塑形。

## 形状（每个人都栽过的坑）

这里正是每一份注意力实现第一次都会出错的地方。请放慢速度阅读。

| 对象 | 形状 | 说明 |
|-------|-------|-------|
| 编码器隐藏状态 `H` | `(T_enc, d_h)` | 若为 BiLSTM，则 `d_h = 2 * d_hidden` |
| 解码器隐藏状态 `s_{t-1}` | `(d_s,)` | 单个向量 |
| 注意力分数 `e_{t,i}` | 标量 | 每个编码器位置一个 |
| 注意力权重 `α_{t,i}` | 标量 | 对所有 `i` 做 softmax 之后 |
| 上下文向量 `c_t` | `(d_h,)` | 与编码器状态形状相同 |

**Bahdanau（加性）打分。** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`。

- `s_{t-1}` 形状为 `(d_s,)`，`h_i` 形状为 `(d_h,)`。
- `W_a` 形状为 `(d_attn, d_s)`，`U_a` 形状为 `(d_attn, d_h)`。
- 它们在 tanh 内部的和的形状为 `(d_attn,)`。
- `v_α` 形状为 `(d_attn,)`。与 `v_α` 做内积后塌缩为一个标量。**这就是 `v_α` 的作用。** 它并不神秘，它就是把一个注意力维度的向量投影成一个标量分数的那一步。

**Luong（乘性）打分。** 有三个变体：

- `dot`：`e_{t,i} = s_t^T * h_i`。要求 `d_s == d_h`，这是硬约束。如果你的编码器是双向的，请跳过这个变体。
- `general`：`e_{t,i} = s_t^T * W * h_i`，其中 `W` 形状为 `(d_s, d_h)`。它去掉了维度相等的约束。
- `concat`：本质上就是 Bahdanau 形式。由于前两者更廉价，它很少被使用。

**一个值得点名的 Bahdanau / Luong 陷阱。** Bahdanau 使用 `s_{t-1}`（生成当前词*之前*的解码器状态）。Luong 使用 `s_t`（*之后*的状态）。把它们搞混会产生微妙错误的梯度，极难调试。选定一篇论文，并坚持它的约定。

## 动手构建

### 第 1 步：加性（Bahdanau）注意力

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

对照上面的表格核对你的形状。`encoder_states` 形状为 `(T_enc, d_h)`。`projected_enc` 形状为 `(T_enc, d_attn)`。`projected_dec` 形状为 `(d_attn,)` 并会广播。`combined` 形状为 `(T_enc, d_attn)`。`scores` 形状为 `(T_enc,)`。`weights` 形状为 `(T_enc,)`。`context` 形状为 `(d_h,)`。可以交付。

### 第 2 步：Luong 的 dot 与 general

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

每个各三行。这正是 Luong 那篇论文站稳脚跟的原因。在大多数任务上准确率相同，代码却少得多。

### 第 3 步：一个完整的数值示例

给定三个编码器状态（大致对应「cat」「sat」「mat」）以及一个与第一个最对齐的解码器状态，注意力分布会集中到位置 0。如果解码器状态变为与最后一个对齐，注意力就会移动到位置 2。上下文向量随之跟踪变化。

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

第一行胜出。然后把解码器状态移到更接近第三个编码器状态，观察权重如何随之偏移。就是这样。注意力就是显式的对齐。

### 第 4 步：为什么这是通往 transformer 的桥梁

把上面的语言翻译成 Q/K/V：

- **查询（Query）** = 解码器状态 `s_{t-1}`
- **键（Key）** = 编码器状态（我们用来打分的对象）
- **值（Value）** = 编码器状态（我们用来加权求和的对象）

在经典注意力中，键和值是同一个东西。自注意力把它们分开：你可以让一个序列对它自身进行查询，并为 K 和 V 使用不同的可学习投影。多头注意力则用不同的可学习投影并行运行它。Transformer 把整个阶段堆叠很多层，并彻底丢掉了 RNN。

数学是一样的。形状是一样的。从 Bahdanau 注意力到「缩放点积注意力（scaled dot-product attention）」的教学跨越，主要只是记号上的差异。

## 实际使用

PyTorch 和 TensorFlow 都直接内置了注意力。

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

这就是一个 transformer 注意力层。查询批次有 5 个位置，键/值批次有 10 个位置，每个均为 128 维，共 8 个头。`output` 是新的、经过上下文增强的查询。`weights` 是那个 5x10 的对齐矩阵，你可以将其可视化。

### 经典注意力在何时仍然重要

- 教学。单头、单层、基于 RNN 的版本能让每一个概念都清晰可见。
- 那些 transformer 装不下的端侧序列任务。
- 任何 2014–2017 年的论文。不懂 Bahdanau 的约定，你就会误读它。
- 机器翻译中的细粒度对齐分析。即便是在 transformer 模型上，原始注意力权重也是一种可解释性工具，而要读懂它们就需要知道它们到底是什么。

### 「把注意力权重当作解释」的陷阱

注意力权重看起来很可解释。它们是在各个位置上求和为一的权重；你可以把它们画出来；权重高就意味着「看了这里」。审稿人很喜欢它们。

但它们并不像看上去那么可解释。Jain 和 Wallace（2019）证明，对某些任务而言，注意力分布可以被置换、被任意的替代方案取代，而不改变模型的预测。在没有做消融或反事实检验的情况下，绝不要把注意力权重当作推理过程的证据来汇报。

## 交付成果

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

1. **简单。** 实现带掩码的 `softmax`，让编码器中的填充 token 获得零注意力权重。在一个含变长序列的批次上测试。
2. **中等。** 给 Luong 的 `general` 形式加上多头注意力。把 `d_h` 切分成 `n_heads` 组，逐头运行注意力，再拼接起来。验证单头情形与你早先的实现一致。
3. **困难。** 用带 Bahdanau 注意力的 GRU 编码器-解码器，在第 09 课的玩具复制任务上训练。绘制准确率随序列长度变化的曲线。与无注意力的基线作对比。你应当看到差距随长度增长而拉大，这就证实了注意力抬高了瓶颈。

## 关键术语

| 术语 | 人们常这么说 | 它实际的含义 |
|------|-----------------|-----------------------|
| 注意力（Attention） | 去看某些东西 | 对一个值序列的加权平均，权重由查询-键相似度计算得出。 |
| 查询、键、值（Query, Key, Value） | QKV | 三个投影：Q 负责发问，K 是被匹配的对象，V 是被返回的对象。 |
| 加性注意力（Additive attention） | Bahdanau | 前馈式打分：`v^T tanh(W q + U k)`。 |
| 乘性注意力（Multiplicative attention） | Luong dot / general | 分数为 `q^T k` 或 `q^T W k`。更廉价，且在大多数任务上准确率相同。 |
| 对齐矩阵（Alignment matrix） | 那张漂亮的图 | 排成 `(T_dec, T_enc)` 网格的注意力权重。读它就能看出模型关注了什么。 |

## 延伸阅读

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) —— 原始论文。
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) —— 三种打分变体及其对比。
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) —— 可解释性方面的告诫。
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) —— 可运行的 PyTorch 演练。
