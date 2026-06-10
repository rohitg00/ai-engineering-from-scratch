# 21 · Jamba —— SSM 与 Transformer 的混合架构

> 状态空间模型（State Space Model，SSM）和 Transformer 想要的东西并不相同。Transformer 通过注意力换取质量，但代价是二次方复杂度。SSM 通过递归换取线性时间推理和常数内存，但质量稍逊。AI21 的 Jamba（2024 年 3 月）与 Jamba 1.5（2024 年 8 月）把二者放进了同一个模型：每 7 层 Mamba 配 1 层 Transformer，每隔一个块就用一次混合专家（Mixture of Experts，MoE），并实现了能塞进单张 80GB GPU 的 256k 上下文窗口。Mamba-3（ICLR 2026）则在 SSM 一侧引入复值状态空间和 MIMO 投影，进一步收紧了性能。本课会从头到尾通读这两种架构，并解释为什么在历经三年的规模化之后，这套混合配方存活了下来，而纯 SSM 和纯 Transformer 的长上下文尝试却没能做到。

**类型：** 学习
**语言：** Python（标准库，层混合比例计算器）
**前置：** 阶段 10 · 14（开放模型架构）、阶段 10 · 17（原生稀疏注意力）
**时长：** 约 60 分钟

## 学习目标

- 解释 Jamba 块中的三种基本组件——Transformer 层、Mamba 层、MoE——以及 1:7:隔层 的交错配方。
- 从高层次说明 SSM 的递归是什么样子，以及它为何能实现常数内存推理。
- 计算 Jamba 模型在 256k 上下文下的 KV 缓存（KV cache）占用，并与纯 Transformer 模型所需的占用作对比。
- 说出 Mamba-3 的三项创新（指数-梯形离散化、复值状态更新、MIMO）以及各自针对的问题。

## 问题所在

注意力的复杂度随序列长度呈二次方增长。状态空间模型则是线性的。这个差异会被放大：在 256k 个 token 时，单个注意力头的 Transformer 注意力图有 650 亿个条目；而 SSM 的递归状态无论序列多长都是固定大小。

纯 SSM 模型（Mamba、Mamba-2）在小规模上能匹敌 Transformer 的困惑度，但在状态跟踪（state-tracking）任务上落后，并且在某些类别的上下文内检索（in-context retrieval）上失败。直觉是：SSM 把历史压缩进一个固定状态，当历史很长时，信息就会泄漏丢失。注意力则会一字不差地记住所有内容，但代价是二次方成本。

显而易见的修法：两者都用。在需要精确召回的地方放 Transformer 层，其余地方用 SSM 层，再调好二者的比例。Jamba 是第一个把这套混合配方大规模产品化交付的工业级模型（总参数 52B、激活参数 12B、256k 上下文、单张 80GB GPU）。Jamba 1.5 把这一系列扩展到总参数 398B / 激活参数 94B。Mamba-3（ICLR 2026）则是当前最优的纯 SSM 基线，未来的混合模型可以围绕它重建。

本课会通读这三篇论文，并构建出「挑选合适比例」的心智模型。

## 核心概念

### 一页讲清 SSM

状态空间模型通过一个固定大小的状态 `h` 来处理序列 `x_1, ..., x_N`：

```
h_t = A h_{t-1} + B x_t
y_t = C h_t
```

每一步，状态都通过线性动态 `A` 演化，吸收输入 `B x_t`，并发出输出 `C h_t`。`A, B, C` 都可以是学习得到的。注意这个关键性质：计算 `y_t` 只需要 `h_{t-1}` 和 `x_t`，而不需要任何更早的 `x`。内存是常数。推理对每个 token 都是 O(1)。

建模质量的诀窍在于 `A` 的结构。S4（Gu 2021）使用了一个高度结构化的矩阵，可以在训练时作为一次长卷积高效求值。Mamba（Gu、Dao 2023）把固定的 `A, B, C` 替换成依赖数据的版本（这就是所谓「选择性（selective）」的部分）。Mamba-2（2024）进一步简化了结构。Mamba-3（2026）则在特定位置重新加回了复杂度。

关键性质是：对于一个解码器 LLM，SSM 层可以直接替换注意力层，用每层固定大小的状态取代不断增长的 KV 缓存。

### Jamba 块

一个 Jamba 块按照两个数字来交错排列各层：

- `l`：注意力与 Mamba 的比例。Jamba 取 `l = 8`，意味着每 7 层 Mamba 配 1 层 Transformer（每组 8 层 = 7 层 Mamba + 1 层 Attention）。
- `e`：MoE 的频率。Jamba 取 `e = 2`，意味着每隔一层就应用一次 MoE。

一个块内部的层序列：

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

每个 Jamba 块是 8 层。叠到 4 个块深（共 32 层）时，你会得到 28 层 Mamba 和 4 层 Attention，其中 16 层使用 MoE。

### 为什么是 1:7 比例

AI21 做了消融实验：在他们的长上下文评测上，注意力与 Mamba 的什么比例能同时给出最佳的「每参数困惑度」和上下文内召回？

