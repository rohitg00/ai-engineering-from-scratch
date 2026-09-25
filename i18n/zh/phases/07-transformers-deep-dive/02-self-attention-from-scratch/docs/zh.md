# 从零实现自注意力

> 注意力是一张查询表，每个词都在问“谁对我重要？”，并且自己学会答案。

**Type:** Build
**Languages:** Python
**Prerequisites:** 阶段 3(深度学习核心)、阶段 5 第 10 课(序列到序列)
**Time:** 约 90 分钟

## 学习目标

- 仅使用 NumPy 从零实现缩放点积自注意力，包括 query/key/value 投影和 softmax 加权求和
- 构建一个多头注意力层：拆分多头、并行计算注意力、拼接结果
- 追踪注意力矩阵如何捕捉词元之间的关系，并解释为什么除以 sqrt(d_k) 能防止 softmax 饱和
- 应用因果掩码，将双向注意力转换为自回归(解码器式)注意力

## 问题所在

RNN 逐个词元处理序列。当你处理到第 50 个词元时，第 1 个词元的信息已经经过了 50 次压缩。长距离依赖被挤压进一个固定大小的隐藏状态——这是一个任何 LSTM 门控机制都无法完全解决的瓶颈。

2014 年 Bahdanau 的注意力论文给出了修复方案：让解码器回看编码器的每个位置，并决定哪些位置对当前步骤重要。但它仍然附着在 RNN 之上。2017 年的 "Attention Is All You Need" 论文提出了一个更尖锐的问题：如果注意力是*唯一*的机制呢？不需要循环结构，不需要卷积，只要注意力。

自注意力让序列中的每个位置在单个并行步骤中关注所有其他位置。这正是 Transformer 快速、可扩展并占据主导地位的原因。

## 核心概念

### 数据库查询类比

把注意力想象成一次“软性”的数据库查询：

```
Traditional database:
  Query: "capital of France"  -->  exact match  -->  "Paris"

Attention:
  Query: "capital of France"  -->  similarity to ALL keys  -->  weighted blend of ALL values
```

每个词元生成三个向量：
- **Query(Q)**:“我在找什么？”
- **Key(K)**:“我包含什么？”
- **Value(V)**:“如果被选中，我能提供什么信息？”

一个 query 与所有 key 的点积产生注意力分数。高分数意味着“这个 key 与我的 query 匹配”。这些分数对 value 进行加权。输出就是 value 的加权和。

### Q、K、V 的计算

每个词元嵌入通过三个可学习的权重矩阵进行投影：

```
Input embeddings (sequence of n tokens, each d-dimensional):

  X = [x1, x2, x3, ..., xn]       shape: (n, d)

Three weight matrices:

  Wq  shape: (d, dk)
  Wk  shape: (d, dk)
  Wv  shape: (d, dv)

Projections:

  Q = X @ Wq    shape: (n, dk)      each token's query
  K = X @ Wk    shape: (n, dk)      each token's key
  V = X @ Wv    shape: (n, dv)      each token's value
```

以可视化方式展示单个词元：

```
             Wq
  x_i ------[*]------> q_i    "What am I looking for?"
       |
       |     Wk
       +----[*]------> k_i    "What do I contain?"
       |
       |     Wv
       +----[*]------> v_i    "What do I offer?"
```

### 注意力矩阵

得到所有词元的 Q、K、V 后，注意力分数构成一个矩阵：

```
Scores = Q @ K^T    shape: (n, n)

              k1    k2    k3    k4    k5
        +-----+-----+-----+-----+-----+
   q1   | 2.1 | 0.3 | 0.1 | 0.8 | 0.2 |   <- how much q1 attends to each key
        +-----+-----+-----+-----+-----+
   q2   | 0.4 | 1.9 | 0.7 | 0.1 | 0.3 |
        +-----+-----+-----+-----+-----+
   q3   | 0.2 | 0.6 | 2.3 | 0.5 | 0.1 |
        +-----+-----+-----+-----+-----+
   q4   | 0.9 | 0.1 | 0.4 | 1.7 | 0.6 |
        +-----+-----+-----+-----+-----+
   q5   | 0.1 | 0.3 | 0.2 | 0.5 | 2.0 |
        +-----+-----+-----+-----+-----+

Each row: one token's attention over the entire sequence
```

逐个观察 query 扫描 key:每一行给每个词元打分，softmax 将分数转换为权重，上下文向量就是 value 的加权混合。

```figure
attention-matrix
```

### 为什么要缩放？

点积随维度 dk 增长。如果 dk = 64,点积可能达到几十的量级，这会把 softmax 推入梯度消失的区域。解决方法：除以 sqrt(dk)。

