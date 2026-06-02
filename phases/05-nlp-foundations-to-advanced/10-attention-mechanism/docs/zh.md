# Attention 机制 —— 真正的突破

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> decoder 不再眯着眼盯一份压缩过的摘要，而是开始看向整个源序列。这之后的一切，都是 attention（注意力）加上工程实现。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## 问题（The Problem）

第 09 课以一次有分寸的失败收尾。一个 GRU encoder-decoder 在玩具 copy 任务上训练，长度 5 时准确率 89%，长度 80 时几乎掉到随机猜测水平。原因是结构性的，不是训练 bug：encoder 提取到的所有信息都得塞进一个固定大小的 hidden state，而 decoder 也只能看到这一个 state，别的什么都看不到。

Bahdanau、Cho、Bengio 在 2014 年发表了一个三行就能讲清的修补方案。不要只把 encoder 的最终 state 给 decoder，而是把每一个 encoder state 都留下来。在 decoder 的每一步，对 encoder state 做一次加权平均，权重表达的是「decoder 现在到底要看 encoder 第 `i` 个位置多少？」这个加权平均就是 context（上下文），并且每个 decoder step 都不一样。

这就是全部的 idea。Transformer 把它扩展了。Self-attention 把它应用到单个序列上。Multi-head attention 把它并行化。但 2014 年那一版就已经打破了 bottleneck（瓶颈），有了它之后，从 Bahdanau attention 到 transformer 的跳跃就只是工程，不再是概念上的飞跃。

## 概念（The Concept）

![Bahdanau attention：decoder 向所有 encoder state 发起 query](../assets/attention.svg)

在每个 decoder step `t`：

1. 把上一步的 decoder hidden state `s_{t-1}` 当作 **query**。
2. 用它对每个 encoder hidden state `h_1, ..., h_T` 打分。每个 encoder 位置得到一个标量。
3. 对这些分数做 softmax，得到 attention 权重 `α_{t,1}, ..., α_{t,T}`，加和为 1。
4. context 向量 `c_t = Σ α_{t,i} * h_i`。也就是 encoder state 的加权平均。
5. decoder 拿到 `c_t` 加上上一个输出 token，生成下一个 token。

加权平均才是关键。当 decoder 要把 “Je” 翻成 “I” 时，它给 “Je” 对应的 encoder state 高权重，其他的低权重。要翻 “not” 时，它给 “pas” 高权重。context 向量在每一步都被重塑。

## Shape（每个人都会被坑一次）

每个 attention 实现第一次写都会在这里出错。慢慢读。

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | 如果是 BiLSTM，`d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | 一个向量 |
| Attention score `e_{t,i}` | scalar | 每个 encoder 位置一个 |
| Attention weight `α_{t,i}` | scalar | 在所有 `i` 上 softmax 之后 |
| Context vector `c_t` | `(d_h,)` | 与 encoder state 同 shape |

**Bahdanau（additive，加性）打分函数。** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`。

- `s_{t-1}` shape 是 `(d_s,)`，`h_i` shape 是 `(d_h,)`。
- `W_a` shape 是 `(d_attn, d_s)`。`U_a` shape 是 `(d_attn, d_h)`。
- 它们在 tanh 里相加之后 shape 是 `(d_attn,)`。
- `v_α` shape 是 `(d_attn,)`。和 `v_α` 做内积把它压缩成一个标量。**这就是 `v_α` 的作用。** 没什么神秘的，就是一个把 attention-dim 向量投影成标量分数的投影。

**Luong（multiplicative，乘性）打分函数。** 三种变体：

- `dot`：`e_{t,i} = s_t^T * h_i`。要求 `d_s == d_h`。这是硬约束。如果 encoder 是双向的，跳过这个变体。
- `general`：`e_{t,i} = s_t^T * W * h_i`，`W` shape 是 `(d_s, d_h)`。去掉了维度相等的约束。
- `concat`：本质上就是 Bahdanau 那个形式。前两种更便宜，所以这个很少用。

**一个值得点名的 Bahdanau / Luong 坑。** Bahdanau 用的是 `s_{t-1}`（生成当前词*之前*的 decoder state）。Luong 用的是 `s_t`（生成当前词*之后*的 state）。混用会产生微妙错误的梯度，极难 debug。挑一篇 paper，按它的约定走到底。

## 动手实现（Build It）

### Step 1：additive（Bahdanau）attention

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

