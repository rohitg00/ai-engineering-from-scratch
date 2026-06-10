# 03 · 多头注意力

> 一个注意力头一次只能学到一种关系。八个头就能学到八种。头是免费的，多用一些吧。

**类型：** 构建
**语言：** Python
**前置：** 第 7 阶段 · 02（从零实现自注意力）
**时长：** 约 75 分钟

## 问题所在

单个自注意力（self-attention）头只计算一个注意力矩阵。这个矩阵只能捕捉一种关系——通常是能让训练信号上的损失最小化的那一种。如果你的数据里同时纠缠着主谓一致、共指（co-reference）、长程语篇结构和句法切分，单个头会把它们全部抹平进一个 soft-max 分布里，丢掉一半的信号。

2017 年 Vaswani 那篇论文给出的解法是：并行运行若干个注意力函数，每个都有自己独立的 Q、K、V 投影，再把各自的输出拼接起来。每个头都在一个维度为 `d_model / n_heads` 的更小子空间里运作。总参数量保持不变，但表达能力上升了。

多头注意力（multi-head attention）是 2026 年所有 transformer 默认自带的配置。唯一还有争议的，是头要用*多少个*，以及键和值是否共享投影（分组查询注意力 Grouped-Query Attention、多查询注意力 Multi-Query Attention、多头潜在注意力 Multi-head Latent Attention）。

## 核心概念

〔图：多头注意力的拆分、并行注意、拼接流程〕

**拆分（Split）。** 取形状为 `(N, d_model)` 的 `X`。投影出 Q、K、V，每个形状都是 `(N, d_model)`。重塑（reshape）为 `(N, n_heads, d_head)`，其中 `d_head = d_model / n_heads`。再转置（transpose）为 `(n_heads, N, d_head)`。

**并行注意（Attend in parallel）。** 在每个头内部运行缩放点积注意力（scaled dot-product attention）。每个头产出 `(N, d_head)`。各个头在嵌入的不同子空间上运作，在注意力计算本身的过程中彼此从不交流。

**拼接并投影（Concatenate and project）。** 把各个头堆叠回 `(N, d_model)`，再乘以一个形状为 `(d_model, d_model)` 的可学习输出矩阵 `W_o`。`W_o` 正是各个头得以混合的地方。

**为什么有效。** 每个头都可以专门化（specialize），而不必与其他头争抢表征预算。2019–2024 年的探查（probing）研究显示出明显不同的头角色：位置头、关注前一个 token 的头、复制头（copy head）、命名实体头，以及归纳头（induction head，它是上下文学习的底层机制）。

**2026 年的变体谱系：**

| 变体 | Q 头数 | K/V 头数 | 使用者 |
|---------|---------|-----------|---------|
| 多头（MHA） | N | N | GPT-2、BERT、T5 |
| 多查询（MQA） | N | 1 | PaLM、Falcon |
| 分组查询（GQA） | N | G（例如 N/8） | Llama 2 70B、Llama 3+、Qwen 2+、Mistral |
| 多头潜在（MLA） | N | 压缩为低秩 | DeepSeek-V2、V3 |

GQA 之所以成为现代默认方案，是因为它把 KV 缓存（KV-cache）内存削减了 `N/G` 倍，同时几乎保持完整的质量。MLA 走得更远，它把 K/V 压缩到一个潜在空间，再在计算时投影回来——花费 FLOPs，换来省下多得多的内存。

## 动手构建

### 第 1 步：从已有的单头注意力中拆分出多头

取第 02 课的 `SelfAttention`，用一对拆分/拼接操作把它包起来。numpy 实现见 `code/main.py`；其逻辑是：

```python
def split_heads(X, n_heads):
    n, d = X.shape
    d_head = d // n_heads
    return X.reshape(n, n_heads, d_head).transpose(1, 0, 2)  # (heads, n, d_head)

def combine_heads(H):
    h, n, d_head = H.shape
    return H.transpose(1, 0, 2).reshape(n, h * d_head)
```

一次 reshape，一次 transpose。没有循环。这正是 PyTorch 在 `nn.MultiheadAttention` 底层所做的事。

### 第 2 步：对每个头运行缩放点积注意力

每个头拿到属于自己的那一片 Q、K、V。注意力就变成了一次批量矩阵乘法（batched matmul）：

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

在真实硬件上，`Qh @ Kh.transpose(...)` 就是一次 `bmm`。GPU 看到的是一次形状为 `(heads, N, d_head) × (heads, d_head, N) -> (heads, N, N)` 的批量矩阵乘法。增加头数是免费的。

### 第 3 步：分组查询注意力（GQA）变体

只需改动键和值的投影。Q 拿到 `n_heads` 个分组；K 和 V 拿到 `n_kv_heads < n_heads` 个分组，并通过重复来对齐数量：

```python
def gqa_project(X, W, n_kv_heads, n_heads):
    kv = split_heads(X @ W, n_kv_heads)       # (kv_heads, n, d_head)
    repeat = n_heads // n_kv_heads
    return np.repeat(kv, repeat, axis=0)      # (n_heads, n, d_head)
```

