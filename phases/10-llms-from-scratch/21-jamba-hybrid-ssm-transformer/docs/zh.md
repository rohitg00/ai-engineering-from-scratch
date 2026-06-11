# Jamba —— 混合 SSM-Transformer

> 状态空间模型（SSM）和 transformer 想要不同的东西。Transformer 以二次成本通过 attention 购买质量。SSM 通过递推以线性时间推理和恒定内存购买，但质量滞后。AI21 的 Jamba（2024 年 3 月）和 Jamba 1.5（2024 年 8 月）将它们放在同一个模型中：每 7 个 Mamba 层 1 个 Transformer 层，每隔一个块应用 MoE，以及一个 256k 上下文窗口，可容纳在单个 80GB GPU 上。Mamba-3（ICLR 2026）通过复值状态空间和 MIMO 投影收紧 SSM 侧。本课从头到尾阅读两种架构，并解释为什么混合配方在纯 SSM 和纯 Transformer 长上下文尝试都未成功时，已经存活了三年扩展。

**类型：** 学习
**语言：** Python（标准库，层混合计算器）
**前置要求：** 第 10 阶段 · 14（开放模型架构），第 10 阶段 · 17（原生稀疏注意力）
**时间：** ~60 分钟

## 学习目标

- 解释 Jamba 块中的三个原语 —— Transformer 层、Mamba 层、MoE —— 以及 1:7:偶数交错配方
- 陈述 SSM 的递推在高层次上是什么样子，以及为什么它实现恒定内存推理
- 计算 Jamba 模型在 256k 上下文时的 KV 缓存占用，并与纯 Transformer 模型需要的比较
- 命名三个 Mamba-3 创新（指数梯形离散化、复值状态更新、MIMO）以及每个针对的问题

## 问题

Attention 在序列长度上是二次的。状态空间模型是线性的。这种差异复合：在 256k token 时，Transformer attention 图每 head 65B 条目；SSM 的递推状态无论序列长度如何都是固定大小。

纯 SSM 模型（Mamba、Mamba-2）在小规模时匹配 Transformer 困惑度，但在状态跟踪任务上滞后，并在某些类别的上下文内检索上失败。直觉：SSM 将历史压缩成固定状态，当历史很长时，信息泄漏。Attention 精确记住一切，但支付二次成本。

明显的修复：两者都用。在精确召回重要的地方放置 Transformer 层。在其他地方使用 SSM 层。调整比率。Jamba 是第一个以规模出货这种混合配方的生产级模型（52B 总计，12B 活跃，256k 上下文，单个 80GB GPU）。Jamba 1.5 将家族扩展到 398B 总计 / 94B 活跃。Mamba-3（ICLR 2026）是当前最佳的纯 SSM 基线，可以围绕它重建混合。

本课阅读所有三篇论文并产生"选择正确比率"的心智模型。

## 核心概念

### 一页的 SSM

状态空间模型通过固定大小状态 `h` 处理序列 `x_1, ..., x_N`：

```
h_t = A h_{t-1} + B x_t
y_t = C h_t
```

每一步状态通过线性动力学 `A` 演化，接收输入 `B x_t`，并发射输出 `C h_t`。`A, B, C` 可以学习。注意关键特性：计算 `y_t` 只需要 `h_{t-1}` 和 `x_t`，不需要任何更早的 `x`。内存恒定。推理每个 token O(1)。

建模质量的技巧是 `A` 的结构。S4（Gu 2021）使用高度结构化的矩阵，训练期间可作为长卷积高效评估。Mamba（Gu, Dao 2023）将固定 `A, B, C` 替换为数据相关的（"选择性"部分）。Mamba-2（2024）进一步简化结构。Mamba-3（2026）在特定位置重新添加复杂性。

关键特性：对于解码器 LLM，SSM 层是 attention 层的直接替代，用固定大小的每层状态替代增长的 KV 缓存。

### Jamba 块

Jamba 块根据两个数字交错层：

- `l`：attention 到 Mamba 的比率。Jamba 使用 `l = 8`，意味着每 7 个 Mamba 层 1 个 Transformer 层（7 个 Mamba + 1 个 Attention = 每组 8 层）。
- `e`：MoE 频率。Jamba 使用 `e = 2`，意味着每隔一层应用 MoE。

块内的层序列：

```
M  M  M  M  M  M  M  A    (7 个 Mamba + 1 个 Attention)
|  M  |  M  |  M  |  M    (其中 | 标记应用 MoE)
```

每个 Jamba 块是 8 层。4 个块深（32 层总计），你得到 28 个 Mamba 和 4 个 Attention 层。其中 16 个使用 MoE。

