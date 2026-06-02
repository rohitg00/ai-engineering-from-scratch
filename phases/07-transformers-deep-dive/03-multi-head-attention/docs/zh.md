# 多头 Attention（Multi-Head Attention）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个 attention head 一次只能学一种关系。八个 head 就能学八种。Head 不要钱，多来点。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention from Scratch)
**Time:** ~75 minutes

## 问题（The Problem）

单个 self-attention head 只算一个 attention 矩阵。这个矩阵只能捕捉一种关系——通常是当前训练信号下能让 loss 最小的那种。如果你的数据里同时有主谓一致、共指、长距离话语关系、句法切块等多种关系搅在一起，单个 head 会把它们全糊进一个 softmax 分布里，丢掉一半信号。

2017 年 Vaswani 论文给出的修法是：让多个 attention 函数并行跑，每个都有自己的 Q、K、V 投影，最后把输出拼起来。每个 head 在维度为 `d_model / n_heads` 的更小子空间里工作。总参数量不变，表达力却涨了。

到 2026 年，所有 transformer 默认都带多头 attention。唯一还在争论的是：要*多少个* head，以及 key 和 value 是否共享投影（Grouped-Query Attention、Multi-Query Attention、Multi-head Latent Attention）。

## 概念（The Concept）

![Multi-head attention splits, attends, concatenates](../assets/multi-head-attention.svg)

**切分（Split）。** 拿一个形状为 `(N, d_model)` 的 `X`。投影成 Q、K、V，每个都是 `(N, d_model)`。reshape 成 `(N, n_heads, d_head)`，其中 `d_head = d_model / n_heads`。再 transpose 成 `(n_heads, N, d_head)`。

**并行 attend。** 每个 head 内部跑 scaled dot-product attention。每个 head 输出 `(N, d_head)`。各 head 在 embedding 的不同子空间上工作，attention 计算本身从不互相通信。

**拼接并投影（Concatenate and project）。** 把各 head 拼回 `(N, d_model)`，再乘一个学出来的输出矩阵 `W_o`，形状 `(d_model, d_model)`。`W_o` 才是各 head 真正混合信息的地方。

**为什么有效。** 每个 head 都能专精某种功能，不必跟别人抢表征预算。2019–2024 年的探针（probing）研究显示，head 之间会出现明显的角色分化：位置 head、关注前一个 token 的 head、复制 head、命名实体 head、induction head（in-context learning 的底层机制）。

**2026 年的变体家谱：**

| 变体 | Q 头数 | K/V 头数 | 使用者 |
|---------|---------|-----------|---------|
| Multi-head (MHA) | N | N | GPT-2、BERT、T5 |
| Multi-query (MQA) | N | 1 | PaLM、Falcon |
| Grouped-query (GQA) | N | G（如 N/8） | Llama 2 70B、Llama 3+、Qwen 2+、Mistral |
| Multi-head latent (MLA) | N | 压缩为低秩 | DeepSeek-V2、V3 |

GQA 是当下默认，因为它能把 KV cache 内存按 `N/G` 倍缩小，同时几乎不掉质量。MLA 走得更远：把 K/V 压到一个 latent 空间里，到计算时再投影回去——多花点 FLOPs，省下更多内存。

## 动手实现（Build It）

### Step 1：从已有的单头 attention 切出多头

把 Lesson 02 的 `SelfAttention` 用一对 split/concat 包起来。numpy 实现见 `code/main.py`，逻辑就是：

```python
def split_heads(X, n_heads):
    n, d = X.shape
    d_head = d // n_heads
    return X.reshape(n, n_heads, d_head).transpose(1, 0, 2)  # (heads, n, d_head)

def combine_heads(H):
    h, n, d_head = H.shape
    return H.transpose(1, 0, 2).reshape(n, h * d_head)
```

一次 reshape 加一次 transpose，不用循环。这正是 PyTorch 在 `nn.MultiheadAttention` 底下做的事。

### Step 2：每个 head 跑 scaled-dot-product attention

每个 head 拿到自己那一片 Q、K、V。Attention 就是一次批量化的 matmul：

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

到了真实硬件上，`Qh @ Kh.transpose(...)` 就是一次 `bmm`。GPU 看到的是一次 `(heads, N, d_head) × (heads, d_head, N) -> (heads, N, N)` 的批量化 matmul。加 head 几乎不要钱。

### Step 3：Grouped-Query Attention 变体

只有 key 和 value 的投影会变。Q 还是分 `n_heads` 组；K 和 V 分成 `n_kv_heads < n_heads` 组，再复制到与 Q 对齐：

```python
def gqa_project(X, W, n_kv_heads, n_heads):
    kv = split_heads(X @ W, n_kv_heads)       # (kv_heads, n, d_head)
    repeat = n_heads // n_kv_heads
    return np.repeat(kv, repeat, axis=0)      # (n_heads, n, d_head)
```

