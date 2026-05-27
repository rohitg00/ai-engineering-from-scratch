# 多头注意力（Multi-Head Attention）

> 一个注意力头一次学习一种关系。八个头学习八种。头是自由的，多取一些。

**类型：** 构建  
**语言：** Python  
**前置知识：** 第 7 阶段 · 02（从头实现自注意力）  
**时间：** 约 75 分钟

## 问题

单个自注意力头计算一个注意力矩阵。这个矩阵捕获一种关系——通常是能最小化训练信号损失的那一种。如果你的数据中混杂着主谓一致、共指消解、长程篇章关系和句法组块，单头会把这些信号抹到一个 softmax 分布中，丢失一半的信号。

2017 年 Vaswani 论文的解决方案：并行运行多个注意力函数，每个函数拥有自己的 Q、K、V 投影，然后将输出拼接起来。每个头在 `d_model / n_heads` 维度的更小子空间中运作。总参数量不变，表达力提升。

多头注意力是 2026 年每个 Transformer 的标配。唯一争论在于 *多少个头* 以及键和值是否共享投影（分组查询注意力（Grouped-Query Attention）、多查询注意力（Multi-Query Attention）、多头潜在注意力（Multi-head Latent Attention））。

## 概念

![多头注意力：分割、注意力、拼接](../assets/multi-head-attention.svg)

**分割。** 取形状为 `(N, d_model)` 的 `X`。投影到形状均为 `(N, d_model)` 的 Q、K、V。重新变形为 `(N, n_heads, d_head)`，其中 `d_head = d_model / n_heads`。转置为 `(n_heads, N, d_head)`。

**并行注意力。** 在每个头内部运行缩放点积注意力（scaled dot-product attention）。每个头产生 `(N, d_head)`。这些头在嵌入的不同子空间中运作，在注意力计算过程中互不通信。

**拼接并投影。** 将头堆回 `(N, d_model)`，乘以形状为 `(d_model, d_model)` 的学习输出矩阵 `W_o`。`W_o` 是各个头进行混合的地方。

**为什么有效。** 每个头可以专门化而不必为了表达预算与其他头竞争。2019–2024 年的探测研究揭示了不同的头角色：位置头、关注前一个标记的头、复制头、命名实体头、归纳头（induction heads，构成上下文学习的基础）。

**2026 年的变体谱系：**

| 变体 | Q 头数 | K/V 头数 | 使用模型 |
|---------|---------|-----------|---------|
| 多头（MHA） | N | N | GPT-2、BERT、T5 |
| 多查询（MQA） | N | 1 | PaLM、Falcon |
| 分组查询（GQA） | N | G（例如 N/8） | Llama 2 70B、Llama 3+、Qwen 2+、Mistral |
| 多头潜在（MLA） | N | 压缩为低秩 | DeepSeek-V2、V3 |

GQA 是现代默认选择，因为它将 KV 缓存内存削减了 `N/G` 倍，同时几乎保持完整质量。MLA 更进一步，将 K/V 压缩到一个潜在空间，然后在计算时投影回来——消耗 FLOPs，但节省更多内存。

## 构建

### 第一步：从已有的单头注意力中分割出头

取第 0 课的 `SelfAttention`，用一对分割/拼接操作包装。见 `code/main.py` 中的 NumPy 实现；逻辑如下：

```python
def split_heads(X, n_heads):
    n, d = X.shape
    d_head = d // n_heads
    return X.reshape(n, n_heads, d_head).transpose(1, 0, 2)  # (头数, 序列长度, 每头维度)

def combine_heads(H):
    h, n, d_head = H.shape
    return H.transpose(1, 0, 2).reshape(n, h * d_head)
```

一次 reshape 和一次 transpose。无需循环。这正是 PyTorch 在 `nn.MultiheadAttention` 内部的做法。

### 第二步：对每个头运行缩放点积注意力

每个头获得自己的 Q、K、V 切片。注意力变为批量矩阵乘法：

```python
def mha_forward(X, W_q, W_k, W_v, W_o, n_heads):
    Q = X @ W_q
    K = X @ W_k
    V = X @ W_v
    Qh = split_heads(Q, n_heads)         # (头数, 序列长度, 每头维度)
    Kh = split_heads(K, n_heads)
    Vh = split_heads(V, n_heads)
    scores = Qh @ Kh.transpose(0, 2, 1) / np.sqrt(Qh.shape[-1])
    weights = softmax(scores, axis=-1)
    out = weights @ Vh                    # (头数, 序列长度, 每头维度)
    concat = combine_heads(out)
    return concat @ W_o, weights
```

在真实硬件上，`Qh @ Kh.transpose(...)` 是一次 `bmm`。GPU 看到一次形状为 `(头数, 序列长度, 每头维度) × (头数, 每头维度, 序列长度) -> (头数, 序列长度, 序列长度)` 的批量矩阵乘法。增加头数几乎是免费的。

### 第三步：分组查询注意力变体

只有键和值的投影变了。Q 获得 `n_heads` 个组；K 和 V 获得 `n_kv_heads < n_heads` 个组，然后重复以匹配：