### 为什么 1:7 比率

AI21 运行消融：什么 attention 到 Mamba 比率在其长上下文评估上给出最佳困惑度每参数 AND 上下文内召回？

- 太多 attention（1:1）：质量上升但内存和速度下降。
- 太少 attention（1:15）：内存很好但上下文内检索失败。
- 最佳点：1:7 或 1:8。

直觉：Transformer 层处理精确召回和状态跟踪。Mamba 层处理廉价的处理主体。

### 位置编码

Mamba 层本身具有位置感知（通过递推）。原始基于 Mamba 的混合中的 Attention 层不使用 RoPE —— SSM 层提供位置信息。Jamba 1.5 向 attention 层添加 RoPE 以进行更长上下文泛化，这是基于经验长上下文评估的事后改进。

### 内存预算

对于 Jamba-1 形状（32 层：28 个 Mamba + 4 个 Attention，隐藏 4096，32 个 attention head）：

- KV 缓存（仅 attention 层）：`2 * 4 * 32 * 128 * 256k * 2 = 8.4 GB`，256k BF16。只有 4 个 attention 层贡献。
- SSM 状态：`28 * hidden * state_size` 每 token 前缀，但这是每层固定大小，不随序列长度缩放。典型 Mamba 状态每特征 16，隐藏 4096：`28 * 4096 * 16 * 2 = 3.7 MB` 总计。

与 32 层纯 Transformer 比较，相同隐藏，32 个 head 的完整 MHA：`2 * 32 * 32 * 128 * 256k * 2 = 128 GB`，256k BF16。KV 缓存减少 8 倍。即使对抗大多数 2024 模型使用的 GQA(8) 基线（`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`），Jamba 的 1:7 混合在 16 GB 时仍然小 2 倍。

这就是 AI21 所说的"单个 80GB GPU 上的 256k 上下文"。完整 MHA 纯 Transformer 的 KV 缓存无法容纳；即使 GQA 基线也没有权重和激活的空间；Jamba 的可以。

### Mamba-3：2026 年的纯 SSM 基线

Mamba-3（ICLR 2026，arXiv:2603.15569）在纯 SSM 侧引入三个创新：

1. **指数梯形离散化。** 将 Mamba-2 中的欧拉方法离散化替换为更具表达力的递推。在核心递推中对状态-输入应用类卷积操作，而非作为 `x_t` 的外卷积。

2. **复值状态更新。** 先前的 Mamba 将状态矩阵从复值（S4）简化为实对角（Mamba）再到缩放单位（Mamba-2）。Mamba-3 重新添加复值 —— 等价于状态上的数据相关旋转 embedding。这恢复了先前实值简化所损失的状态跟踪能力。

3. **多输入多输出（MIMO）投影。** 替代每特征标量投影，使用矩阵值投影。提高建模能力和推理时硬件利用率而不增加解码延迟。

在 1.5B 参数下，Mamba-3 比 Gated DeltaNet 平均下游准确率提高 0.6 点；MIMO 变体再增加 1.2，总计 1.8 点增益。在相同状态大小下，Mamba-3 以一半状态匹配 Mamba-2。

Mamba-3 尚未以规模在生产混合中出货 —— 但它是下一个 Jamba 级模型的 SSM 侧的明显候选。

### 何时使用混合

混合在以下情况获胜：

- 上下文足够长，纯 Transformer KV 缓存变得痛苦（64k+）。
- 任务混合短距离结构（SSM 擅长）与长距离召回（需要 Transformer）。
- 你想在单 GPU 内存预算上部署，其中 Transformer KV 缓存单独无法容纳。

混合在以下情况失败：

- 上下文短（16k 以下）。SSM 开销浪费；纯 Transformer 很好。
- 任务需要处处到处的 attention（深度推理、多文档交叉引用）。混合中 attention 层的稀疏性伤害。
- 你正在扩展到万亿参数前沿模型。纯 Transformer + MLA + MoE（DeepSeek-V3 风格）目前正在赢得能力竞赛。

### 竞争格局

| 模型 | 家族 | 规模 | 独特声明 |
|-------|--------|------|-------------|
| Mamba-2 | 纯 SSM | 3B | 线性时间，恒定内存 |
| Jamba | 混合 | 52B/12B | 80GB 上 256k |
| Jamba 1.5 Large | 混合 | 398B/94B | 企业级长上下文 |
| Mamba-3 | 纯 SSM | 1.5B（论文） | 状态跟踪恢复 |
| DeepSeek-V3 | 纯 Transformer + MoE | 671B/37B | 前沿能力 |