- 注意力太多（1:1）：质量上升，但内存和速度恶化。
- 注意力太少（1:15）：内存表现很好，但上下文内检索失败。
- 甜区：1:7 或 1:8。

直觉是：Transformer 层负责精确召回和状态跟踪，Mamba 层负责廉价的大批量处理。

### 位置编码

Mamba 层本身就是位置感知的（通过递归实现）。在最初基于 Mamba 的混合模型中，注意力层并不使用 RoPE——位置信息由 SSM 层提供。Jamba 1.5 给注意力层加上了 RoPE，以获得更长上下文的泛化能力，这是基于实证长上下文评估的事后改进。

### 内存预算

对于 Jamba-1 的形状（32 层：28 层 Mamba + 4 层 Attention，hidden 4096，32 个注意力头）：

- KV 缓存（仅注意力层）：在 256k、BF16 下为 `2 * 4 * 32 * 128 * 256k * 2 = 8.4 GB`。只有那 4 层注意力会贡献占用。
- SSM 状态：每个 token 前缀对应 `28 * hidden * state_size`，但它是每层固定大小，不随序列长度增长。典型的 Mamba 状态为每个特征 16，hidden 4096：合计 `28 * 4096 * 16 * 2 = 3.7 MB`。

对比一个 32 层、同样 hidden、32 头完整多头注意力（MHA）的纯 Transformer：在 256k、BF16 下为 `2 * 32 * 32 * 128 * 256k * 2 = 128 GB`。KV 缓存减少了 8 倍。即便对比 2024 年大多数模型采用的 GQA(8) 基线（`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`），Jamba 的 1:7 混合架构在 16 GB 上仍然小了 2 倍。

这就是 AI21 所说的「单张 80GB GPU 上的 256k 上下文」。一个完整 MHA 的纯 Transformer，其 KV 缓存根本塞不下；即便是 GQA 基线也不给权重和激活留任何余地；而 Jamba 可以。

### Mamba-3：2026 年的纯 SSM 基线

Mamba-3（ICLR 2026，arXiv:2603.15569）在纯 SSM 一侧引入了三项创新：

1. **指数-梯形离散化（exponential-trapezoidal discretization）。** 用一种表达力更强的递归取代 Mamba-2 中的欧拉法离散化。在核心递归内部，对「状态-输入」施加一个类卷积操作，而不是在 `x_t` 上做外层卷积。

2. **复值状态更新。** 此前的各代 Mamba 把状态矩阵从复数（S4）降为实对角（Mamba），再降为缩放单位阵（Mamba-2）。Mamba-3 重新加回了复值——这等价于对状态施加一个依赖数据的旋转嵌入（rotary embedding）。它恢复了此前实值化简所牺牲掉的状态跟踪能力。

3. **多输入多输出（multi-input multi-output，MIMO）投影。** 用矩阵值投影取代逐特征的标量投影，在不增加解码延迟的前提下提升建模能力和推理时的硬件利用率。

在 1.5B 参数规模上，Mamba-3 的平均下游准确率比 Gated DeltaNet 高 0.6 个点；MIMO 变体再加 1.2 个点，合计 1.8 个点的提升。在相同的状态大小下，Mamba-3 用一半的状态就能匹敌 Mamba-2。

Mamba-3 尚未在大规模产品级混合模型中交付——但它显然是下一代 Jamba 级模型中 SSM 一侧的候选者。

### 何时该上混合架构

混合架构在以下情况下胜出：

- 上下文长到让纯 Transformer 的 KV 缓存变得痛苦（64k 以上）。
- 任务既包含短程结构（适合 SSM），又包含长程召回（需要 Transformer）。
- 你想部署在单 GPU 内存预算上，而仅 Transformer 的 KV 缓存就已经塞不下。

混合架构在以下情况下落败：

- 上下文很短（16k 以下）。SSM 的开销被浪费了；纯 Transformer 就够用。
- 任务需要「处处对处处」的注意力（深度推理、多文档交叉引用）。混合架构中注意力层的稀疏性会带来损害。
- 你要扩展到万亿参数的前沿模型。纯 Transformer + MLA + MoE（DeepSeek-V3 风格）目前在能力竞赛中领先。

### 竞争格局

| 模型 | 家族 | 规模 | 独特卖点 |
|-------|--------|------|-------------|
| Mamba-2 | 纯 SSM | 3B | 线性时间，常数内存 |
| Jamba | 混合 | 52B/12B | 80GB 上跑 256k |
| Jamba 1.5 Large | 混合 | 398B/94B | 企业级长上下文 |
| Mamba-3 | 纯 SSM | 1.5B（论文） | 恢复了状态跟踪能力 |
| DeepSeek-V3 | 纯 Transformer + MoE | 671B/37B | 前沿能力 |

2026 年的格局：纯 Transformer 的 MoE 主宰前沿，但混合架构占据着 256k 以上的长上下文生态位。Mamba-3 在状态跟踪上的胜利，可能会让下一代的混合比例进一步降低（更多 SSM，更少注意力）。