```python
def gqa_project(X, W, n_kv_heads, n_heads):
    kv = split_heads(X @ W, n_kv_heads)       # (kv头数, 序列长度, 每头维度)
    repeat = n_heads // n_kv_heads
    return np.repeat(kv, repeat, axis=0)      # (n_heads, n, d_head)
```

在推理时这节省了内存，因为 KV 缓存中只保留 `n_kv_heads` 份副本，而不是 `n_heads`。Llama 3 70B 使用 64 个查询头，8 个 KV 头——缓存缩减了 8 倍。

### 第四步：探测每个头学到了什么

在一个短句子上运行 4 头的 MHA。对每个头打印形状为 `(N, N)` 的注意力矩阵。你会看到不同的头甚至随机初始化也会挑出不同的结构——这既包含信号成分，也包含子空间中的旋转对称性。

## 使用

在 PyTorch 中，一行代码：

```python
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=512, num_heads=8, batch_first=True)
```

PyTorch 2.5 以上版本的 GQA：

```python
from torch.nn.functional import scaled_dot_product_attention

# scaled_dot_product_attention 在 CUDA 上自动调度 Flash Attention。
# 对于 GQA，传入形状为 (B, n_heads, N, d_head) 的 Q 和形状为
# (B, n_kv_heads, N, d_head) 的 K、V。PyTorch 自动处理重复。
out = scaled_dot_product_attention(q, k, v, is_causal=True, enable_gqa=True)
```

**多少个头？** 2026 年生产模型的经验法则：

| 模型规模 | d_model | n_heads | d_head |
|------------|---------|---------|--------|
| 小（~125M） | 768 | 12 | 64 |
| 基础（~350M） | 1024 | 16 | 64 |
| 大（~1B） | 2048 | 16 | 128 |
| 前沿（~70B） | 8192 | 64 | 128 |

`d_head` 几乎总是 64 或 128。它是一个头能“看到”多少的单位。降到 32 以下，头们开始与缩放因子 `sqrt(d_head)` 打架；升到 256 以上，你就会失去“许多小专家”的好处。

## 交付

见 `outputs/skill-mha-configurator.md`。该技能根据参数预算、序列长度和部署目标，为新的 Transformer 推荐头数、KV 头数和投影策略。

## 练习

1. **简单。** 取 `code/main.py` 中的 MHA，固定 `d_model=64`，将 `n_heads` 从 1 改为 16。在合成复制任务上绘制极小型单层模型的损失。更多头是帮助、平缓还是有害？
2. **中等。** 实现 MQA（一个 KV 头被所有查询头共享）。测量与完整 MHA 相比，参数量下降了多少。计算在推理时，对于 N=2048，KV 缓存大小缩小了多少。
3. **困难。** 实现微型版本的多头潜在注意力（MLA）：将 K、V 压缩为秩为 `r` 的潜在向量，将潜在向量存入 KV 缓存，在注意力时解压缩。在多大 `r` 下，缓存内存降至完整 MHA 的 1/8 以下，同时验证困惑度保持在 1 比特以内？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 头（Head） | "一个注意力电路" | 一个维度为 `d_head = d_model / n_heads` 的 Q/K/V 投影，拥有自己的注意力矩阵。 |
| d_head | "头维度" | 每头隐藏宽度；生产中几乎总是 64 或 128。 |
| 分割/合并 | "reshape 技巧" | 在注意力周围做 `(N, d_model) ↔ (n_heads, N, d_head)` 的 reshape+transpose。 |
| W_o | "输出投影" | 拼接头后应用的 `(d_model, d_model)` 矩阵；头在这里混合。 |
| MQA | "一个 KV 头" | 多查询注意力：单一共享的 K/V 投影。KV 缓存最小，有一定质量损失。 |
| GQA | "Llama 2 以来的默认" | 分组查询注意力，`n_kv_heads < n_heads`；重复以匹配 Q。 |
| MLA | "DeepSeek 的技巧" | 多头潜在注意力：K、V 压缩为低秩潜在，在注意力时解压缩。 |
| 归纳头（Induction head） | "上下文学习背后的电路" | 一对头，检测之前的出现并复制之后跟随的内容。 |

## 延伸阅读

- [Vaswani et al. (2017). Attention Is All You Need §3.2.2](https://arxiv.org/abs/1706.03762) — 原始多头规范。
- [Shazeer (2019). Fast Transformer Decoding: One Write-Head is All You Need](https://arxiv.org/abs/1911.02150) — MQA 论文。
- [Ainslie et al. (2023). GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints](https://arxiv.org/abs/2305.13245) — 如何训练后将 MHA 转换为 GQA。
- [DeepSeek-AI (2024). DeepSeek-V2 Technical Report](https://arxiv.org/abs/2405.04434) — MLA 及其在缓存内存上优于 MHA/GQA 的原因。
- [Olsson et al. (2022). In-context Learning and Induction Heads](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html) — 头部实际功能的机制性审视。