# 关注机制 突破

> 解码器停止眼看压缩的摘要,开始查看整个来源.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 09 (Sequence-to-Sequence Models)
**Time:** ~45 minutes

## 问题

课程09结束时出现了测量故障.在玩具复制任务上训练的GRU编码器-解码器从89%的精度在长度5到近巧的长度80的原因是结构性,而不是训练错误:编码器收集的每一点信息都必须合适于一个固体尺寸的隐藏状态,解码器从来没有看到任何其他东西.

巴哈达纳,乔和孟基奥于2014年发布了一项三行修正.而不是给解码器只给出最后的编码器状态,保持每个编码器状态.在每个编码器步骤上,计算一个权重平均的编码器状态,重量说"解码器需要看多少编码器位置.`i`这就是重量平均的背景,它改变了每一步的解码器.

这就是整个想法.变压器扩展了它.自我注意力将它应用到单个序列上.多头注意力并行运行它.但2014版本已经打破了瓶,一旦你得到了它,变压器的枢纽是工程,而不是概念.

## 概念

![Bahdanau attention: decoder queries all encoder states](../assets/attention.svg)

在每个解码器步骤中`t`其他:

1. 使用之前的解码器隐藏状态`s_{t-1}`作为一个**query**现在,我们要去.
2. 给每一个编码器隐藏状态进行评分`h_1, ..., h_T`每个编码器位置都有一个 skalar.
3. 软max的分数以获得注意力重量`α_{t,1}, ..., α_{t,T}`总数为1.
4. 文本向量`c_t = Σ α_{t,i} * h_i`编码器状态的权重平均值.
5. 解码器需要`c_t`另外一个输出代币,产生了下一个代币.

权重平均值是点.当解码器需要将"Je"转换为"I",它重量化码器状态为"Je"高,其他的低.当它需要"不",它重量化"pas"高.文本向量重量化每个步骤.

## 形状 (咬人所有的人)

这就是每次注意力实施的第一次错误.

| Thing | Shape | Notes |
|-------|-------|-------|
| Encoder hidden states `H` | `(T_enc, d_h)` | If BiLSTM, `d_h = 2 * d_hidden` |
| Decoder hidden state `s_{t-1}` | `(d_s,)` | One vector |
| Attention score `e_{t,i}` | scalar | One per encoder position |
| Attention weight `α_{t,i}` | scalar | After softmax over all `i` |
| Context vector `c_t` | `(d_h,)` | Same shape as an encoder state |

**Bahdanau (additive) score.** `e_{t,i} = v_α^T * tanh(W_a * s_{t-1} + U_a * h_i)`现在,我们要去.

- `s_{t-1}`具有形状`(d_s,)`现在`h_i`具有形状`(d_h,)`现在,我们要去.
- `W_a`具有形状`(d_attn, d_s)`现在,我们要去.`U_a`具有形状`(d_attn, d_h)`现在,我们要去.
- 它们的子里面的积分有形状.`(d_attn,)`现在,我们要去.
- `v_α`具有形状`(d_attn,)`内部产品与`v_α`升到一个度.**This is what `v_α` does.**它们不是魔法,而是投影,使注意力光向量变成了尺度分数.

**Luong (multiplicative) score.**它们有三个变体:

- `dot`其他`e_{t,i} = s_t^T * h_i`需要`d_s == d_h`如果你的编码器是双向的,就跳过.
- `general`其他`e_{t,i} = s_t^T * W * h_i`随着`W`形状`(d_s, d_h)`消除了同等度的限制.
- `concat`基本上是巴哈达努形式.

**One Bahdanau / Luong gotcha worth naming.**巴哈达努使用`s_{t-1}`路恩使用了 语,`s_t`它们混合后,产生了微妙的错误梯度,非常难以调试.

```figure
attention-heatmap
```

## 建立它

### 步骤1:添加剂 (Bahdanau) 注意

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

