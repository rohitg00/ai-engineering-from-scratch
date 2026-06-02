# Native Sparse Attention（DeepSeek NSA）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 64k token 时，attention（注意力）吃掉 70-80% 的 decode 延迟。每一家开放模型实验室都有方案要修这件事。DeepSeek 的 NSA（ACL 2025 最佳论文）是真正立得住的那一个：三条并行的 attention 分支——压缩后的粗粒度 token、有选择保留的细粒度 token，以及覆盖局部上下文的滑动窗口——通过一个学习得到的门（gate）组合起来。它对硬件友好（kernel 友好）、原生可训（native trainable，能用在 pretraining，而不是在推理时硬加上去），在 64k 解码上比 FlashAttention 还快，同时质量与 full attention 持平甚至更好。本课会端到端搭出这三条分支，并展示为什么这种 sparsity 是端到端可微的。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 7 · 12（KV cache、flash-attention）、Phase 7 · 15（attention 变体）、Phase 10 · 16（differential attention）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 说出 NSA 的三条 attention 分支，以及每条分支各自捕获什么。
- 解释为什么 NSA 是「natively trainable」（原生可训），而此前的 sparse attention 方法只能用在推理阶段。
- 计算 64k context 下 NSA 相对 full attention 的 attention 计算量节省，作为压缩 block 大小与 top-k 选取数量的函数。
- 用 stdlib Python 在一段短的合成序列上实现三分支组合，并验证 gate 权重的行为符合预期。

## 问题（The Problem）

序列长度为 N 的 full attention 每层耗时 `O(N^2)`，KV cache 占用 `O(N)`。在 64k token 上，计算与显存带宽的数字都是灾难级。NSA 论文给出的理论估算：在 64k 时，attention 占总 decode 延迟的 70-80%。下游一切——TTFT、tokens/sec、每百万 token 成本——都被 attention 成本主导。

Sparse attention（稀疏注意力）是显而易见的答案。此前的尝试可以分两类。固定模式 sparsity（滑动窗口、跨步、块局部）会丢掉信息，在长程召回任务上失败。推理期 sparsity（KV cache 剪枝、H2O、StreamingLLM）作用在已经按 dense attention 预训练好的模型上，只能拿到潜在加速的一小部分，因为模型从来没被要求把信息路由到这种 sparse 模式中去。

Native Sparse Attention（Yuan 等，DeepSeek + PKU + UW，ACL 2025 最佳论文，arXiv:2502.11089）两件事都做了：一种模型在 pretraining 期间就学到的 sparsity 模式，且通过一个 kernel 对齐的算法实现，能在推理时真正兑现计算节省。两年之内，每一个前沿长上下文模型上默认的 attention 都会是 NSA 或它的直系后继。

## 概念（The Concept）

### 三条并行分支（Three parallel branches）

对每个 query，NSA 在 KV cache 的三种不同视图上各跑一次 attention：

1. **压缩分支（Compressed branch）。** token 按大小为 `l` 的块（典型为 32 或 64）分组。每个块通过一个小的学习 MLP 压缩成一个汇总 token。query 在这些压缩 token 上做 attention，得到对整条序列的粗粒度视图。

2. **选择分支（Selected branch）。** 利用压缩分支得到的 attention 分数，识别出与当前 query 最相关的 top-k 个块。从这些块里读取细粒度（未压缩）token，让 query 对它们整体做 attention。可以把压缩分支的 attention 看作「选择」的路由信号。

3. **滑动窗口分支（Sliding-window branch）。** query 对最近的 `W` 个 token（典型为 512）做 attention，提供局部上下文。这条分支负责捕获另外两条容易漏掉的、结构密集的短程模式（句法、局部共指）。

三条分支的输出通过一个学习得到的、按位置的 gate 组合起来：

```
out = g_cmp * out_cmp + g_sel * out_sel + g_win * out_win
```

`g_cmp, g_sel, g_win` 来自一个作用在 query 上的小 MLP。它们不必加和为 1——可以独立地给三条分支分配权重。

### 为什么这是「natively trainable」（Why this is "natively trainable"）

选择那一步（top-k blocks）是离散的。离散操作会切断 gradient（梯度）流。此前的 sparse attention 工作要么跳过对选择步骤的反向传播（限制了训练），要么用连续松弛——在推理时拿不到真正的 sparsity。

NSA 绕开了这一点：压缩分支的 attention 本身就是一个对整条序列的、可微的粗粒度 attention。top-k 操作只是复用压缩分支里已有的 top attention 分数，来决定哪些细粒度块要载入。梯度通过压缩分支的分数流动（它同时影响压缩输出 *和* 选择逻辑），而被选中块对最终输出的贡献也是可微的。不可微的 `top_k` 操作在前向计算图上是一个 no-op——它只控制哪些块从内存里加载。

正因如此，NSA 才能端到端用在 pretraining（预训练）里。模型学会联合地把信息路由到三条分支上，得到的 sparse 模式在推理时真正能兑现承诺的加速。

