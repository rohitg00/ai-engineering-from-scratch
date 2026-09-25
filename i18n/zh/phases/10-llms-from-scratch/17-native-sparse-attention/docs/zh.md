# 原生稀疏注意力（DeepSeek NSA）

> 在 64k tokens 时，注意力占解码延迟的 70-80%。每家开源模型实验室都有修复方案。DeepSeek 的 NSA（ACL 2025 最佳论文）是最终站得住的那个：三条并行的注意力分支——压缩后的粗粒度 token、选择性保留的细粒度 token、以及用于局部上下文的滑动窗口——通过一个可学习的门控组合起来。它与硬件对齐（对 kernel 友好）、可原生训练（可用于预训练，而非推理时事后附加），并且在 64k 解码时运行速度超过 FlashAttention，同时质量与全注意力持平或更优。本课程将端到端地构建这三条分支，并解释为什么稀疏性是端到端可微的。

**Type:** Build
**Languages:** Python（标准库）
**Prerequisites:** Phase 7 · 12（KV cache、flash-attention）、Phase 7 · 15（注意力变体）、Phase 10 · 16（差分注意力）
**Time:** 约 60 分钟

## 学习目标

- 说出 NSA 的三条注意力分支以及各自捕获的内容。
- 解释为什么在以往稀疏注意力方法仅限推理时使用的情况下，NSA 是“可原生训练”的。
- 以压缩块大小和选择 top-k 为函数，计算在 64k 上下文下 NSA 相对全注意力的计算量节省。
- 在标准库 Python 中于短合成序列上实现三分支组合，并验证门控权重行为合理。

## 问题所在

序列长度为 N 的全注意力每层需要 `O(N^2)` 时间和 `O(N)` KV cache。在 64k tokens 时，计算量和内存带宽数字是灾难性的。NSA 论文的实测理论估计：在 64k 时，注意力占总解码延迟的 70-80%。下游的一切——TTFT、tokens/sec、每百万 token 成本——都被注意力成本主导。

稀疏注意力是显而易见的答案。此前的尝试分为两类。固定模式稀疏性（滑动窗口、跨步、块局部）会丢弃信息，在长程召回任务上失败。推理时稀疏性（KV cache 剪枝、H2O、StreamingLLM）应用于以稠密注意力预训练的模型，只能恢复潜在加速的一小部分，因为模型从未被要求通过稀疏模式路由信息。

原生稀疏注意力（Native Sparse Attention，Yuan et al., DeepSeek + 北京大学 + 华盛顿大学，ACL 2025 最佳论文，arXiv:2502.11089）两者兼顾：稀疏模式在预训练期间由模型学习，并以一个与 kernel 对齐的算法实现，在推理时真正交付计算量节省。两年之后，NSA 或其直系后代将成为所有前沿长上下文模型的默认注意力机制。

## 核心概念

### 三条并行分支

对每个 query，NSA 针对 KV cache 的三个不同视图运行三次注意力：

1. **压缩分支。** token 被分组为大小为 `l` 的块（通常为 32 或 64）。每个块通过一个小的可学习 MLP 压缩为单个摘要 token。query 在这些压缩 token 上做注意力，得到整个序列的粗粒度视图。

2. **选择分支。** 利用来自压缩分支的注意力分数，识别出与当前 query 最相关的 top-k 块。读取这些块中的细粒度（未压缩）token，query 在其上做注意力。可以把压缩分支的注意力理解为选择过程的路由信号。

3. **滑动窗口分支。** query 关注最近的 `W` 个 token（通常为 512）作为局部上下文。该分支捕获其他两条分支可能遗漏的结构密集型短程模式（句法、局部共指）。

三条分支的输出通过一个可学习的逐位置门控组合：

```
out = g_cmp * out_cmp + g_sel * out_sel + g_win * out_win
```

`g_cmp, g_sel, g_win` 是基于 query 的小型 MLP 得到的门控权重。它们不必和为 1——可以独立地对各分支加权。

### 为什么这是“可原生训练的”

选择步骤（top-k 块）是离散的。离散操作会破坏梯度流。此前的稀疏注意力工作要么在选择步骤跳过反向传播（限制训练），要么使用在推理时无法提供真实稀疏性的连续松弛。

NSA 规避了这一点：压缩分支的注意力本身就是对整个序列的可微粗粒度注意力。top-k 操作只是复用压缩分支的最高注意力分数来决定加载哪些细粒度块。梯度流经压缩分支的分数（它同时影响压缩输出和选择逻辑），被选中块对最终输出的贡献也是可微的。不可微的 `top_k` 操作在前向计算图上是一个空操作——它只控制从内存中加载哪些块。

