# 从划痕中自我关注

> 注意力是一个查找表，其中的每个词都在问“谁对我来说重要？”-并了解答案。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 第3阶段（深度学习核心），第5阶段第10课（序列到序列）
** 时间：** ~90分钟

## 学习目标

- 仅使用NumPy从头开始实现扩展的点产品自我关注，包括查询/键/值预测和softmax加权总和
- 构建一个多头注意力层，拆分头部，计算并行注意力，并连接结果
- 跟踪注意力矩阵如何捕获标记关系，并解释为什么通过sqrt（d_k）进行缩放会防止softmax饱和
- 应用因果掩盖将双向注意力转化为自回归（解码器式）注意力

## 问题

RNN处理一次对一个令牌进行排序。当您到达令牌50时，来自令牌1的信息已经被压缩了50个压缩步骤。长期依赖关系会被压缩为固定大小的隐藏状态--无论LSTM门控如何都无法完全解决这一瓶颈。

2014年BahDanau注意力论文给出了解决方案：让解码器回顾每个编码器位置，并决定哪些位置对当前步骤重要。但它仍然被固定在RNN上。2017年的《注意力就是你所需要的一切》论文提出了一个更尖锐的问题：如果注意力是 * 唯一 * 机制怎么办？没有复发。没有卷积。只是注意。

自我注意让序列中的每一个位置都在一个平行的步骤中关注其他位置。这就是为什么transformers快速，可扩展和占主导地位。

## 概念

### 数据库收件箱类比

将注意力视为软数据库查找：

```
Traditional database:
  Query: "capital of France"  -->  exact match  -->  "Paris"

Attention:
  Query: "capital of France"  -->  similarity to ALL keys  -->  weighted blend of ALL values
```

每个代币都会生成三个载体：
- ** 查询（Q）**：“我在寻找什么？"
- ** 键（K）**：“我包含什么？"
- ** 值（V）**：“如果选择，我会提供哪些信息？"

查询和所有键之间的点积产生注意力分数。高分意味着“这个键与我的查询匹配。“这些分数衡量了价值观。输出是值的加权和。

### Q、K、V计算

每个令牌嵌入都通过三个学习的权重矩阵进行投影：

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

从视觉上看，有一个记号：

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

一旦您拥有所有代币的Q、K、V，注意力分数就会形成一个矩阵：

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

### 为什么要规模？

点产品随着维度dk增长。如果dk = 64，则点积可以在十的范围内，从而将softmax推入梯度消失的区域。修复方法：除以SQRT（dk）。

```
Scaled scores = (Q @ K^T) / sqrt(dk)
```

这将值保持在softmax产生有用梯度的范围内。

### Softmax将分数转化为权重

Softmax将原始分数转换为各行的概率分布：

```
Raw scores for q1:   [2.1, 0.3, 0.1, 0.8, 0.2]
                            |
                         softmax
                            |
Attention weights:   [0.52, 0.09, 0.07, 0.14, 0.08]   (sums to ~1.0)
```

现在每个代币都有一组权重，说明每个其他代币需要注意多少。

### 的值的加权和

每个代币的最终输出是所有值载体的加权和：

```
output_i = sum( attention_weight[i][j] * v_j  for all j )

For token 1:
  output_1 = 0.52 * v1 + 0.09 * v2 + 0.07 * v3 + 0.14 * v4 + 0.08 * v5
```

### 全流水

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

## 建设党

### 第1步：Softmax从头开始

Softmax将原始日志转换为概率。减去最大值以获得数字稳定性。

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

### 第二步：按比例分配点积注意力

核心功能。获取Q、K、V矩阵并返回注意力输出加上权重矩阵。

```python
def scaled_dot_product_attention(Q, K, V):
    dk = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(dk)
    weights = softmax(scores)
    output = weights @ V
    return output, weights
```

### 第3步：自我关注课程，学习预测

一个完整的自我注意模块，具有Wq、Wk、Wv权重矩阵，采用类似Xavier的缩放初始化。

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

### 第4步：在句子上运行它

为句子创建虚假嵌入并观察注意力权重。

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

### 第5步：使用ASC热图可视化注意力

将注意力权重映射到角色，以快速视觉。

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

PyTorch的“nn. Multi headAttention”完全符合我们构建的功能，以及多头拆分和输出投影：

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

关键区别：多头注意力并行运行多个注意力功能，每个功能都有自己的Q、K、V投影，大小为dk = d_模型/ n_heads，然后连接结果。这让模型同时处理不同的关系类型。

## 把它运

本课产生：
- '输出/prompt-attention-explainer.md '-通过数据库查找类比解释注意力的提示

## 演习

1. 修改`scaled_dot_product_attention`以接受一个可选的掩码矩阵，该矩阵在softmax之前将某些位置设置为负无穷大（这是因果/解码器掩码的工作方式）
2. 从头开始实施多头注意力：将Q、K、V分成“n_heads”块，对每个块运行注意力、连接并通过最终的权重矩阵Wo进行投影
3. 取两个相同长度的不同句子，通过同一个SelfAttention实例向它们提供信息，并比较它们的注意力模式。有哪些变化？什么保持不变？

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|----------------|----------------------|
| 查询（Q） | “问题载体” | 输入的学习投影，代表此令牌正在寻找的信息 |
| 键（K） | “标签载体” | 表示此标记包含的信息的学习投影，与查询匹配 |
| 值（V） | “内容载体” | 一种习得的投影，携带根据注意力分数进行汇总的实际信息 |
| 扩大点产品关注度 | “注意力公式” | softmax（QK & T /squRT（dk））@ V -缩放防止softmax在高维度中饱和 |
| Self-attention | “代币着眼于自己和他人” | 注意Q、K、V都来自同一序列，让每个位置都关注其他位置 |
| 注意力权重 | “有多专注” | 位置上的概率分布，由softmax在缩放点积上生成 |
| 多头注意 | “平行关注” | 使用不同的投影运行多个注意力功能，然后将结果连接以获得更丰富的表示 |

## 进一步阅读

- [注意力就是你所需要的一切（Vaswani等人，2017）]（https：//arxiv.org/abs/1706.03762）-原版Transformer论文
- [The插图Transformer（Jay Alammar）]（https：//jalammar.github.io/illustraded-transformer/）-完整架构的最佳视觉演练
- [The注释Transformer（哈佛NLP）]（https：//nlp.seas.harvard.edu/annotated-transformer/）-逐行PyTorch实现及其解释