### 硬件对齐的 kernel（Hardware-aligned kernel）

NSA 的 kernel 是为现代 GPU 显存层次设计的。kernel 按 GQA 分组载入 query（外层循环），按组取对应的 sparse KV 块（内层循环），在 SRAM 上跑 attention。因为同一个 query group 看到的是同一组被选中的块（选择是 per-query-group 的，而不是 per-query-head 的），KV 加载的代价被整组分摊。算术强度（arithmetic intensity）保持很高。

论文报告：在 64k decode 上，Triton kernel 跑得比 FlashAttention 快 9 倍，加速比随序列长度增加。前向和反向 kernel 都已提供。

### 计算预算（The compute budget）

设 `N` 为序列长度，`l` 为压缩 block 大小，`k` 为 top-k 选择数，`w` 为滑动窗口，`b` 为被选中块的大小（典型等于 `l`）。

- 压缩分支：每个 query 看到 `O(N/l)` 个 key，总计 `O(N * N / l)`。
- 选择分支：每个 query 看到 `O(k * b)` 个 key，总计 `O(N * k * b)`。
- 滑动分支：每个 query 看到 `O(w)` 个 key，总计 `O(N * w)`。

总和：`O(N * (N/l + k*b + w))`。

代入 `N = 64k, l = 64, k = 16, b = 64, w = 512`：每 query 代价是 `1000 + 1024 + 512 = 2536` 个 key。Full attention 是 `64000` 个 key。计算量缩 25 倍。

代入 `N = 128k, l = 64, k = 16, b = 64, w = 512`：每 query 代价是 `2000 + 1024 + 512 = 3536` 个 key。Full attention 是 `128000` 个 key。缩 36 倍。收益随序列长度增长——这正是这件事的意义。

### 与其他方法对比（How does it compare）

| 方法 | 可微 | 推理期真正加速 | 长程召回 |
|--------|---------------|----------------------|-------------------|
| 仅滑动窗口 | 是 | 是 | 失败 |
| Strided / block-sparse | 是 | 是 | 部分 |
| KV pruning（H2O、StreamingLLM） | N/A（推理期） | 是 | 部分 |
| MoBA（Moonshot） | 部分 | 是 | 好 |
| NSA | 是（原生） | 是（64k 上 9 倍） | 与 full attention 持平 |

MoBA（Moonshot，arXiv:2502.13189）几乎同时发表，思路相似——三个比一个好——把 MoE 原则用到 attention 块上。NSA 与 MoBA 是 2026 年长上下文 pretraining 必须知道的两种架构。

## 动手实现（Build It）

`code/main.py` 在一段短的合成序列上实现三条分支，并展示：

- 压缩 MLP（出于教学清晰，这里用一个简单的 mean-pool 基线；真实 NSA 用的是学习得到的 MLP）。
- 由压缩分支分数驱动的 top-k 块选择。
- 在最近 `w` 个 token 上的滑动窗口 attention。
- gated 组合。
- 与 full attention 相比的计算量打印。

### Step 1：把 token 压缩成块（compress tokens into blocks）

```python
def compress(K, l):
    n = len(K)
    n_blocks = (n + l - 1) // l
    out = []
    for b in range(n_blocks):
        start, end = b * l, min((b + 1) * l, n)
        block = K[start:end]
        summary = [sum(row[d] for row in block) / len(block) for d in range(len(K[0]))]
        out.append(summary)
    return out
```

### Step 2：压缩分支 attention（compressed-branch attention）

让 query 对压缩后的 key 做 softmax attention。压缩分支分数同时充当 top-k 选择的信号。

### Step 3：top-k 块选择（top-k block selection）

挑出 `k` 个分数最高的压缩块的索引。从这些块里加载原始未压缩 token，并对它们做 attention。

### Step 4：滑动窗口 attention（sliding-window attention）

取最后 `w` 个 token，对它们做标准 attention。

### Step 5：gate + 组合（gate + combine）

一个作用在 query 上的小 MLP 产出三个 gate 权重。最终输出是三条分支输出的加权和。

### Step 6：计算量计数（compute counting）

对每条分支，打印每 query 实际看到的 key 数以及总数。与 `N`（full attention）对比。在一段 1024 token 的合成数据上，取 `l = 32, k = 4, w = 128`，NSA 每 query 看到 `32 + 128 + 128 = 288` 个 key，而 full attention 是 1024 个——少了 3.5 倍。

## 用起来（Use It）

NSA 已经在 DeepSeek 自己的长上下文 pretraining 流水线里落地。截至 2026 年 4 月，公开推理栈中的集成情况：

