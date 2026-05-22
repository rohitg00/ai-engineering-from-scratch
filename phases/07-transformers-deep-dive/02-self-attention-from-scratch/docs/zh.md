# 从头实现自注意力（Self-Attention）

> 注意力机制（Attention）就像一个查找表，每个词都会问“谁对我重要？”——然后学习到答案。

**类型：** 实践构建
**语言：** Python
**前置知识：** 阶段3（深度学习核心），阶段5第10课（序列到序列）
**时长：** 约90分钟

## 学习目标

- 仅使用 NumPy 从零实现缩放点积自注意力（Scaled Dot-Product Self-Attention），包括查询/键/值投影和 Softmax 加权求和
- 构建一个多头注意力（Multi-Head Attention）层，能够拆分头、并行计算注意力，并将结果拼接
- 追溯注意力矩阵如何捕获词元（Token）之间的关系，并解释为何除以 sqrt(d_k) 能防止 Softmax 饱和
- 应用因果掩码（Causal Masking）将双向注意力转换为自回归（解码器风格）注意力

## 问题

循环神经网络（RNN）一次处理一个词元。当你到达第50个词元时，来自第1个词元的信息已经经过了50次压缩步骤。长距离依赖被压缩成一个固定大小的隐藏状态——这个瓶颈即使 LSTM 的门控也无法完全解决。

2014年 Bahdanau 的注意力论文给出了解决方案：让解码器（Decoder）回看每一个编码器（Encoder）位置，并决定哪些位置对当前步骤重要。但它仍然依附在 RNN 上。2017年的论文《Attention Is All You Need》提出了一个更尖锐的问题：如果注意力是*唯一*的机制呢？没有循环，没有卷积，只有注意力。

自注意力让序列中的每个位置在单个并行步骤中关注所有其他位置。这就是 Transformer 快速、可扩展且占据主导地位的原因。

## 概念

### 数据库查找类比

将注意力视为一种软性数据库查找：

```
传统数据库：
  查询："法国的首都"  -->  精确匹配  -->  "巴黎"

注意力：
  查询："法国的首都"  -->  与所有键的相似度  -->  所有值的加权混合
```

每个词元生成三个向量：
- **查询（Query, Q）**：“我在找什么？”
- **键（Key, K）**：“我包含什么？”
- **值（Value, V）**：“如果被选中，我提供什么信息？”

查询与所有键的点积产生注意力分数（Attention Scores）。高分数意味着“这个键匹配我的查询”。这些分数对值进行加权。输出是值的加权和。

### Q、K、V 的计算

每个词元嵌入通过三个可学习的权重矩阵进行投影：

```
输入嵌入（序列包含 n 个词元，每个 d 维）：

  X = [x1, x2, x3, ..., xn]       形状：(n, d)

三个权重矩阵：

  Wq  形状：(d, dk)
  Wk  形状：(d, dk)
  Wv  形状：(d, dv)

投影：

  Q = X @ Wq    形状：(n, dk)     每个词元的查询
  K = X @ Wk    形状：(n, dk)     每个词元的键
  V = X @ Wv    形状：(n, dv)     每个词元的值
```

可视化一个词元：

```
             Wq
  x_i ------[*]------> q_i    "我在找什么？"
       |
       |     Wk
       +----[*]------> k_i    "我包含什么？"
       |
       |     Wv
       +----[*]------> v_i    "我提供什么？"
```

### 注意力矩阵

一旦你得到所有词元的 Q、K、V，注意力分数形成一个矩阵：

```
分数 = Q @ K^T    形状：(n, n)

              k1    k2    k3    k4    k5
        +-----+-----+-----+-----+-----+
   q1   | 2.1 | 0.3 | 0.1 | 0.8 | 0.2 |   <- q1 对每个键的关注程度
        +-----+-----+-----+-----+-----+
   q2   | 0.4 | 1.9 | 0.7 | 0.1 | 0.3 |
        +-----+-----+-----+-----+-----+
   q3   | 0.2 | 0.6 | 2.3 | 0.5 | 0.1 |
        +-----+-----+-----+-----+-----+
   q4   | 0.9 | 0.1 | 0.4 | 1.7 | 0.6 |
        +-----+-----+-----+-----+-----+
   q5   | 0.1 | 0.3 | 0.2 | 0.5 | 2.0 |
        +-----+-----+-----+-----+-----+

每一行：一个词元对整个序列的注意力
```

