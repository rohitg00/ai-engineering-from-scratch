# Multi-Head Attention

> 一个注意力头一次学习一种关系。八个头学八个。头是免费的。多拿点。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段7 · 02（从头开始自我注意）
** 时间：** ~75分钟

## The Problem

一个自我注意力头计算一个注意力矩阵。该矩阵捕捉了一种关系--通常是最大限度地减少训练信号的损失的关系。如果您的数据将主动词一致、共同指代、远程话语和语法分块都纠缠在一起，那么一个头就会将它们涂抹到一个单一的软最大分布中，并失去一半的信号。

2017年Vaswani论文的解决方案是：并行运行多个注意力函数，每个函数都有自己的Q、K、V投影，并连接输出。每个头部在维度为“d_模型/ n_heads”的较小子空间中运行。总参数保持不变。表现力增强。

多头关注是2026年每台Transformer的默认配置。唯一的争论是关于 * 有多少 * 头部以及键和值是否共享投影（分组查询注意力、多查询注意力、多头潜在注意力）。

## The Concept

![Multi-head attention splits, attends, concatenates](../assets/multi-head-attention.svg)

** 分裂。**取形状为“（N，d_型号）”的“X”。投影到Q、K、V每个形状“（N，d_型号）”。重塑为'（N，n_heads，d_head）'其中' d_head = d_型号/ n_heads '。调换为“（n_heads，N，d_head）”。

** 平行参加。**在每个头脑中运行按比例的点产品关注度。每个头产生“（N，d_head）”。头部对嵌入的不同子空间进行操作，并且在注意力计算本身期间从不说话。

** 连锁和项目。**栈返回到“（N，d_模型）”并乘以形状为“（d_模型，d_模型）”的学习输出矩阵“W_o”。“W_o”是头脑混合的地方。

** 为什么它有效。**每位负责人都可以从事专业化工作，而无需与其他负责人竞争代表预算。2019年至2024年的探索性研究显示了不同的头部角色：位置头部、关注先前代币的头部、复制头部、命名实体头部、归纳头部（这是上下文学习的基础）。

** 2026年变体谱系：**

| 变体 | Q头 | K/V头 | 使用 |
|---------|---------|-----------|---------|
| 多头（MHA） | N | N | GPT-2、BERT、T5 |
| 多查询（MQA） | N | 1 | 帕拉姆、猎鹰 |
| 分组查询（GQA） | N | G（例如N/8） | Lama 2 70 B、Lama 3+、Qwen 2+、Mistral |
| 多头潜伏（MLA） | N | 压缩到低秩 | DeepSeek-V2、V3 |

GQA是现代默认设置，因为它以“N/G”的比例减少了KV缓存内存，同时保持几乎完全的质量。MLA更进一步，将K/V压缩到潜在空间中，然后在计算时投影回来--会花费FLOP，节省更多内存。

## Build It

### Step 1: split heads from the single-head attention we already have

吸取第02课中的“SelfAttention”，并用一对分开/集中对将其包裹起来。有关麻木的实现，请参阅“code/main.py”;逻辑是：

```python
def split_heads(X, n_heads):
    n, d = X.shape
    d_head = d // n_heads
    return X.reshape(n, n_heads, d_head).transpose(1, 0, 2)  # (heads, n, d_head)

def combine_heads(H):
    h, n, d_head = H.shape
    return H.transpose(1, 0, 2).reshape(n, h * d_head)
```

一次重塑，一次调换。没有循环。这正是PyTorch在“nn.MultiheadAttention”下所做的事情。

### Step 2: run scaled-dot-product attention per head

每个头都有自己的Q、K、V片段。注意力变成了批量matmul：

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

在真实硬件上“Qh @ Kh.transpose（.）”是一个“bmm”。图形处理器会看到形状“（heads，N，d_head）x（heads，d_head，N）->（heads，N，N）”的单个批量矩阵。添加头像是免费的。

### Step 3: Grouped-Query Attention variant

只有关键和价值预测发生变化。Q获得“n_heads”组; K和V获得“n_heads & n_heads & n_heads &组并重复进行匹配：

```python
def gqa_project(X, W, n_kv_heads, n_heads):
    kv = split_heads(X @ W, n_kv_heads)       # (kv_heads, n, d_head)
    repeat = n_heads // n_kv_heads
    return np.repeat(kv, repeat, axis=0)      # (n_heads, n, d_head)
```

推断这可以节省内存，因为只有“n_spel_heads”副本存在于KV缓存中，而不是“n_heads”。Llama 3 70 B使用64个查询头和8个KV头-8倍缓存缩减。