## 动手用起来

`code/main.py` 是一个面向混合架构的内存计算器。给定一个 SSM-Transformer 比例以及 hidden 大小 / 层数配置，它会计算：

- 目标上下文下的 KV 缓存。
- SSM 状态内存。
- 一系列模型形状在上下文 N 下的总内存。

该计算器支持：

- 纯 Transformer 基线（KV 缓存随 N 增长）。
- Jamba 风格的 1:7 混合。
- 纯 SSM（完全没有 KV 缓存）。

这些数字对于已发布的形状直接取自 Jamba-1 和 Jamba-1.5 论文，对假设的变体则进行了外推。

真实部署时的集成考量：

- 大多数生产级推理服务器（vLLM、SGLang）都支持 Jamba 和 Mamba。请检查具体版本。
- 在 256k 上下文下，Jamba 的内存优势体现在并发请求吞吐量上。在相同的显存（VRAM）下，你能塞进比 Transformer 序列更多的 Jamba 序列。
- 作为独立模型的 Mamba-3 尚未在生产中交付——目前是 1.5B 的研究预览版。

## 交付成果

本课会产出 `outputs/skill-hybrid-picker.md`。给定一份工作负载规格（上下文长度分布、任务组合、内存预算），它会在纯 Transformer、Jamba 风格混合架构和纯 SSM 之间给出推荐，并对内存与质量的权衡给出明确的推理过程。

## 练习

1. 运行 `code/main.py`，计算一个 32 层纯 Transformer（hidden 4096，32 头）以及同样形状的 Jamba-1 混合架构在 256k 上下文下的 KV 缓存。验证 AI21 论文所宣称的约 8 倍内存削减。

2. 修改计算器，建模一个 1:3 混合（4 Mamba : 1 Attention）和一个 1:15 混合（14 Mamba : 1 Attention）。画出 KV 缓存随比例变化的曲线。在什么比例下，KV 缓存恰好等于 SSM 状态内存？

3. 阅读 Jamba 论文（arXiv:2403.19887）第 3 节。解释为什么尽管 Mamba-2 更快，AI21 却选用了 Mamba-1。提示：混合消融那一节记录了原因。

4. 计算 Jamba 1.5 Large（总参数 398B，激活参数 94B）中「隔层 MoE」的参数开销。把激活比例与 DeepSeek-V3（37B/671B）作对比，并解释为什么 Jamba 的架构会把激活比例推得更高。

5. 阅读 Mamba-3 论文（arXiv:2603.15569）第 3 节。用三句话解释为什么复值状态更新等价于一个依赖数据的旋转嵌入。把答案与阶段 7 · 第 04 课的 RoPE 推导联系起来。

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|----------------|------------------------|
| 状态空间模型（SSM） | 「带固定状态的递归」 | 一种带可学习递归 `h_t = A h_{t-1} + B x_t` 的层；每个 token 占用常数内存 |
| 选择性 SSM（Selective SSM） | 「Mamba 的诀窍」 | 依赖数据的 A、B、C 参数，让模型在线性时间内获得类似门控的选择性 |
| 注意力与 Mamba 比例 | 「有多少注意力层」 | 在 Jamba 中，`l = 8` 表示每 7 层 Mamba 配 1 层注意力 |
| Jamba 块 | 「那个 8 层组」 | 一层注意力 + 七层 Mamba + 在交替位置上的 MoE |
| SSM 状态 | 「那个隐藏缓冲区」 | 每层固定大小的状态，为 Mamba 层取代了 KV 缓存 |
| 256k 上下文 | 「Jamba 的旗舰数字」 | Jamba-1 在单张 80GB GPU 上能容纳的序列长度；纯 Transformer 在该尺寸下做不到 |
| Mamba-3 | 「2026 年的纯 SSM」 | 当前最优的纯 SSM 架构，带复值状态 + MIMO；混合模型重建时围绕的基线 |
| MIMO | 「多输入多输出」 | Mamba-3 的创新，用矩阵值投影取代逐特征标量投影 |
| 指数-梯形离散化 | 「Mamba-3 的递归」 | 一种表达力更强的递归，把 Mamba-2 的欧拉法离散化纳为特例 |
| 混合架构 | 「混用注意力和 SSM」 | 任何交错排列 Transformer 层和 SSM 层的模型；Jamba 是其生产级的原型 |

## 延伸阅读

- [Lieber 等 —— Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) —— 最初的 Jamba 论文，比例消融、256k 上下文宣称
- [AI21 —— Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) —— 扩展规模后的系列，398B/94B 与 12B/52B 公开发布
- [Gu, Dao —— Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) —— Jamba 所基于的选择性 SSM 论文
- [Dao, Gu —— Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) —— 简化后的结构化状态空间继任者
- [Lahoti 等 —— Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) —— 复值状态、MIMO，2026 年的纯 SSM 前沿
- [Gu 等 —— Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) —— S4 论文，LLM 中 SSM 谱系的起点
