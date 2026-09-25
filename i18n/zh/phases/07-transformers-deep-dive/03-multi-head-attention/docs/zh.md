# 多头注意力

> 一个注意力头一次只学一种关系。八个头学八种。头是免费的，多拿一些。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02（从零实现自注意力）
**Time:** ~75 minutes

## 问题所在

单个自注意力头只计算一个注意力矩阵。这个矩阵只捕捉一种关系——通常是对当前训练信号最能降低损失的那一种。如果你的数据中主谓一致、共指消解、长程语篇和句法分块全部纠缠在一起，单个头会把它们涂抹进一个 softmax 分布，丢失一半的信号。

2017 年 Vaswani 论文给出的解决方案：并行运行多个注意力函数，每个拥有自己的 Q、K、V 投影，然后将输出拼接起来。每个头在维度为 `d_model / n_heads` 的更小子空间中运作。总参数量保持不变，表达能力却提升了。

多头注意力是 2026 年所有 Transformer 的默认配置。唯一有争议的是*头数多少*，以及键和值是否共享投影（Grouped-Query Attention、Multi-Query Attention、Multi-head Latent Attention）。

## 核心概念

![Multi-head attention splits, attends, concatenates](../assets/multi-head-attention.svg)

**切分。** 取形状为 `(N, d_model)` 的 `X`。分别投影为形状均为 `(N, d_model)` 的 Q、K、V。重塑为 `(N, n_heads, d_head)`，其中 `d_head = d_model / n_heads`。再转置为 `(n_heads, N, d_head)`。

**并行注意力。** 在每个头内部运行缩放点积注意力。每个头输出 `(N, d_head)`。各头在嵌入的不同子空间上运作，且在注意力计算本身的过程中互不通信。

**拼接与投影。** 把各头重新堆叠为 `(N, d_model)`，再乘以形状为 `(d_model, d_model)` 的可学习输出矩阵 `W_o`。`W_o` 正是各头信息混合的地方。

**为什么有效。** 每个头可以专攻一类模式，而不必与其他头争夺表示预算。2019–2024 年的探针研究展示了各头截然不同的分工：位置头、关注前一个 token 的头、复制头、命名实体头、归纳头（in-context learning 的基础）。

**2026 年的各种变体谱系：**

| 变体 | Q 头数 | K/V 头数 | 使用者 |
|---------|---------|-----------|---------|
| Multi-head (MHA) | N | N | GPT-2, BERT, T5 |
| Multi-query (MQA) | N | 1 | PaLM, Falcon |
| Grouped-query (GQA) | N | G（例如 N/8） | Llama 2 70B, Llama 3+, Qwen 2+, Mistral |
| Multi-head latent (MLA) | N | 压缩为低秩 | DeepSeek-V2, V3 |

GQA 是现代默认选择，因为它将 KV 缓存内存削减至 `N/G` 分之一，同时几乎不损失质量。MLA 走得更远：把 K/V 压缩到一个隐空间，计算时再投影回来——付出 FLOPs，省下大得多的内存。

```figure
multihead-split
```

## 动手实现

### 第 1 步：在已有的单头注意力基础上切分多头

取第 02 课的 `SelfAttention`，用一对切分/拼接操作将其包装。numpy 实现见 `code/main.py`；核心逻辑是：

```python
def split_heads(X, n_heads):
    n, d = X.shape
    d_head = d // n_heads
    return X.reshape(n, n_heads, d_head).transpose(1, 0, 2)  # (heads, n, d_head)

def combine_heads(H):
    h, n, d_head = H.shape
    return H.transpose(1, 0, 2).reshape(n, h * d_head)
```

一次 reshape 加一次 transpose。没有循环。这正是 PyTorch 在 `nn.MultiheadAttention` 之下所做的事。

### 第 2 步：对每个头运行缩放点积注意力

每个头拿到自己的 Q、K、V 切片。注意力变成一个批量矩阵乘法：

```python
def mha_forward(X, W_q, W_k, W_v, W_o, n_heads):
    Q = X @ W_q
    K = X @ W_k
    V = X @ W_v
    Qh = split_heads(Q, n_heads)         # (heads, n, d_head)
    Kh = split_heads(K, n_heads)
    Vh = split_heads(V, n_heads)
    scores = Qh @ Kh.transpose(0, 2, 1) / np.sqrt(Qh.shape[-1])
    weights = softmax(scores, axis=-1)
    out = weights @ Vh                    # (heads, n, d_head)
    concat = combine_heads(out)
    return concat @ W_o, weights
```

在真实硬件上，`Qh @ Kh.transpose(...)` 就是一次 `bmm`。GPU 看到的是形状为 `(heads, N, d_head) × (heads, d_head, N) -> (heads, N, N)` 的单个批量矩阵乘法。增加头数是免费的。

### 第 3 步：Grouped-Query Attention 变体

只有键和值的投影发生改变。Q 有 `n_heads` 组；K 和 V 有 `n_kv_heads < n_heads` 组，并通过重复来匹配：