这就是 NSA 可以端到端用于预训练的原因。模型学会联合地通过三条分支路由信息，产生一个在推理时真正兑现承诺加速的稀疏模式。

### 与硬件对齐的 kernel

NSA 的 kernel 是为现代 GPU 内存层次结构设计的。kernel 按 GQA 组加载 query（外层循环），按组获取对应的稀疏 KV 块（内层循环），并在 SRAM 上运行注意力。因为每个 query 组看到相同的被选块（选择是按 query 组，而非按 query 头），KV 加载在组内被摊销。算术强度保持高位。

论文报告 Triton kernel 在 64k 解码上比 FlashAttention 快 9 倍，且加速比随序列长度增长。前向和反向 kernel 均已提供。

### 计算预算

设 `N` 为序列长度，`l` 为压缩块大小，`k` 为 top-k 选择数量，`w` 为滑动窗口，`b` 为被选块大小（通常等于 `l`）。

- 压缩分支：每个 query `O(N/l)` 个 key，总计 `O(N * N / l)`。
- 选择分支：每个 query `O(k * b)` 个 key，总计 `O(N * k * b)`。
- 滑动分支：每个 query `O(w)` 个 key，总计 `O(N * w)`。

总计：`O(N * (N/l + k*b + w))`。

取 `N = 64k, l = 64, k = 16, b = 64, w = 512`：每个 query 的开销为 `1000 + 1024 + 512 = 2536 keys`。全注意力为 `64000 keys`。计算量降低 25 倍。

取 `N = 128k, l = 64, k = 16, b = 64, w = 512`：每个 query 的开销为 `2000 + 1024 + 512 = 3536 keys`。全注意力为 `128000 keys`。降低 36 倍。收益随序列长度增长，这正是关键所在。

### 横向对比

| 方法 | 可微 | 真实推理加速 | 长程召回 |
|--------|---------------|----------------------|-------------------|
| 仅滑动窗口 | 是 | 是 | 失败 |
| 跨步 / 块稀疏 | 是 | 是 | 部分 |
| KV 剪枝（H2O、StreamingLLM）| 不适用（推理时）| 是 | 部分 |
| MoBA（Moonshot）| 部分 | 是 | 良好 |
| NSA | 是（原生）| 是（64k 时 9 倍）| 与全注意力持平 |

MoBA（Moonshot，arXiv:2502.13189）同期发表，采用类似的三优于一的思路，将 MoE 原则应用于注意力块。NSA 和 MoBA 是 2026 年长上下文预训练中需要了解的两种架构。

```figure
sliding-window-attention
```

## 动手构建

`code/main.py` 在一段短合成序列上实现三条分支，并展示：

- 压缩 MLP（出于教学清晰性使用简单的均值池化基线；真正的 NSA 使用可学习的 MLP）。
- 由压缩分支分数驱动的 top-k 块选择。
- 在最后 `w` 个 token 上的滑动窗口注意力。
- 门控组合。
- 与全注意力对比的计算量统计输出。

### 步骤 1：将 token 压缩成块

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

### 步骤 2：压缩分支注意力

对 query 与压缩后的 key 运行 softmax 注意力。压缩分支的分数同时作为 top-k 选择的信号。

### 步骤 3：top-k 块选择

选出得分最高的 `k` 个压缩块的索引。从这些块中加载原始未压缩 token 并在其上运行注意力。

### 步骤 4：滑动窗口注意力

取最后 `w` 个 token，并对它们运行标准注意力。

### 步骤 5：门控与组合

基于 query 的小型 MLP 产出三个门控权重。最终输出是三条分支输出的加权和。

### 步骤 6：计算量统计

打印每条分支每个 query 关注的 key 数量及总数。与 `N`（全注意力）比较。在 1024-token 合成序列上取 `l = 32, k = 4, w = 128`，NSA 每个 query 关注 `32 + 128 + 128 = 288` 个 key，而全注意力为 1024——减少 3.5 倍。

## 实际使用

NSA 正在 DeepSeek 自己的长上下文预训练管线中落地。截至 2026 年 4 月在公开推理栈中的集成状态：

- **DeepSeek 内部**：原生支持，已发布的权重使用 NSA 或其后续版本 DSA（Deepseek Sparse Attention）。
- **vLLM**：针对 DeepSeek-V3.x 权重的实验性 NSA 支持正在开发中。
- **SGLang**：已发布 NSA 基准；生产路径跟随 vLLM。
- **llama.cpp / CPU**：不支持；kernel 分解的开销在 CPU 吞吐量下不划算。