在推理时这能省内存，因为 KV 缓存里只存活着 `n_kv_heads` 份拷贝，而非 `n_heads` 份。Llama 3 70B 使用 64 个查询头配 8 个 KV 头——缓存缩小 8 倍。

### 第 4 步：探查每个头学到了什么

在一个短句子上用 4 个头运行 MHA。对每个头，打印其 `(N, N)` 注意力矩阵。你会看到即便是随机初始化，不同的头也会挑选出不同的结构——这一部分来自真实信号，一部分来自子空间中的旋转对称性。

## 实际使用

在 PyTorch 中，一行版本：

```python
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=512, num_heads=8, batch_first=True)
```

PyTorch 2.5+ 起的 GQA：

```python
from torch.nn.functional import scaled_dot_product_attention

# scaled_dot_product_attention 在 CUDA 上会自动派发到 Flash Attention。
# 对于 GQA，传入形状为 (B, n_heads, N, d_head) 的 Q，以及形状为
# (B, n_kv_heads, N, d_head) 的 K、V。PyTorch 会处理重复对齐。
out = scaled_dot_product_attention(q, k, v, is_causal=True, enable_gqa=True)
```

**用多少个头？** 来自 2026 年生产模型的经验法则：

| 模型规模 | d_model | n_heads | d_head |
|------------|---------|---------|--------|
| 小型（约 125M） | 768 | 12 | 64 |
| 基础（约 350M） | 1024 | 16 | 64 |
| 大型（约 1B） | 2048 | 16 | 128 |
| 前沿（约 70B） | 8192 | 64 | 128 |

`d_head` 几乎总是落在 64 或 128。它是衡量单个头能"看见"多少的单位。低于 32，头就会开始与缩放因子 `sqrt(d_head)` 较劲；高于 256，你就会失去"许多小型专家"带来的好处。

## 交付落地

参见 `outputs/skill-mha-configurator.md`。该技能会根据参数预算、序列长度和部署目标，为一个新的 transformer 推荐头数、KV 头数和投影策略。

## 练习

1. **简单。** 取 `code/main.py` 中的 MHA，在固定 `d_model=64` 的前提下，把 `n_heads` 从 1 改到 16。在一个合成的复制任务上，绘制一个极小的单层模型的损失曲线。增加头数是有帮助、趋于平台期，还是有害？
2. **中等。** 实现 MQA（一个 KV 头被所有查询头共享）。测量相对完整 MHA 参数量下降了多少。计算在 N=2048 时推理阶段 KV 缓存大小缩小了多少。
3. **困难。** 实现一个极小版本的多头潜在注意力（MLA）：把 K、V 压缩到一个秩为 `r` 的潜在表示，把该潜在表示存进 KV 缓存，在注意力计算时解压。在 `r` 取多少时，缓存内存会降到完整 MHA 的 1/8 以下，而质量仍保持在验证困惑度（ppl）的 1 bit 之内？

## 关键术语

| 术语 | 大家怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 头（Head） | "单个注意力回路" | 一组维度为 `d_head = d_model / n_heads`、拥有自己注意力矩阵的 Q/K/V 投影。 |
| d_head | "头维度" | 每个头的隐藏宽度；在生产中几乎总是 64 或 128。 |
| 拆分 / 合并（Split / combine） | "重塑技巧" | 在注意力前后做的 `(N, d_model) ↔ (n_heads, N, d_head)` reshape+transpose。 |
| W_o | "输出投影" | 在拼接各头之后施加的 `(d_model, d_model)` 矩阵；各头混合之处。 |
| MQA | "一个 KV 头" | 多查询注意力：单个共享的 K/V 投影。KV 缓存最小，但有一定质量损失。 |
| GQA | "Llama 2 起的默认方案" | 分组查询注意力，`n_kv_heads < n_heads`；通过重复对齐 Q。 |
| MLA | "DeepSeek 的招数" | 多头潜在注意力：K、V 压缩为低秩潜在表示，在注意力计算时解压。 |
| 归纳头（Induction head） | "上下文学习背后的回路" | 一对头，检测先前出现过的内容并复制紧随其后的部分。 |

## 延伸阅读

- [Vaswani et al. (2017). Attention Is All You Need §3.2.2](https://arxiv.org/abs/1706.03762) —— 最初的多头规范。
- [Shazeer (2019). Fast Transformer Decoding: One Write-Head is All You Need](https://arxiv.org/abs/1911.02150) —— MQA 论文。
- [Ainslie et al. (2023). GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints](https://arxiv.org/abs/2305.13245) —— 如何在训练后把 MHA 转换为 GQA。
- [DeepSeek-AI (2024). DeepSeek-V2 Technical Report](https://arxiv.org/abs/2405.04434) —— MLA，以及它为何在缓存内存上胜过 MHA/GQA。
- [Olsson et al. (2022). In-context Learning and Induction Heads](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html) —— 从机制角度看头实际在做什么。