```python
def gqa_project(X, W, n_kv_heads, n_heads):
    kv = split_heads(X @ W, n_kv_heads)       # (kv_heads, n, d_head)
    repeat = n_heads // n_kv_heads
    return np.repeat(kv, repeat, axis=0)      # (n_heads, n, d_head)
```

在推理阶段这能节省内存，因为 KV 缓存中只存 `n_kv_heads` 份副本，而不是 `n_heads` 份。Llama 3 70B 使用 64 个查询头配 8 个 KV 头——缓存缩小为 1/8。

### 第 4 步：探查每个头学到了什么

在一个短句上运行 4 个头的 MHA。对每个头，打印其 `(N, N)` 注意力矩阵。你会看到不同的头即使在随机初始化下也会挑出不同的结构——这部分是信号，部分是子空间的旋转对称性。

## 使用它

PyTorch 中的一行版本：

```python
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=512, num_heads=8, batch_first=True)
```

PyTorch 2.5+ 中支持 GQA 的版本：

```python
from torch.nn.functional import scaled_dot_product_attention

# scaled_dot_product_attention auto-dispatches Flash Attention on CUDA.
# For GQA, pass Q of shape (B, n_heads, N, d_head) and K,V of shape
# (B, n_kv_heads, N, d_head). PyTorch handles the repeat.
out = scaled_dot_product_attention(q, k, v, is_causal=True, enable_gqa=True)
```

**头数选多少？** 来自 2026 年生产模型的经验法则：

| 模型规模 | d_model | n_heads | d_head |
|------------|---------|---------|--------|
| Small (~125M) | 768 | 12 | 64 |
| Base (~350M) | 1024 | 16 | 64 |
| Large (~1B) | 2048 | 16 | 128 |
| Frontier (~70B) | 8192 | 64 | 128 |

`d_head` 几乎总是取 64 或 128。它是一个头能"看到"多少信息的单位。低于 32，头会开始与缩放因子 `sqrt(d_head)` 较劲；高于 256，你就失去了"多个小型专家"的好处。

## 上线部署

见 `outputs/skill-mha-configurator.md`。该技能会在给定参数预算、序列长度和部署目标的情况下，为新 Transformer 推荐头数、KV 头数和投影策略。

## 练习

1. **简单。** 取 `code/main.py` 中的 MHA，在固定 `d_model=64` 的情况下把 `n_heads` 从 1 改到 16。绘制一个微型单层模型在合成复制任务上的损失曲线。更多的头是有帮助、趋于平缓，还是有害？
2. **中等。** 实现 MQA（所有查询头共享一个 KV 头）。测量参数量相对完整 MHA 下降多少。计算在 N=2048 时推理阶段 KV 缓存大小缩小多少。
3. **困难。** 实现一个迷你版 Multi-head Latent Attention：把 K、V 压缩为秩为 `r` 的隐表示，将隐表示存入 KV 缓存，注意力计算时解压。当 `r` 为多少时，缓存内存降到完整 MHA 的 1/8 以下，同时质量保持在验证 ppl 的 1 bit 之内？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Head | "单个注意力回路" | 一个维度为 `d_head = d_model / n_heads` 的 Q/K/V 投影，拥有自己的注意力矩阵。 |
| d_head | "头维度" | 每头的隐藏宽度；在生产中几乎总是 64 或 128。 |
| Split / combine | "重塑技巧" | 围绕注意力的 `(N, d_model) ↔ (n_heads, N, d_head)` reshape+transpose。 |
| W_o | "输出投影" | 拼接各头之后应用的 `(d_model, d_model)` 矩阵；是各头混合之处。 |
| MQA | "一个 KV 头" | Multi-Query Attention：单一共享的 K/V 投影。KV 缓存最小，有一定质量损失。 |
| GQA | "自 Llama 2 起的默认选择" | Grouped-Query Attention，含 `n_kv_heads < n_heads`；通过重复来匹配 Q。 |
| MLA | "DeepSeek 的技巧" | Multi-head Latent Attention：K、V 压缩为低秩隐表示，注意力计算时解压。 |
| Induction head | "in-context learning 背后的回路" | 一对头，负责检测先前出现过的内容并复制其后续内容。 |

## 延伸阅读

- [Vaswani et al. (2017). Attention Is All You Need §3.2.2](https://arxiv.org/abs/1706.03762) — 多头机制的原始定义。
- [Shazeer (2019). Fast Transformer Decoding: One Write-Head is All You Need](https://arxiv.org/abs/1911.02150) — MQA 论文。
- [Ainslie et al. (2023). GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints](https://arxiv.org/abs/2305.13245) — 训练后如何将 MHA 转换为 GQA。
- [DeepSeek-AI (2024). DeepSeek-V2 Technical Report](https://arxiv.org/abs/2405.04434) — MLA 及其在缓存内存上优于 MHA/GQA 的原因。
- [Olsson et al. (2022). In-context Learning and Induction Heads](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html) — 从机制层面剖析头究竟在做什么。