# 原生稀疏注意力（DeepSeek NSA）

> 在 64k token 时，attention 消耗 70-80% 的解码延迟。每个开放模型实验室都有修复计划。DeepSeek 的 NSA（ACL 2025 最佳论文）是那个坚持下来的：三个并行 attention 分支 —— 压缩的粗粒度 token、选择性保留的细粒度 token，以及用于局部上下文的滑动窗口 —— 通过学习的门控组合。它是硬件对齐的（内核友好）、原生可训练的（在预训练中工作，而非在推理时 bolted on），在 64k 解码上它比 FlashAttention 运行得更快，同时匹配或击败完整 attention 质量。本课端到端构建三个分支，并展示为什么稀疏性是端到端可微的。

**类型：** 构建
**语言：** Python（标准库）
**前置要求：** 第 7 阶段 · 12（KV 缓存、flash-attention），第 7 阶段 · 15（attention 变体），第 10 阶段 · 16（差分注意力）
**时间：** ~60 分钟

## 学习目标

- 陈述三个 NSA attention 分支以及每个分支捕获什么
- 解释为什么 NSA 是"原生可训练的"，而先前的稀疏 attention 方法仅是推理时可用
- 计算在 64k 上下文中 NSA 与完整 attention 的 attention 计算节省，作为压缩块大小和选择 top-k 的函数
- 在短合成序列上用标准库 Python 实现三分支组合，并验证门控权重行为

## 问题

完整 attention 在序列长度 N 上花费 `O(N^2)` 时间和每层 `O(N)` KV 缓存。在 64k token 时，计算和内存带宽数字是灾难性的。NSA 论文的测量理论估算：在 64k 时 attention 占总解码延迟的 70-80%。一切下游 —— TTFT、token/秒、每百万 token 成本 —— 由 attention 成本主导。

稀疏 attention 是显而易见的答案。先前尝试分为两类。固定模式稀疏性（滑动窗口、步幅、块局部）丢弃信息并在长距离召回任务上失败。推理时稀疏性（KV 缓存剪枝、H2O、StreamingLLM）应用于在 dense attention 上预训练的模型，只恢复潜在加速的一小部分，因为模型从未被要求通过稀疏模式路由信息。

原生稀疏注意力（Yuan et al., DeepSeek + PKU + UW, ACL 2025 最佳论文, arXiv:2502.11089）两者都做：模型在预训练期间学习的稀疏模式，实现为在推理时实际交付计算节省的内核对齐算法。两年后，NSA 或其直接后代将是每个前沿长上下文模型上的默认 attention。

## 核心概念

### 三个并行分支

对于每个查询，NSA 运行三次 attention，针对 KV 缓存的三个不同视图：

1. **压缩分支。** Token 被分组为大小 `l`（通常 32 或 64）的块。每个块通过小型学习 MLP 压缩成单个摘要 token。查询 attend 这些压缩 token，获得整个序列的粗粒度视图。

2. **选择分支。** 使用压缩分支的 attention 分数，识别与当前查询最相关的 top-k 块。读取这些块的细粒度（未压缩）token，查询 attend 所有它们。将压缩分支 attention 视为选择的路由信号。

3. **滑动窗口分支。** 查询 attend 最近的 `W` 个 token（通常 512）以获取局部上下文。此分支捕获其他两个可能错过的结构重的短距离模式（语法、局部共指）。

三个分支输出通过学习的位置门控组合：

```
out = g_cmp * out_cmp + g_sel * out_sel + g_win * out_win
```

`g_cmp, g_sel, g_win` 是来自查询上小型 MLP 的门控权重。它们不必和为 1 —— 可以独立加权分支。

### 为什么这是"原生可训练的"

选择步骤（top-k 块）是离散的。离散操作破坏梯度流。先前的稀疏 attention 工作要么跳过通过选择的反向传播（限制训练），要么使用在推理时不给出真实稀疏性的连续松弛。

NSA 绕过此问题：压缩分支 attention IS 整个序列上的可微粗粒度 attention。Top-k 操作只是重用压缩分支的最高 attention 分数来选择加载哪些细粒度块。梯度通过压缩分支分数流动（影响压缩输出 AND 选择逻辑），且选定块对最终输出的贡献也是可微的。不可微的 `top_k` 操作在前向计算图上是无操作 —— 它只控制从内存加载哪些块。