### 为何要缩放？

点积的值会随着维度 dk 增大而增大。如果 dk = 64，点积的范围可能达到几十，将 Softmax 推入梯度消失的区域。解决办法：除以 sqrt(dk)。

```
缩放后的分数 = (Q @ K^T) / sqrt(dk)
```

这使数值保持在 Softmax 能产生有效梯度的范围内。

### Softmax 将分数转化为权重

Softmax 将原始分数转换为每一行的概率分布：

```
q1 的原始分数：   [2.1, 0.3, 0.1, 0.8, 0.2]
                            |
                         softmax
                            |
注意力权重：   [0.52, 0.09, 0.07, 0.14, 0.08]   （总和约 1.0）
```

现在每个词元都有一组权重，表示它关注其他每个词元的程度。

### 值的加权和

每个词元的最终输出是所有值向量的加权和：

```
output_i = sum( attention_weight[i][j] * v_j  for all j )

对于词元 1：
  output_1 = 0.52 * v1 + 0.09 * v2 + 0.07 * v3 + 0.14 * v4 + 0.08 * v5
```

### 完整流程

```
                    +-------+
  X (输入)  ----->|  @ Wq  |-----> Q
                    +-------+
                    +-------+
  X (输入)  ----->|  @ Wk  |-----> K
                    +-------+                     +----------+
                    +-------+                     |          |
  X (输入)  ----->|  @ Wv  |-----> V ---------->| 加权和   |----> 输出
                    +-------+          ^          |          |
                                       |          +----------+
                              +--------+--------+
                              |    softmax      |
                              +---------+-------+
                                        ^
                              +---------+-------+
                              | Q @ K^T / sqrt  |
                              +-----------------+
```

一行公式：

```
Attention(Q, K, V) = softmax( Q @ K^T / sqrt(dk) ) @ V
```

## 动手构建

### 步骤 1：从头实现 Softmax

Softmax 将原始 logits 转换为概率。减去最大值以保证数值稳定性。

```python
import numpy as np

def softmax(x):
    shifted = x - np.max(x, axis=-1, keepdims=True)
    exp_x = np.exp(shifted)
    return exp_x / np.sum(exp_x, axis=-1, keepdims=True)

logits = np.array([2.0, 1.0, 0.1])
print(f"logits:  {logits}")
print(f"softmax: {softmax(logits)}")
print(f"sum:     {softmax(logits).sum():.4f}")
```

### 步骤 2：缩放点积注意力

核心函数。接收 Q、K、V 矩阵，返回注意力输出和权重矩阵。

```python
def scaled_dot_product_attention(Q, K, V):
    dk = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(dk)
    weights = softmax(scores)
    output = weights @ V
    return output, weights
```

### 步骤 3：带可学习投影的自注意力类

完整的自注意力模块，包含 Wq、Wk、Wv 权重矩阵，使用类似 Xavier 的缩放初始化。

```python
class SelfAttention:
    def __init__(self, d_model, dk, dv, seed=42):
        rng = np.random.default_rng(seed)
        scale = np.sqrt(2.0 / (d_model + dk))
        self.Wq = rng.normal(0, scale, (d_model, dk))
        self.Wk = rng.normal(0, scale, (d_model, dk))
        scale_v = np.sqrt(2.0 / (d_model + dv))
        self.Wv = rng.normal(0, scale_v, (d_model, dv))
        self.dk = dk

    def forward(self, X):
        Q = X @ self.Wq
        K = X @ self.Wk
        V = X @ self.Wv
        output, weights = scaled_dot_product_attention(Q, K, V)
        return output, weights
```

### 步骤 4：在句子上运行

为句子创建假嵌入，观察注意力权重。

