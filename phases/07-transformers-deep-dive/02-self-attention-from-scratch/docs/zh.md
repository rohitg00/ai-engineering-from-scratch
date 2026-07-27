# Self-Attention 从零实现

> 注意力是一个查找表，每个词都在问"谁对我重要？"——然后学习答案。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 (Deep Learning Core), Phase 5 Lesson 10 (Sequence-to-Sequence)
**Time:** ~90 分钟

## 学习目标

- 仅使用 NumPy 从零实现 scaled dot-product self-attention，包括 query/key/value 投影和 softmax 加权求和
- 构建 multi-head attention 层，拆分 heads、并行计算注意力并拼接结果
- 追踪注意力矩阵如何捕获 token 关系，并解释为什么除以 sqrt(d_k) 可以防止 softmax 饱和
- 应用 causal masking 将双向注意力转换为自回归（解码器风格）注意力

## 问题

RNN 一次处理一个 token。当你到达第 50 个 token 时，第 1 个 token 的信息已经经过了 50 次压缩步骤。长距离依赖被压入一个固定大小的隐藏状态——这是一个无论多少 LSTM 门控都无法完全解决的瓶颈。

2014 年的 Bahdanau 注意力论文展示了修复方案：让解码器回看每一个编码器位置，并决定哪些对当前步骤重要。但它仍然附着在 RNN 上。2017 年的 "Attention Is All You Need" 论文提出了一个更尖锐的问题：如果注意力的*唯一*机制呢？没有循环。没有卷积。只有注意力。

Self-attention 让序列中的每个位置在一个并行步骤中关注所有其他位置。这就是 transformer 快速、可扩展且占主导地位的原因。

## 概念

### 数据库查找类比

将注意力视为一种软性数据库查找：

```
传统数据库：
  Query: "capital of France"  -->  精确匹配  -->  "Paris"

注意力：
  Query: "capital of France"  -->  与所有 keys 的相似度  -->  所有 values 的加权混合
```

每个 token 生成三个向量：
- **Query (Q)**："我在找什么？"
- **Key (K)**："我包含什么？"
- **Value (V)**："如果被选中，我提供什么信息？"

query 和所有 keys 之间的点积产生注意力分数。高分意味着"这个 key 匹配我的 query"。这些分数对 values 进行加权。输出是 values 的加权和。

### Q、K、V 计算

每个 token 嵌入通过三个学习到的权重矩阵进行投影：

```
输入嵌入（n 个 token 的序列，每个 d 维）：

  X = [x1, x2, x3, ..., xn]       形状: (n, d)

三个权重矩阵：

  Wq  形状: (d, dk)
  Wk  形状: (d, dk)
  Wv  形状: (d, dv)

投影：

  Q = X @ Wq    形状: (n, dk)      每个 token 的 query
  K = X @ Wk    形状: (n, dk)      每个 token 的 key
  V = X @ Wv    形状: (n, dv)      每个 token 的 value
```

对于一个 token 的图示：

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

一旦你有了所有 token 的 Q、K、V，注意力分数形成一个矩阵：

```
Scores = Q @ K^T    形状: (n, n)

              k1    k2    k3    k4    k5
        +-----+-----+-----+-----+-----+
   q1   | 2.1 | 0.3 | 0.1 | 0.8 | 0.2 |   <- q1 对每个 key 的关注程度
        +-----+-----+-----+-----+-----+
   q2   | 0.4 | 1.9 | 0.7 | 0.1 | 0.3 |
        +-----+-----+-----+-----+-----+
   q3   | 0.2 | 0.6 | 2.3 | 0.5 | 0.1 |
        +-----+-----+-----+-----+-----+
   q4   | 0.9 | 0.1 | 0.4 | 1.7 | 0.6 |
        +-----+-----+-----+-----+-----+
   q5   | 0.1 | 0.3 | 0.2 | 0.5 | 2.0 |
        +-----+-----+-----+-----+-----+

每一行：一个 token 对整个序列的注意力
```

一次观察一个 query 扫描 keys：每行对每个 token 评分，softmax 将分数转化为权重，上下文向量是 values 的加权混合。

### 为什么需要缩放？