### Step 4: probe what each head learned

在一个有四个头的短句上运行MHA。对于每个头部，打印“（N，N）”注意矩阵。你会看到不同的头会挑选出不同的结构，即使是随机初始化-这部分是信号，部分是子空间中的旋转对称性。

## Use It

在PyTorch中，一行版本：

```python
import torch.nn as nn

mha = nn.MultiheadAttention(embed_dim=512, num_heads=8, batch_first=True)
```

自PyTorch 2.5+起的GQA：

```python
from torch.nn.functional import scaled_dot_product_attention

# scaled_dot_product_attention auto-dispatches Flash Attention on CUDA.
# For GQA, pass Q of shape (B, n_heads, N, d_head) and K,V of shape
# (B, n_kv_heads, N, d_head). PyTorch handles the repeat.
out = scaled_dot_product_attention(q, k, v, is_causal=True, enable_gqa=True)
```

** 有多少个头？** 2026年生产模型的经验法则：

| 模型大小 | d_模型 | n_heads | d_head |
|------------|---------|---------|--------|
| 小（~ 125 M） | 768 | 12 | 64 |
| 底座（~ 350 M） | 1024 | 16 | 64 |
| 大型（~1B） | 2048 | 16 | 128 |
| 前沿（~ 70 B） | 8192 | 64 | 128 |

“d_head”几乎总是出现在64或128处。它是一个头能“看到多少”的单位。“低于32，头部就会开始与比例因子‘squtt（d_head）’作斗争;高于256，就会失去‘许多小型专家’的好处。

## Ship It

请参阅“输出/skill-mha-configurator.md”。该技能为给定参数预算、序列长度和部署目标的新Transformer推荐人数、kv人数和投影策略。

## Exercises

1. ** 简单。**从' code/main.py&#39;中取出MHA，并将' n_heads '从1更改为16，并修复' d_mode =64 '。在合成复制任务上绘制微小单层模型的丢失。更多的头会有所帮助、趋于稳定还是受伤？
2. ** 中等。**实现MQA（所有查询头共享一个KV头）。测量参数计数与完整MHA相比下降了多少。计算N=2048时NV缓存大小在推断时缩小了多少。
3. ** 很难。**实现一个小型版本的Multi head隐性注意力：将K、V压缩到一个等级-' r ' latent，将隐性存储在KV缓存中，在注意时初始化。当质量保持在验证ppl的1/8以内时，高速缓存内存会越过完全MHA的1/8以下？

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 头 | “单一的注意力回路” | 一个维度为“d_head = d_模型/ n_heads”的Q/K/V投影，具有自己的注意力矩阵。 |
| d_head | “头部维度” | 人均隐藏宽度;生产中几乎总是64或128。 |
| 拆分/合并 | “重塑技巧” | `（N，d_model）Participate（n_heads，N，d_head）`在注意力周围重塑+转置。 |
| W_o | “产出预测” | “（d_模型，d_模型）”矩阵在连接头部后应用;其中头部混合。 |
| MQA | “一个KV头” | 多查询注意力：单一共享K/V投影。最小的KV缓存，一些质量损失。 |
| GQA | “自《大羊驼2》以来的默认情况” | 分组查询注意力，带有' n_heads '; n_heads ';重复以匹配Q。 |
| MLA | “DeepSeek的技巧” | 多头潜在注意力：K、V压缩为低级潜在注意力，在出席时解压。 |
| 感应头 | “背景学习背后的电路” | 一对头部，检测之前的事件并复制随后的事件。 |

## Further Reading

- [瓦斯瓦尼等人（2017）。注意力就是你所需要的一切§3.2.2]（https：//arxiv.org/ab/1706.03762）-最初的多头规范。
- [Shazeer（2019）。快速Transformer解码：一个写头即可]（https：//arxiv.org/ab/1911.02150）-MQA论文。
- [安斯利等人（2023）。GQA：从多头检查点训练通用多查询Transformer模型]（https：//arxiv.org/ab/2305.13245）-培训后如何将MHA转换为GQA。
- [DeepSeek-AI（2024）。DeepSeek-V2技术报告]（https：//arxiv.org/ab/2405.04434）- MLA以及为什么它在缓存内存方面击败MHA/GQA。
- [奥尔森等人（2022）。上下文学习和感应头]（https：//transformer-Circuits.pub/2022/in-context-learning-and-induction-heads/index.html）-机械地观察头实际做什么。