推理时这能省内存，因为 KV cache 里只活着 `n_kv_heads` 份拷贝，而不是 `n_heads` 份。Llama 3 70B 用 64 个 query head 配 8 个 KV head——cache 直接缩小 8 倍。

### Step 4：探一探每个 head 学到了什么

在一个短句上跑 4 个 head 的 MHA。给每个 head 打印它的 `(N, N)` attention 矩阵。哪怕用随机初始化，你也会看到不同 head 各自挑出不同结构——一部分是真信号，一部分是子空间里的旋转对称性。

## 用起来（Use It）

PyTorch 里的一行版：

```python
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=512, num_heads=8, batch_first=True)
```

PyTorch 2.5+ 的 GQA：

```python
from torch.nn.functional import scaled_dot_product_attention

# scaled_dot_product_attention auto-dispatches Flash Attention on CUDA.
# For GQA, pass Q of shape (B, n_heads, N, d_head) and K,V of shape
# (B, n_kv_heads, N, d_head). PyTorch handles the repeat.
out = scaled_dot_product_attention(q, k, v, is_causal=True, enable_gqa=True)
```

**到底用多少个 head？** 2026 年生产模型的经验值：

| 模型规模 | d_model | n_heads | d_head |
|------------|---------|---------|--------|
| Small (~125M) | 768 | 12 | 64 |
| Base (~350M) | 1024 | 16 | 64 |
| Large (~1B) | 2048 | 16 | 128 |
| Frontier (~70B) | 8192 | 64 | 128 |

`d_head` 几乎永远落在 64 或 128。它衡量的是一个 head 能「看见」多少东西。低于 32，head 就开始跟缩放因子 `sqrt(d_head)` 较劲；高于 256，「一群小专家」的好处又没了。

## 上线部署（Ship It）

见 `outputs/skill-mha-configurator.md`。这个 skill 会根据参数预算、序列长度、部署目标，为一个新的 transformer 推荐 head 数、KV head 数和投影策略。

## 练习（Exercises）

1. **简单。** 把 `code/main.py` 里的 MHA 拿来，固定 `d_model=64`，把 `n_heads` 从 1 调到 16。在一个合成的复制任务上画出单层小模型的 loss 曲线。head 越多越好、有平台期，还是反而变差？
2. **中等。** 实现 MQA（所有 query head 共享一个 KV head）。测一下相比完整 MHA 参数量降了多少。再算一下在 N=2048 时推理阶段 KV cache 缩小了多少。
3. **困难。** 实现一个迷你版 Multi-head Latent Attention：把 K、V 压成秩为 `r` 的 latent，把 latent 存进 KV cache，attention 时再解压。`r` 取多大时，cache 内存能跌破完整 MHA 的 1/8，而验证集 ppl 又只多 1 bit 以内？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Head | "一条 attention 电路" | 一组维度为 `d_head = d_model / n_heads` 的 Q/K/V 投影，带自己的 attention 矩阵。 |
| d_head | "head 维度" | 单 head 的隐藏宽度；生产里几乎都是 64 或 128。 |
| Split / combine | "reshape 小把戏" | 在 attention 前后做 `(N, d_model) ↔ (n_heads, N, d_head)` 的 reshape+transpose。 |
| W_o | "输出投影" | 拼接 head 后再乘上的 `(d_model, d_model)` 矩阵；各 head 在这里混合。 |
| MQA | "只有一个 KV head" | Multi-Query Attention：共享单个 K/V 投影。KV cache 最小，质量略掉。 |
| GQA | "Llama 2 之后的默认" | Grouped-Query Attention，`n_kv_heads < n_heads`；通过复制对齐 Q。 |
| MLA | "DeepSeek 的招" | Multi-head Latent Attention：K、V 压成低秩 latent，attend 时再解压。 |
| Induction head | "in-context learning 背后的电路" | 一对 head，负责检测前面出现过的 token 并复制紧随其后的内容。 |

## 延伸阅读（Further Reading）

- [Vaswani et al. (2017). Attention Is All You Need §3.2.2](https://arxiv.org/abs/1706.03762) — multi-head 的最初定义。
- [Shazeer (2019). Fast Transformer Decoding: One Write-Head is All You Need](https://arxiv.org/abs/1911.02150) — MQA 论文。
- [Ainslie et al. (2023). GQA: Training Generalized Multi-Query Transformer Models from Multi-Head Checkpoints](https://arxiv.org/abs/2305.13245) — 训练后如何把 MHA 转成 GQA。
- [DeepSeek-AI (2024). DeepSeek-V2 Technical Report](https://arxiv.org/abs/2405.04434) — MLA 介绍，以及为什么它在 cache 内存上吊打 MHA/GQA。
- [Olsson et al. (2022). In-context Learning and Induction Heads](https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html) — 从机制可解释性角度看 head 实际在干什么。