对照上面的表格检查 shape。`encoder_states` 是 `(T_enc, d_h)`。`projected_enc` 是 `(T_enc, d_attn)`。`projected_dec` 是 `(d_attn,)`，靠 broadcast 生效。`combined` 是 `(T_enc, d_attn)`。`scores` 是 `(T_enc,)`。`weights` 是 `(T_enc,)`。`context` 是 `(d_h,)`。发车。

### Step 2：Luong dot 和 general

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

每个三行。这就是 Luong 那篇论文站住脚的原因。在大多数任务上准确率相同，代码量却少很多。

### Step 3：一个数值化的算例

给三个 encoder state（粗略对应 “cat”、“sat”、“mat”）和一个最贴近第一个的 decoder state，attention 分布会集中在位置 0。如果把 decoder state 调整成贴近最后一个，attention 就会移到位置 2。context 向量会跟着变。

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

第一行胜出。然后把 decoder state 移到更靠近第三个 encoder state，看权重怎么变。就这么回事。attention 就是显式的对齐。

### Step 4：为什么这就是通往 transformer 的桥梁

把上面的语言翻成 Q/K/V：

- **Query** = decoder state `s_{t-1}`
- **Key** = encoder state（用来打分的对象）
- **Value** = encoder state（用来加权求和的对象）

在经典 attention 里，key 和 value 是同一个东西。Self-attention 把它们分开：你可以让一个序列对它自己做 query，K 和 V 各自有不同的可学习投影。Multi-head attention 用不同的可学习投影把它并行化。Transformer 把整个阶段堆很多层，并且把 RNN 丢掉。

数学是一样的。shape 是一样的。从 Bahdanau attention 跳到 scaled dot-product attention，主要是 notation（记号）的差异。

## 用起来（Use It）

PyTorch 和 TensorFlow 都直接提供 attention。

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

这就是一层 transformer attention。query 是 5 个位置一批，key/value 是 10 个位置一批，每个 128 维，8 个 head。`output` 是被 context 增强过的新 query。`weights` 是那个 5x10 的对齐矩阵，可以可视化出来。

### 经典 attention 仍然重要的场合

- 教学。单 head、单层、基于 RNN 的版本能把每个概念都暴露出来。
- 端侧序列任务，transformer 装不下。
- 任何 2014–2017 年的 paper。不知道 Bahdanau 的约定，你就会读错。
- 机器翻译里的细粒度对齐分析。原始 attention 权重在 transformer 模型上仍然是一个可解释性工具，要会读它就得知道它到底是什么。

### 「把 attention 权重当解释」的陷阱

Attention 权重看上去很可解释。它们是在所有位置上加和为 1 的权重；你能画出来；高就意味着「看这个位置看得多」。审稿人喜欢。

它们其实没看上去那么可解释。Jain 和 Wallace（2019）证明了，对某些任务，attention 分布可以被任意置换或替换为别的分布，而模型预测不变。永远不要在没有 ablation（消融实验）或反事实验证的情况下，把 attention 权重当作模型推理过程的证据。

## 上线部署（Ship It）

存为 `outputs/prompt-attention-shapes.md`：

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

## 练习（Exercises）

1. **Easy.** 实现 `softmax` 的 mask 版本，让 encoder 里的 padding token 拿到的 attention 权重为 0。在变长序列的 batch 上测试。
2. **Medium.** 给 Luong 的 `general` 形式加上 multi-head attention。把 `d_h` 切成 `n_heads` 组，每个 head 各跑一次 attention，再 concat。验证 single-head 情况下结果与你之前的实现一致。
3. **Hard.** 用 Bahdanau attention 在第 09 课的玩具 copy 任务上训一个 GRU encoder-decoder。画出准确率随序列长度的曲线。和无 attention 的 baseline（基线）做对比。你应该会看到长度变长后差距越拉越大，这就证明 attention 把 bottleneck 抬起来了。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Attention | 「看一眼某些东西」 | 一个 value 序列的加权平均，权重由 query-key 的相似度算出。 |
| Query, Key, Value | QKV | 三个投影：Q 发问，K 用来匹配，V 用来返回。 |
| Additive attention | Bahdanau | 前馈式打分：`v^T tanh(W q + U k)`。 |
| Multiplicative attention | Luong dot / general | 打分是 `q^T k` 或 `q^T W k`。更便宜，多数任务上准确率相同。 |
| Alignment matrix | 那张好看的图 | attention 权重画成 `(T_dec, T_enc)` 的网格。读它就能看到模型关注了哪里。 |

## 延伸阅读（Further Reading）

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) — 原始论文。
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025) — 三种打分变体及其对比。
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186) — 可解释性方面的告诫。
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html) — 可运行的 PyTorch 走读。