- **DeepSeek 内部**：原生支持，已发布的权重使用 NSA 或其后继 DSA（Deepseek Sparse Attention）。
- **vLLM**：针对 DeepSeek-V3.x 权重的 NSA 支持处于实验阶段、开发中。
- **SGLang**：发布了 NSA 基准；生产路径跟随 vLLM。
- **llama.cpp / CPU**：不支持；在 CPU 吞吐下，kernel 拆分的开销不值。

什么时候考虑 NSA：

- 目标 64k+ context、计算预算认真的 pretraining 或 continued-training。
- 推理 DeepSeek 自己的长上下文 checkpoint。这些权重是 NSA-native 的。

什么时候不要：

- 服务一个已有的 dense-attention 预训练模型。没有继续训练的话，NSA 装不回去。
- context 不到 16k。三分支的开销盖过了节省。
- batch-1 的交互式聊天。延迟敏感的 decode 是受益方，但只在长上下文下才明显。

## 上线部署（Ship It）

本课产出 `outputs/skill-nsa-integrator.md`。给定一个长上下文 pretraining 跑的规格，它会输出一份 NSA 集成计划：压缩 block 大小、top-k、滑动窗口、gate MLP 宽度、kernel 选型，以及能为这次架构变更买单的具体长上下文评估（eval）。

## 练习（Exercises）

1. 在一段 1024 token 的合成序列上跑 `code/main.py`。在三组预设上扫 `(l, k, w)`，打印计算量计数。挑出在保持 needle-in-haystack 测试相对 full attention 95% 召回的前提下、每 query key 数最少的那组预设。

2. 把 mean-pool 压缩器换成一个微型的学习 MLP（两层，hidden 32）。在一个「信号即块平均值」的合成任务上训它。在 held-out 数据上测它相对 mean-pool 基线的 perplexity 差距。

3. 实现 gate MLP。它把 query 当输入，输出三个标量。证明 gate 表现合理：随机 query 上接近均匀加权；当 query 命中一个很靠后的块时，权重会重重压在选择分支上。

4. 计算一个支持 NSA 的 70B 模型在 128k context 下的 KV cache 显存预算。KV head 数 8、head dim 128、BF16。与 full attention 以及 MLA（Phase 10 · 14 给过 MLA 的数）对比。找出 NSA 细粒度分支 KV cache 等于 full attention 的那个序列长度。

5. 读 NSA 论文（arXiv:2502.11089）的第 4 节，并用三句话解释为什么压缩分支的 attention 分数被复用于 top-k 选择，而不是再算一个独立的路由分数。把答案与 gradient 流挂钩。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|------|----------------|------------------------|
| 压缩分支（Compressed branch） | "Coarse view" | 在按块平均后的 key 上做 attention，每 query 用 O(N/l) 个 key 提供全局上下文 |
| 选择分支（Selected branch） | "Top-k blocks" | 在压缩分支分数最高的 `k` 个块上做细粒度 attention |
| 滑动窗口（Sliding window） | "Local context" | 在最近 `W` 个 token 上做 attention，捕获短程模式 |
| 原生可训性（Native trainability） | "Pre-train with the sparsity on" | sparsity 模式在 pretraining 期间被学习，而不是推理时硬加 |
| 压缩 block 大小 l | "Group size for coarse view" | 多少个 token 合并为一个汇总；典型 32-64 |
| Top-k | "Blocks to keep" | 有多少压缩块的未压缩 token 会被读取；典型 16 |
| 滑动窗口 W | "Local attention radius" | 典型 512；更短伤局部连贯性，更长浪费算力 |
| 分支 gate（Branch gate） | "How to mix the three" | 按位置的 MLP 输出，给三条分支的贡献加权 |
| 硬件对齐（Hardware alignment） | "Kernel-friendly sparsity" | sparse 模式的选择保证真实 GPU kernel 能拿到理论加速 |
| DSA | "NSA's successor" | Deepseek Sparse Attention，DeepSeek 在 NSA 之后的下一代架构 |

## 延伸阅读（Further Reading）

- [Yuan et al. — Native Sparse Attention: Hardware-Aligned and Natively Trainable Sparse Attention (arXiv:2502.11089, ACL 2025 Best Paper)](https://arxiv.org/abs/2502.11089) — 原论文
- [DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — NSA 服务的架构家族
- [Moonshot AI — MoBA: Mixture of Block Attention for Long-Context LLMs (arXiv:2502.13189)](https://arxiv.org/abs/2502.13189) — 同期工作，把 MoE 风格用到块级 attention
- [Beltagy et al. — Longformer: The Long-Document Transformer (arXiv:2004.05150)](https://arxiv.org/abs/2004.05150) — 滑动窗口的源头
- [Xiao et al. — StreamingLLM: Efficient Streaming Language Models with Attention Sinks (arXiv:2309.17453)](https://arxiv.org/abs/2309.17453) — NSA 改进的推理期 sparsity 基线
- [Dao et al. — FlashAttention-2 (arXiv:2307.08691)](https://arxiv.org/abs/2307.08691) — NSA kernel 在 64k 上击败的 full-attention 基线