```python
sentence = ["The", "cat", "sat", "on", "the", "mat"]
n_tokens = len(sentence)
d_model = 8
dk = 4
dv = 4

rng = np.random.default_rng(42)
X = rng.normal(0, 1, (n_tokens, d_model))

attn = SelfAttention(d_model, dk, dv, seed=42)
output, weights = attn.forward(X)

print("Attention weights (each row: where that token looks):\n")
print(f"{'':>6}", end="")
for token in sentence:
    print(f"{token:>6}", end="")
print()

for i, token in enumerate(sentence):
    print(f"{token:>6}", end="")
    for j in range(n_tokens):
        w = weights[i][j]
        print(f"{w:6.3f}", end="")
    print()
```

### 步骤 5：用 ASCII 热力图可视化注意力

将注意力权重映射为字符，快速可视化。

```python
def ascii_heatmap(weights, tokens, chars=" ░▒▓█"):
    n = len(tokens)
    print(f"\n{'':>6}", end="")
    for t in tokens:
        print(f"{t:>6}", end="")
    print()

    for i in range(n):
        print(f"{tokens[i]:>6}", end="")
        for j in range(n):
            level = int(weights[i][j] * (len(chars) - 1) / weights.max())
            level = min(level, len(chars) - 1)
            print(f"{'  ' + chars[level] + '   '}", end="")
        print()

ascii_heatmap(weights, sentence)
```

## 使用它

PyTorch 的 `nn.MultiheadAttention` 精确实现了我们构建的功能，外加多头拆分和输出投影：

```python
import torch
import torch.nn as nn

d_model = 8
n_heads = 2
seq_len = 6

mha = nn.MultiheadAttention(embed_dim=d_model, num_heads=n_heads, batch_first=True)

X_torch = torch.randn(1, seq_len, d_model)

output, attn_weights = mha(X_torch, X_torch, X_torch)

print(f"Input shape:            {X_torch.shape}")
print(f"Output shape:           {output.shape}")
print(f"Attention weight shape: {attn_weights.shape}")
print(f"\nAttn weights (averaged over heads):")
print(attn_weights[0].detach().numpy().round(3))
```

关键区别：多头注意力并行运行多个注意力函数，每个函数有自己的 Q、K、V 投影（大小 dk = d_model / n_heads），然后将结果拼接起来。这使得模型能够同时关注不同类型的关系。

## 交付物

本节课产生：
- `outputs/prompt-attention-explainer.md` —— 一个提示，用于通过数据库查找类比解释注意力

## 练习

1. 修改 `scaled_dot_product_attention`，使其接受一个可选的掩码矩阵，在 Softmax 前将某些位置设为负无穷（这是因果/解码器掩码的工作方式）
2. 从头实现多头注意力：将 Q、K、V 拆分为 `n_heads` 块，分别执行注意力，拼接，然后通过最后的权重矩阵 Wo 投影
3. 取两个长度相同的不同句子，通过同一个 SelfAttention 实例，比较它们的注意力模式。什么变了？什么没变？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|------------|----------|
| 查询（Q） | "查询向量" | 输入的可学习投影，表示此词元在寻找什么信息 |
| 键（K） | "标签向量" | 输入的可学习投影，表示此词元包含什么信息，与查询匹配 |
| 值（V） | "内容向量" | 可学习投影，携带实际信息，根据注意力分数进行聚合 |
| 缩放点积注意力 | "注意力公式" | softmax(QK^T / sqrt(dk)) @ V —— 缩放防止在高维空间中 Softmax 饱和 |
| 自注意力 | "词元关注自身和其他词元" | 注意力中的 Q、K、V 都来自同一序列，让每个位置关注所有其他位置 |
| 注意力权重 | "关注程度" | 对缩放点积应用 Softmax 后得到的概率分布，分布在各个位置上 |
| 多头注意力 | "并行注意力" | 运行多个具有不同投影的注意力函数，然后拼接结果，以获得更丰富的表示 |

## 进一步阅读

- [Attention Is All You Need (Vaswani et al., 2017)](https://arxiv.org/abs/1706.03762) —— 原始 Transformer 论文
- [The Illustrated Transformer (Jay Alammar)](https://jalammar.github.io/illustrated-transformer/) —— 最佳的可视化完整架构教程
- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) —— 逐行 PyTorch 实现并附有解释