这就是 NSA 可以用于端到端预训练的原因。模型学习联合通过三个分支路由信息，产生在推理时实际交付承诺加速的稀疏模式。

### 硬件对齐内核

NSA 的内核为现代 GPU 内存层次结构设计。内核按 GQA 组加载查询（外循环），为每组获取相应的稀疏 KV 块（内循环），并在 SRAM 上运行 attention。因为每个查询组看到相同的选择块（选择是按查询组而非按查询 head），KV 加载在组内摊销。算术强度保持高。

论文报告 Triton 内核在 64k 解码上比 FlashAttention 快 9 倍，加速比随序列长度增长。前向和后向内核都提供。

### 计算预算

设 `N` 为序列长度，`l` 为压缩块大小，`k` 为 top-k 选择计数，`w` 为滑动窗口，`b` 为选定块大小（通常等于 `l`）。

- 压缩分支：每查询 `O(N/l)` 个键，所以总计 `O(N * N / l)`。
- 选择分支：每查询 `O(k * b)` 个键，所以总计 `O(N * k * b)`。
- 滑动分支：每查询 `O(w)` 个键，所以总计 `O(N * w)`。

总计：`O(N * (N/l + k*b + w))`。

使用 `N = 64k, l = 64, k = 16, b = 64, w = 512`：每查询成本为 `1000 + 1024 + 512 = 2536 个键`。完整 attention 是 `64000 个键`。25 倍计算缩减。

使用 `N = 128k, l = 64, k = 16, b = 64, w = 512`：每查询成本为 `2000 + 1024 + 512 = 3536 个键`。完整 attention 是 `128000 个键`。36 倍缩减。收益随序列长度增长，这就是全部意义。

### 如何比较

| 方法 | 可微 | 真实推理加速 | 长距离召回 |
|--------|---------------|----------------------|-------------------|
| 仅滑动窗口 | 是 | 是 | 失败 |
| 步幅 / 块稀疏 | 是 | 是 | 部分 |
| KV 剪枝 (H2O, StreamingLLM) | N/A（推理时） | 是 | 部分 |
| MoBA (Moonshot) | 部分 | 是 | 好 |
| NSA | 是（原生） | 是（64k 时 9x） | 匹配完整 attention |

MoBA（Moonshot, arXiv:2502.13189）同时发表并采取类似的三比一方法，将 MoE 原则应用于 attention 块。NSA 和 MoBA 是 2026 年长上下文预训练需要了解的两种架构。

## 构建

`code/main.py` 在短合成序列上实现三个分支并展示：

- 压缩 MLP（为教学清晰使用简单 mean-pool 基线；真实 NSA 使用学习 MLP）。
- 由压缩分支分数驱动的 top-k 块选择。
- 最后 `w` 个 token 上的滑动窗口 attention。
- 门控组合。
- 与完整 attention 的计算计数打印输出。

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

### 步骤 2：压缩分支 attention

对压缩键运行查询的 softmax attention。压缩分支分数兼作 top-k 选择的信号。

### 步骤 3：top-k 块选择

选取 `k` 个最高得分压缩块的索引。从那些块加载原始未压缩 token 并在其上运行 attention。

### 步骤 4：滑动窗口 attention

取最后 `w` 个 token 并对它们运行标准 attention。

### 步骤 5：门控 + 组合

查询上的小型 MLP 产生三个门控权重。最终输出是三个分支输出的加权和。

### 步骤 6：计算计数

打印每查询每个分支 attend 的键数及总计。与 `N`（完整 attention）比较。在 `l = 32, k = 4, w = 128` 的 1024 token 合成上，NSA 每查询看到 `32 + 128 + 128 = 288` 个键，而完整 attention 为 1024 —— 少 3.5 倍。

## 使用它

NSA 正在 DeepSeek 自己的长上下文预训练流水线中出货。截至 2026 年 4 月公共推理栈中的集成状态：

- **DeepSeek 内部**：原生，发布的权重使用 NSA 或其继任者 DSA（Deepseek Sparse Attention）。
- **vLLM**：DeepSeek-V3.x 权重的实验性 NSA 支持开发中。
- **SGLang**：NSA 基准已发布；生产路径跟随 vLLM。
- **llama.cpp / CPU**：不支持；内核分解的开销在 CPU 吞吐量上不值得。

