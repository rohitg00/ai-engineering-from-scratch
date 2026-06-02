# 从零实现 Self-Attention

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Attention 就是一张查找表，每个词都在问“谁对我重要？”——并学着给出答案。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 (Deep Learning Core), Phase 5 Lesson 10 (Sequence-to-Sequence)
**Time:** ~90 minutes

## 学习目标（Learning Objectives）

- 只用 NumPy 从零实现 scaled dot-product self-attention（缩放点积自注意力），包括 query / key / value 投影和 softmax 加权求和
- 构建一个 multi-head attention（多头 attention）层：拆分 head、并行计算 attention、再把结果拼接起来
- 跟踪 attention 矩阵如何捕捉 token 之间的关系，并解释为什么除以 sqrt(d_k) 能避免 softmax 饱和
- 应用 causal mask（因果掩码），把双向 attention 变成 autoregressive（解码器风格）的 attention

## 问题（The Problem）

RNN 一次处理一个 token。当你走到第 50 个 token 时，第 1 个 token 的信息已经被 50 步压缩反复挤压过。长程依赖被压扁进一个固定大小的 hidden state——这是个瓶颈，再多的 LSTM 门控也救不回来。

2014 年的 Bahdanau attention 论文给出了解法：让 decoder 回头看 encoder 的每一个位置，自己决定当前这一步谁更重要。但它仍然是挂在 RNN 上的补丁。2017 年那篇《Attention Is All You Need》提出了一个更尖锐的问题：如果 attention 是*唯一*的机制呢？没有 recurrence。没有卷积。只剩 attention。

Self-attention 让序列里每一个位置都能在一次并行计算里 attend 到其他所有位置。这正是 transformer 又快、又能 scale、又一统江湖的根本原因。

## 概念（The Concept）

### 数据库查询的类比（The Database Lookup Analogy）

把 attention 想象成一次“软的”数据库查询：

```
Traditional database:
  Query: "capital of France"  -->  exact match  -->  "Paris"

Attention:
  Query: "capital of France"  -->  similarity to ALL keys  -->  weighted blend of ALL values
```

每个 token 都生成三个向量：
- **Query (Q)**：“我在找什么？”
- **Key (K)**：“我里面装的是什么？”
- **Value (V)**：“如果我被选中，我能提供什么信息？”

query 与所有 key 的点积构成 attention 分数。分数高，意味着“这个 key 跟我的 query 很匹配”。这些分数再去给 value 加权。最后输出的是 value 的加权和。

### Q、K、V 的计算（Q, K, V Computation）

每个 token 的 embedding 都会通过三个可学习的权重矩阵投影：

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

针对单个 token 的可视化：

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

### Attention 矩阵（The Attention Matrix）

一旦拿到所有 token 的 Q、K、V，attention 分数就构成一个矩阵：

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

### 为什么要 scale？（Why Scale?）

点积会随着维度 dk 增长。如果 dk = 64，点积可能落到几十的量级，把 softmax 推到梯度消失的区域。解法：除以 sqrt(dk)。

```
Scaled scores = (Q @ K^T) / sqrt(dk)
```

这样可以把数值保持在 softmax 还能产生有用梯度的范围里。

### Softmax 把分数变成权重（Softmax Turns Scores into Weights）

Softmax 把原始分数按行转成一个概率分布：

```
Raw scores for q1:   [2.1, 0.3, 0.1, 0.8, 0.2]
                            |
                         softmax
                            |
Attention weights:   [0.52, 0.09, 0.07, 0.14, 0.08]   (sums to ~1.0)
```

现在每个 token 都有一组权重，告诉它“要在多大程度上 attend 到其他每个 token”。

### Value 的加权和（Weighted Sum of Values）

每个 token 的最终输出，就是所有 value 向量的加权和：

```
output_i = sum( attention_weight[i][j] * v_j  for all j )

For token 1:
  output_1 = 0.52 * v1 + 0.09 * v2 + 0.07 * v3 + 0.14 * v4 + 0.08 * v5
```