2026 格局：纯 Transformer MoE 主导前沿，但混合拥有 256k+ 上下文细分市场。Mamba-3 的状态跟踪胜利可能推动下一代混合比率更低（更多 SSM，更少 attention）。

## 使用它

`code/main.py` 是混合架构的内存计算器。给定 SSM-Transformer 比率和隐藏大小 / 层数配置，它计算：

- 目标上下文时的 KV 缓存。
- SSM 状态内存。
- 上下文 N 时一系列模型形状的总内存。

计算器支持：

- 纯 Transformer 基线（KV 缓存随 N 增长）。
- Jamba 风格 1:7 混合。
- 纯 SSM（完全没有 KV 缓存）。

数字直接来自 Jamba-1 和 Jamba-1.5 论文的发布形状，并为假设变体外推。

真实部署的集成考虑：

- 大多数生产推理服务器（vLLM、SGLang）支持 Jamba 和 Mamba。检查特定版本。
- 在 256k 上下文时，Jamba 的内存优势出现在并发请求吞吐量上。在相同 VRAM 上，你比 Transformer 序列容纳更多 Jamba 序列。
- Mamba-3 作为独立模型尚未在生产中出货 —— 1.5B 的研究预览。

## 交付

本课生成 `outputs/skill-hybrid-picker.md`。给定工作负载规范（上下文长度分布、任务混合、内存预算），它推荐纯 Transformer、Jamba 风格混合和纯 SSM 之间，并明确推理内存和质量权衡。

## 练习

1. 运行 `code/main.py` 计算 32 层纯 Transformer（隐藏 4096，32 个 head）和相同形状的 Jamba-1 混合在 256k 上下文时的 KV 缓存。验证 AI21 论文声称的 ~8 倍内存减少。

2. 修改计算器以建模 1:3 混合（4 个 Mamba : 1 个 Attention）和 1:15 混合（14 个 Mamba : 1 个 Attention）。绘制 KV 缓存 vs 比率。在什么比率下 KV 缓存等于 SSM 状态内存？

3. 阅读 Jamba 论文（arXiv:2403.19887）的第 3 节。解释为什么 AI21 使用 Mamba-1 而非 Mamba-2，尽管 Mamba-2 更快。提示：混合消融部分记录了这一点。

4. 计算 Jamba 1.5 Large（398B 总计，94B 活跃）中每隔一层 MoE 的参数开销。将活跃比率与 DeepSeek-V3（37B/671B）比较，并解释为什么 Jamba 的架构推动活跃比率更高。

5. 阅读 Mamba-3 论文（arXiv:2603.15569）的第 3 节。用三句话解释为什么复值状态更新等价于数据相关的旋转 embedding。将答案与第 7 阶段 · 第 04 课的 RoPE 推导联系起来。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 状态空间模型（SSM） | "固定状态的递推" | 具有学习递推 `h_t = A h_{t-1} + B x_t` 的层；每 token 恒定内存 |
| 选择性 SSM | "Mamba 的技巧" | 数据相关的 A、B、C 参数，给模型类似门控的选择性，线性时间 |
| Attention-to-Mamba 比率 | "多少 attention 层" | 在 Jamba 中，`l = 8` 意味着每 7 个 Mamba 层 1 个 attention 层 |
| Jamba 块 | "8 层组" | 一个 attention + 七个 Mamba + 交替位置上的 MoE |
| SSM 状态 | "隐藏缓冲区" | 替代 Mamba 层 KV 缓存的固定大小每层状态 |
| 256k 上下文 | "Jamba 的旗舰数字" | Jamba-1 可容纳在单个 80GB GPU 上的序列长度；纯 Transformer 在该大小无法容纳 |
| Mamba-3 | "2026 纯 SSM" | 具有复状态 + MIMO 的当前最佳纯 SSM 架构；混合围绕重建的基线 |
| MIMO | "多输入多输出" | Mamba-3 创新，使用矩阵值投影替代标量每特征 |
| 指数梯形离散化 | "Mamba-3 的递推" | 更具表达力的递推，包含 Mamba-2 的欧拉方法离散化 |
| 混合架构 | "混合 attention 和 SSM" | 任何交错 Transformer 和 SSM 层的模型；Jamba 是生产原型 |

## 延伸阅读

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) —— 原始 Jamba 论文，比率消融，256k 上下文声明
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) —— 扩展家族，398B/94B 和 12B/52B 公开发布
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) —— Jamba 构建的选择性 SSM 论文
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) —— 简化的结构化状态空间继任者
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) —— 复值状态、MIMO，2026 纯 SSM 前沿
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) —— S4 论文，LLM 的 SSM 谱系起点