```
Scaled scores = (Q @ K^T) / sqrt(dk)
```

这样能把数值保持在 softmax 能产生有效梯度的范围内。

### Softmax 将分数转换为权重

Softmax 将原始分数转换为每行上的概率分布：

```
Raw scores for q1:   [2.1, 0.3, 0.1, 0.8, 0.2]
                            |
                         softmax
                            |
Attention weights:   [0.52, 0.09, 0.07, 0.14, 0.08]   (sums to ~1.0)
```

现在每个词元都有一组权重，表示它对其他每个词元的关注程度。

### Value 的加权和

每个词元的最终输出是所有 value 向量的加权和：

```
output_i = sum( attention_weight[i][j] * v_j  for all j )

For token 1:
  output_1 = 0.52 * v1 + 0.09 * v2 + 0.07 * v3 + 0.14 * v4 + 0.08 * v5
```

### 完整流程

```mermaid
flowchart LR
  X["X (input)"] --> Q["Q = X · Wq"]
  X --> K["K = X · Wk"]
  X --> V["V = X · Wv"]
  Q --> S["Q · Kᵀ / √dk"]
  K --> S
  S --> SM["softmax"]
  SM --> WS["weighted sum"]
  V --> WS
  WS --> O["output"]
```

一行公式：

```
Attention(Q, K, V) = softmax( Q @ K^T / sqrt(dk) ) @ V
```

```figure
softmax-attention-scaling
```

## 动手构建

### 第 1 步：从零实现 Softmax

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

### 第 2 步：缩放点积注意力

核心函数。接收 Q、K、V 矩阵，返回注意力输出和权重矩阵。

```python
def scaled_dot_product_attention(Q, K, V):
    dk = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(dk)
    weights = softmax(scores)
    output = weights @ V
    return output, weights
```

### 第 3 步：带可学习投影的自注意力类

一个完整的自注意力模块，包含以类 Xavier 缩放初始化的 Wq、Wk、Wv 权重矩阵。

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

### 第 4 步：在句子上运行

为一个句子创建虚构的嵌入，观察注意力权重。

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

### 第 5 步：用 ASCII 热力图可视化注意力

将注意力权重映射为字符，以获得直观的视觉效果。

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

## 直接使用

PyTorch 的 `nn.MultiheadAttention` 实现的正是我们构建的功能，外加多头拆分和输出投影：

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

关键区别在于：多头注意力并行运行多个注意力函数，每个头都有自己大小为 dk = d_model / n_heads 的 Q、K、V 投影，然后拼接结果。这让模型能够同时关注不同类型的关系。

## 发布成果

本课产出：
- `outputs/prompt-attention-explainer.md` - 一个通过数据库查询类比解释注意力的提示词

## 练习

1. 修改 `scaled_dot_product_attention`,使其接受一个可选的掩码矩阵，在 softmax 之前将某些位置设为负无穷(这正是因果/解码器掩码的工作方式)
2. 从零实现多头注意力：将 Q、K、V 拆分为 `n_heads` 个分块，对每块分别运行注意力，拼接结果，再通过最终的权重矩阵 Wo 投影
3. 取两个长度不同但内容不同的句子，将它们输入同一个 SelfAttention 实例，比较它们的注意力模式。什么变了？什么保持不变？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| Query(Q) | “问题向量” | 输入的可学习投影，表示该词元正在寻找什么信息 |
| Key(K) | “标签向量” | 可学习投影，表示该词元包含什么信息，用于与 query 匹配 |
| Value(V) | “内容向量” | 携带实际信息的可学习投影，根据注意力分数进行聚合 |
| 缩放点积注意力 | “注意力公式” | softmax(QK^T / sqrt(dk)) @ V - 缩放可防止高维下 softmax 饱和 |
| 自注意力 | “词元看向自己和其他词元” | Q、K、V 均来自同一序列的注意力，让每个位置都能关注所有其他位置 |
| 注意力权重 | “关注度” | 一个位置上的概率分布，由缩放点积经 softmax 产生 |
| 多头注意力 | “并行注意力” | 使用不同投影运行多个注意力函数，然后拼接结果以获得更丰富的表示 |

## 延伸阅读

- [Attention Is All You Need(Vaswani et al., 2017)](https://arxiv.org/abs/1706.03762) - 原始 Transformer 论文
- [The Illustrated Transformer(Jay Alammar)](https://jalammar.github.io/illustrated-transformer/) - 对完整架构最好的可视化讲解
- [The Annotated Transformer(Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) - 逐行解释的 PyTorch 实现