检查你的形状与上面的表.`encoder_states`具有形状`(T_enc, d_h)`现在,我们要去.`projected_enc`具有形状`(T_enc, d_attn)`现在,我们要去.`projected_dec`具有形状`(d_attn,)`广播.`combined`具有形状`(T_enc, d_attn)`现在,我们要去.`scores`具有形状`(T_enc,)`现在,我们要去.`weights`具有形状`(T_enc,)`现在,我们要去.`context`具有形状`(d_h,)`运送它.

### 步骤2: 卢昂点和一般

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

由于这就是为什么卢昂的论文登陆了. 在大多数任务上,相同的准确性,更少的代码.

### 步骤3:一个工作的数值示例

鉴于有三个编码状态 (大致是"猫","卫星","") 和一个与第一个最一致的编码状态,注意力分布集中在位置0. 如果编码状态转向最后的位置,注意力将转移到位置2.

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

首先是获胜的,然后把解码器状态移到第三个编码器状态,然后观察重量转移.

### 步骤4:为什么这就是转换器的桥梁

翻译上述语言为Q/K/V:

- **Query**= 解码器状态`s_{t-1}`
- **Key**= 编码状态 (我们对比的分数)
- **Value**=编码状态 (我们重量和总数)

在经典的注意力中,密钥和值是一样的.自我注意力分开它们:你可以对一个序列进行查询,使用不同的学习投影为K和V.多头注意力与不同的学习投影并行运行.变压器堆叠整个阶段多次,然后放下RNN.

数学是相同的.形状是相同的.从巴哈达纳注意力到扩展点产品注意力的教学跳跃主要是符号.

## 用它

鱼和鱼流直接送上注意力.

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

查询组5个位置,关键/值组10个位置,每个128个,8个头.`output`对于这些问题来说,`weights`它们是5×10的对齐矩阵,

### 当古典的注意力仍然重要时

- 单头,单层,基于RNN的版本使每个概念都可见.
- 变压器不适合的设备上序列任务.
- 你会错误地读到任何2014-2017年报纸,
- 精细的对齐分析在MT中. 粗的注意力重量即使在变压器模型上也是一个可解释的工具,

### 关注重量作为解释陷

关注重量看起来可以解释.它们是重量,可以在一个位置上加起来;你可以绘制它们;高意味着"看到了这个".评论家喜欢它们.

简和瓦莱斯 (2019) 表明,注意力分布可以通过任意替代品来改变,而不会改变某些任务的模型预测.永远不要报告注意力重量作为没有抽象或反事实检查的推理证据.

## 运送它

保存如`outputs/prompt-attention-shapes.md`其他:

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

## 运动

1. **Easy.**实施`softmax`测试一批具有变长序列的批量.
2. **Medium.**增加多头关注的路昂`general`形式,分开`d_h`进入`n_heads`检查单头案例是否符合您的早期实施.
3. **Hard.**训练一个GRU编码器-解码器,用巴哈达纳注意力从第09课开始的玩具复制任务. 剧情精度与序列长度. 与没有注意力基线相比较.随着长度的增加,你应该看到差距扩大,确认注意力提高了瓶.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Attention | Looking at things | Weighted average of a value sequence, weights computed from a query-key similarity. |
| Query, Key, Value | QKV | Three projections: Q asks, K is what to match, V is what to return. |
| Additive attention | Bahdanau | Feed-forward score: `v^T tanh(W q + U k)`. |
| Multiplicative attention | Luong dot / general | Score is `q^T k` or `q^T W k`. Cheaper, same accuracy on most tasks. |
| Alignment matrix | The pretty picture | Attention weights as a `(T_dec, T_enc)` grid. Read it to see what the model attended to. |

## 进一步阅读

- [Bahdanau, Cho, Bengio (2014). Neural Machine Translation by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473)报纸.
- [Luong, Pham, Manning (2015). Effective Approaches to Attention-based Neural Machine Translation](https://arxiv.org/abs/1508.04025)三种分数变体及其比较.
- [Jain and Wallace (2019). Attention is not Explanation](https://arxiv.org/abs/1902.10186)可解释性警告.
- [Dive into Deep Learning — Bahdanau Attention](https://d2l.ai/chapter_attention-mechanisms-and-transformers/bahdanau-attention.html)可用 PyTorch 进行通行.