点积随维度 dk 增长。如果 dk = 64，点积可能在数十的范围内，将 softmax 推入梯度消失的区域。修复方案：除以 sqrt(dk)。

```
缩放后的分数 = (Q @ K^T) / sqrt(dk)
```

这将值保持在 softmax 能产生有用梯度的范围内。

### Softmax 将分数转化为权重

Softmax 将原始分数转换为跨每一行的概率分布：

```
第 1 行的原始分数:   [2.1, 0.3, 0.1, 0.8, 0.2]
                            |
                         softmax
                            |
注意力权重:   [0.52, 0.09, 0.07, 0.14, 0.08]   (总和 ≈ 1.0)
```

现在每个 token 都有一组权重，表示它应该关注其他每个 token 的程度。

### Values 的加权和

每个 token 的最终输出是所有 value 向量的加权和：

```
output_i = sum( attention_weight[i][j] * v_j  for all j )

对于 token 1：
  output_1 = 0.52 * v1 + 0.09 * v2 + 0.07 * v3 + 0.14 * v4 + 0.08 * v5
```

### 完整流水线

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

## 动手构建

### 步骤 1：从零实现 Softmax

Softmax 将原始 logits 转化为概率。减去最大值以保证数值稳定性。

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

### 步骤 2：Scaled dot-product attention

核心函数。接受 Q、K、V 矩阵，返回注意力输出和权重矩阵。

```python
def scaled_dot_product_attention(Q, K, V):
    dk = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(dk)
    weights = softmax(scores)
    output = weights @ V
    return output, weights
```

### 步骤 3：带学习投影的 Self-attention 类

一个完整的 self-attention 模块，包含使用类 Xavier 缩放初始化的 Wq、Wk、Wv 权重矩阵。

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

### 步骤 4：在一个句子上运行

为句子创建伪嵌入并观察注意力权重。

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

将注意力权重映射到字符以实现快速可视化。

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

## 实际应用

PyTorch 的 `nn.MultiheadAttention` 做的正是我们构建的内容，再加上 multi-head 拆分和输出投影：

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

关键区别：multi-head attention 并行运行多个注意力函数，每个函数都有自己的 Q、K、V 投影（大小为 dk = d_model / n_heads），然后拼接结果。这让模型能够同时关注不同类型的关系。

## 交付

本课程产出：
- `outputs/prompt-attention-explainer.md` - 一个用于通过数据库查找类比解释注意力的 prompt

## 练习

1. 修改 `scaled_dot_product_attention` 以接受一个可选的 mask 矩阵，该矩阵在 softmax 之前将某些位置设为负无穷（这是 causal/decoder masking 的工作方式）
2. 从零实现 multi-head attention：将 Q、K、V 拆分为 `n_heads` 个块，对每个块运行注意力，拼接，然后通过最终权重矩阵 Wo 投影
3. 取两个长度相同的不同句子，通过同一个 `SelfAttention` 实例输入，比较它们的注意力模式。哪些变了？哪些保持不变？

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------------|----------------------|
| Query (Q) | "问题向量" | 输入的学习投影，代表该 token 在寻找什么信息 |
| Key (K) | "标签向量" | 学习投影，代表该 token 包含什么信息，与 queries 匹配 |
| Value (V) | "内容向量" | 学习投影，携带实际信息，根据注意力分数聚合 |
| Scaled dot-product attention | "注意力公式" | softmax(QK^T / sqrt(dk)) @ V - 缩放防止高维 softmax 饱和 |
| Self-attention | "token 看自己和别人" | Q、K、V 都来自同一序列的注意力，让每个位置关注所有其他位置 |
| Attention weights | "关注程度" | 位置上的概率分布，由 scaled dot products 上的 softmax 产生 |
| Multi-head attention | "并行注意力" | 运行多个具有不同投影的注意力函数，然后拼接结果以获得更丰富的表示 |

## 延伸阅读

- [Attention Is All You Need (Vaswani et al., 2017)](https://arxiv.org/abs/1706.03762) - 原始 transformer 论文
- [The Illustrated Transformer (Jay Alammar)](https://jalammar.github.io/illustrated-transformer/) - 最佳视觉化完整架构走读
- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) - 逐行 PyTorch 实现及解释