何时选择 NSA：

- 以严肃计算预算针对 64k 及以上上下文的预训练或继续训练。
- DeepSeek 自家长上下文 checkpoint 的推理。这些权重是 NSA 原生的。

何时不选：

- 服务现有的稠密注意力预训练模型。没有继续训练就无法改造为 NSA。
- 上下文低于 16k。三分支开销会超过节省。
- Batch-1 交互式聊天。延迟敏感的解码能获益，但只在长上下文时。

## 交付

本课程产出 `outputs/skill-nsa-integrator.md`。给定一个长上下文预训练运行规格，它产出一份 NSA 集成方案：压缩块大小、top-k、滑动窗口、门控 MLP 宽度、kernel 选择，以及能证明架构变更合理性的具体长上下文评测。

## 练习

1. 在 1024-token 合成序列上运行 `code/main.py`。对 `(l, k, w)` 进行三个预设的扫描并打印计算量。找出在每个 query key 数最低、同时在 needle-in-haystack 测试中对全注意力保持 95% 召回率的预设。

2. 将均值池化压缩器替换为一个微型可学习 MLP（2 层，隐藏层 32）。在一个信号为块平均值的合成任务上训练它。在留出数据上测量相对均值池化基线的困惑度差距。

3. 实现门控 MLP。它以 query 为输入，输出三个标量。证明门控行为合理：对随机 query 接近均匀加权，当 query 命中很远的块时在选择分支上权重很重。

4. 计算一个启用 NSA 的 70B 模型在 128k 上下文下的 KV cache 内存预算。KV 头数为 8，head dim 为 128，BF16。与全注意力以及 MLA 比较（Phase 10 · 14 给出了 MLA 的数字）。找出 NSA 细粒度分支 KV cache 等于全注意力的序列长度。

5. 阅读 NSA 论文第 4 节（arXiv:2502.11089），用三句话解释为什么复用压缩分支的注意力分数做 top-k 选择，而不是计算一个单独的路由分数。把答案与梯度流联系起来。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 压缩分支 | “粗粒度视图” | 对块平均后的 key 做注意力，为每个 query 提供全局上下文，key 数为 O(N/l) |
| 选择分支 | “top-k 块” | 对压缩分支分数最高的 `k` 个块做细粒度注意力 |
| 滑动窗口 | “局部上下文” | 对最后 `W` 个 token 做注意力以捕获短程模式 |
| 原生可训练性 | “开着稀疏性做预训练” | 稀疏模式在预训练期间学习，而非推理时附加 |
| 压缩块大小 l | “粗视图的分组大小” | 多少 token 合并为一个摘要；通常 32-64 |
| Top-k | “保留的块数” | 读取其未压缩 token 的压缩块数量；通常 16 |
| 滑动窗口 W | “局部注意力半径” | 通常 512；更短会损害局部连贯性，更长则浪费算力 |
| 分支门控 | “如何混合三条分支” | 逐位置的 MLP 输出，对三条分支的贡献加权 |
| 硬件对齐 | “对 kernel 友好的稀疏性” | 稀疏模式的选择使实际 GPU kernel 能达到理论加速 |
| DSA | “NSA 的后续版本” | Deepseek Sparse Attention，DeepSeek 谱系中继 NSA 之后的架构 |

## 延伸阅读

- [Yuan et al. — Native Sparse Attention: Hardware-Aligned and Natively Trainable Sparse Attention (arXiv:2502.11089, ACL 2025 最佳论文)](https://arxiv.org/abs/2502.11089) — 论文本身
- [DeepSeek-V3 技术报告 (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — NSA 所针对的架构家族
- [Moonshot AI — MoBA: Mixture of Block Attention for Long-Context LLMs (arXiv:2502.13189)](https://arxiv.org/abs/2502.13189) — 同期工作，对块采用 MoE 式注意力
- [Beltagy et al. — Longformer: The Long-Document Transformer (arXiv:2004.05150)](https://arxiv.org/abs/2004.05150) — 滑动窗口的起源
- [Xiao et al. — StreamingLLM: Efficient Streaming Language Models with Attention Sinks (arXiv:2309.17453)](https://arxiv.org/abs/2309.17453) — NSA 所改进的推理时稀疏性基线
- [Dao et al. — FlashAttention-2 (arXiv:2307.08691)](https://arxiv.org/abs/2307.08691) — NSA kernel 在 64k 上击败的全注意力基线