### 完整流水线（Full Pipeline）

```
                    +-------+
  X (input)  ----->|  @ Wq  |-----> Q
                    +-------+
                    +-------+
  X (input)  ----->|  @ Wk  |-----> K
                    +-------+                     +----------+
                    +-------+                     |          |
  X (input)  ----->|  @ Wv  |-----> V ---------->| weighted |----> output
                    +-------+          ^          |   sum    |
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

## 动手实现（Build It）

### 第 1 步：从零实现 softmax（Softmax from scratch）

Softmax 把原始 logits 转成概率。为了数值稳定，先减去最大值。

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

### 第 2 步：scaled dot-product attention

核心函数。接收 Q、K、V 矩阵，返回 attention 输出和权重矩阵。

```python
def scaled_dot_product_attention(Q, K, V):
    dk = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(dk)
    weights = softmax(scores)
    output = weights @ V
    return output, weights
```

### 第 3 步：带可学习投影的 self-attention 类

一个完整的 self-attention 模块，Wq、Wk、Wv 用类 Xavier 的方式做初始化缩放。

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

### 第 4 步：在一句话上跑一遍

为一句话造一组假的 embedding，看看 attention 权重长什么样。

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

### 第 5 步：用 ASCII 热力图把 attention 画出来

把 attention 权重映射成字符，快速可视化一下。

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

## 用起来（Use It）

PyTorch 的 `nn.MultiheadAttention` 做的事情和我们刚刚搭的一模一样，再加上多头拆分和输出投影：

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

关键区别在于：multi-head attention 会并行跑多个 attention 函数，每个都有自己的 Q、K、V 投影，维度是 dk = d_model / n_heads，最后再把结果拼起来。这样模型就可以同时 attend 到不同种类的关系。

## 上线部署（Ship It）

这节课会产出：
- `outputs/prompt-attention-explainer.md` —— 一段用数据库查询类比来讲解 attention 的 prompt

## 练习（Exercises）

1. 修改 `scaled_dot_product_attention`，让它接受一个可选的 mask 矩阵，在做 softmax 之前把某些位置置为负无穷（这就是 causal / decoder mask 的实现方式）
2. 从零实现 multi-head attention：把 Q、K、V 拆成 `n_heads` 份，对每一份分别做 attention，再拼接，最后通过一个权重矩阵 Wo 投影
3. 找两句长度相同但内容不同的句子，喂给同一个 SelfAttention 实例，比较它们的 attention 模式。哪些变了？哪些保持不变？

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| Query (Q) | “提问向量” | 输入的一个可学习投影，表示这个 token 在找什么信息 |
| Key (K) | “标签向量” | 一个可学习投影，表示这个 token 里装着什么信息，用来跟 query 匹配 |
| Value (V) | “内容向量” | 一个可学习投影，承载真正会被 attention 分数聚合的信息 |
| Scaled dot-product attention | “那个 attention 公式” | softmax(QK^T / sqrt(dk)) @ V —— 缩放是为了在高维下避免 softmax 饱和 |
| Self-attention | “token 同时看着自己和别人” | Q、K、V 都来自同一个序列的 attention，让每个位置都能 attend 到其他每个位置 |
| Attention weights | “注意力分配” | 一组在所有位置上的概率分布，由对缩放点积做 softmax 得到 |
| Multi-head attention | “并行的 attention” | 用不同的投影并行跑多个 attention 函数，再把结果拼起来，得到更丰富的表示 |

## 延伸阅读（Further Reading）

- [Attention Is All You Need (Vaswani et al., 2017)](https://arxiv.org/abs/1706.03762) —— 原始 transformer 论文
- [The Illustrated Transformer (Jay Alammar)](https://jalammar.github.io/illustrated-transformer/) —— 整套架构最好的可视化导览
- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) —— 带解说的逐行 PyTorch 实现