何时使用 NSA：

- 针对 64k 以上上下文的预训练或持续训练运行，具有严肃计算预算。
- DeepSeek 自己长上下文 checkpoint 的推理。权重是 NSA 原生的。

何时不使用：

- 服务现有的 dense attention 预训练模型。你无法在不继续训练的情况下 retrofit NSA。
- 上下文低于 16k。三分支开销主导节省。
- Batch-1 交互式聊天。延迟敏感解码受益，但只在长上下文时。

## 交付

本课生成 `outputs/skill-nsa-integrator.md`。给定长上下文预训练运行规范，它产出 NSA 集成计划：压缩块大小、top-k、滑动窗口、门控 MLP 宽度、内核选择，以及证明架构变更合理的特定长上下文评估。

## 练习

1. 在 1024 token 合成上运行 `code/main.py`。在三个预设上扫描 `(l, k, w)` 并打印计算计数。识别在 needle-in-haystack 测试上保持对完整 attention 95% 召回的同时实现每查询最低键数的预设。

2. 用微型学习 MLP（2 层，隐藏 32）替换 mean-pool 压缩器。在信号是块平均值的合成任务上训练它。测量在 held-out 数据上相对于 mean-pool 基线的困惑度差距。

3. 实现门控 MLP。它以查询为输入并输出三个标量。显示门控行为合理：随机查询上近均匀加权，当查询击中远后块时在选择分支上重加权。

4. 计算 NSA 启用的 70B 模型在 128k 上下文时的 KV 缓存内存预算。KV head 为 8，head dim 128，BF16。与完整 attention 和 MLA（第 10 阶段 · 14 展示了 MLA 的数字）比较。识别 NSA 细粒度分支 KV 缓存等于完整 attention 的序列长度。

5. 阅读 NSA 论文的第 4 节（arXiv:2502.11089）并用三句话解释为什么压缩分支的 attention 分数被重用于 top-k 选择而非计算单独的路由分数。将答案与梯度流联系起来。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 压缩分支 | "粗视图" | 对块平均键的 attention，以每查询 O(N/l) 个键提供全局上下文 |
| 选择分支 | "Top-k 块" | 对具有最高压缩分支分数的 `k` 个块的细粒度 attention |
| 滑动窗口 | "局部上下文" | 对最后 `W` 个 token 的 attention 以获取短距离模式 |
| 原生可训练性 | "预训练时开启稀疏性" | 稀疏模式在预训练期间学习，而非在推理时 bolted on |
| 压缩块大小 l | "粗视图组大小" | 多少 token 合并成一个摘要；典型 32-64 |
| Top-k | "保留的块" | 其未压缩 token 被读取的压缩块数量；典型 16 |
| 滑动窗口 W | "局部 attention 半径" | 典型 512；更短伤害局部连贯性，更长浪费计算 |
| 分支门控 | "如何混合三个" | 每位置 MLP 输出，加权三个分支的贡献 |
| 硬件对齐 | "内核友好稀疏性" | 选择的稀疏模式使实际 GPU 内核达到理论加速 |
| DSA | "NSA 的继任者" | Deepseek Sparse Attention，DeepSeek 系列中跟随 NSA 的架构 |

## 延伸阅读

- [Yuan et al. — Native Sparse Attention: Hardware-Aligned and Natively Trainable Sparse Attention (arXiv:2502.11089, ACL 2025 Best Paper)](https://arxiv.org/abs/2502.11089) —— 论文
- [DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) —— NSA 针对的架构家族
- [Moonshot AI — MoBA: Mixture of Block Attention for Long-Context LLMs (arXiv:2502.13189)](https://arxiv.org/abs/2502.13189) —— 同时工作，块上的 MoE 风格 attention
- [Beltagy et al. — Longformer: The Long-Document Transformer (arXiv:2004.05150)](https://arxiv.org/abs/2004.05150) —— 滑动窗口起源
- [Xiao et al. — StreamingLLM: Efficient Streaming Language Models with Attention Sinks (arXiv:2309.17453)](https://arxiv.org/abs/2309.17453) —— NSA 改进的推理时稀疏性基线
- [Dao et al. — FlashAttention-2 (arXiv:2307.08691)](https://arxiv.org/abs/2307.08691) —— NSA 内核在 64k 上击败的完整 attention 基线
