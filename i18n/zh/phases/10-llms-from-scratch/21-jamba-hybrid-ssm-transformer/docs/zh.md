# Jamba — 混合 SSM-Transformer

> 状态空间模型(SSM)与 Transformer 追求的目标不同。Transformer 通过注意力机制以二次方代价换取高质量。SSM 通过循环结构获得线性时间推理和常数内存,但在质量上落后。AI21 的 Jamba(2024 年 3 月)和 Jamba 1.5(2024 年 8 月)将两者放进同一个模型:每 7 层 Mamba 配 1 层 Transformer,每隔一个块使用 MoE,以及一个可装进单张 80GB GPU 的 256k 上下文窗口。Mamba-3(ICLR 2026)通过复数值状态空间和 MIMO 投影强化了 SSM 一侧。本课完整解读这两个架构,并解释为什么这个混合配方在三年扩展中存活下来,而纯 SSM 和纯 Transformer 的长上下文尝试却没有。

**Type:** Learn
**Languages:** Python (标准库,层级混合计算器)
**Prerequisites:** Phase 10 · 14(开源模型架构),Phase 10 · 17(原生稀疏注意力)
**Time:** ~60 分钟

## 学习目标

- 解释 Jamba 块中的三种基本组件 —— Transformer 层、Mamba 层、MoE —— 以及 1:7:隔层的交错配方。
- 说明 SSM 的循环结构在高层次上是什么样,以及它为何能实现常数内存推理。
- 计算 Jamba 模型在 256k 上下文下的 KV 缓存占用,并与纯 Transformer 模型所需内存进行比较。
- 说出 Mamba-3 的三项创新(指数梯形离散化、复数值状态更新、MIMO)以及各自针对的问题。

## 问题所在

注意力机制对序列长度是二次方复杂度。状态空间模型是线性的。这种差异会不断累积:在 256k token 时,一个 Transformer 注意力图每个头有 650 亿个条目;而 SSM 的循环状态是固定大小的,与序列长度无关。

纯 SSM 模型(Mamba、Mamba-2)在小规模下能达到 Transformer 的困惑度,但在状态跟踪任务上落后,并且在某些类别的上下文内检索上失败。直觉解释:SSM 将历史压缩进一个固定状态,当历史很长时信息会泄漏。注意力精确记住一切,但要付出二次方代价。

显而易见的解决方案:两者都用。在需要精确回忆的地方放 Transformer 层。其余地方用 SSM 层。调好比例。Jamba 是第一个大规模发布这种混合配方的生产级模型(总参数 52B,激活 12B,256k 上下文,单张 80GB GPU)。Jamba 1.5 将该系列扩展到 398B 总参数 / 94B 激活。Mamba-3(ICLR 2026)是当前最佳的纯 SSM 基线,混合模型可以围绕它重新构建。

本课解读全部三篇论文,并建立“选对比例”的心智模型。

## 核心概念

### 一页纸讲清 SSM

状态空间模型通过一个固定大小的状态 `h` 处理序列 `x_1, ..., x_N`:

```
h_t = A h_{t-1} + B x_t
y_t = C h_t
```

在每一步,状态通过线性动力学 `A` 演化,接收输入 `B x_t`,并输出 `C h_t`。`A, B, C` 可以是可学习的。注意关键性质:计算 `y_t` 只需要 `h_{t-1}` 和 `x_t`,不需要任何更早的 `x`。内存是常数。推理对每个 token 是 O(1)。

建模质量的关键在于 `A` 的结构。S4(Gu 2021)使用一个高度结构化的矩阵,可在训练时作为长卷积高效求值。Mamba(Gu, Dao 2023)用数据依赖的矩阵(“选择性”部分)取代了固定的 `A, B, C`。Mamba-2(2024)进一步简化了结构。Mamba-3(2026)在特定位置重新加入复杂度。

关键性质:对于解码器 LLM,SSM 层是注意力层的直接替代品,用固定大小的每层状态取代不断增长的 KV 缓存。

### Jamba 块

一个 Jamba 块按两个数字交错排列各层:

- `l`:注意力与 Mamba 的比例。Jamba 使用 `l = 8`,即每 7 层 Mamba 配 1 层 Transformer(7 Mamba + 1 Attention = 每组 8 层)。
- `e`:MoE 的频率。Jamba 使用 `e = 2`,即每隔一层应用 MoE。

一个块内的层序列:

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

每个 Jamba 块是 8 层。在 4 个块的深度(共 32 层)下,你得到 28 层 Mamba 和 4 层 Attention。其中 16 层使用 MoE。

### 为什么是 1:7 比例

AI21 做了消融实验:什么样的注意力与 Mamba 比例能同时在其长上下文评测上给出最佳的每参数困惑度和上下文内回忆?

- 注意力太多(1:1):质量上升,但内存和速度变差。
- 注意力太少(1:15):内存很好,但上下文内检索失败。
- 甜点位:1:7 或 1:8。

直觉:Transformer 层处理精确回忆和状态跟踪。Mamba 层处理低成本的绝大部分处理工作。

### 位置编码

Mamba 层本身是位置感知的(通过循环结构)。原始基于 Mamba 的混合模型中的注意力层不使用 RoPE —— 位置信息由 SSM 层提供。Jamba 1.5 为注意力层加入了 RoPE 以获得更长的上下文泛化能力,这是基于经验性长上下文评估的事后改进。

### 内存预算

以 Jamba-1 形状为例(32 层:28 Mamba + 4 Attention,hidden 4096,32 个注意力头):

- KV 缓存(仅注意力层):256k BF16 下为 `2 * 4 * 32 * 128 * 256k * 2 = 8.4 GB`。只有 4 个注意力层贡献内存。
- SSM 状态:每个 token 前缀为 `28 * hidden * state_size`,但这是每层固定大小,不随序列长度扩展。典型 Mamba 状态是每特征 16,hidden 4096:总计 `28 * 4096 * 16 * 2 = 3.7 MB`。

对比相同 hidden、32 头完整 MHA 的 32 层纯 Transformer:256k BF16 下为 `2 * 32 * 32 * 128 * 256k * 2 = 128 GB`。KV 缓存减少 8 倍。即使对比大多数 2024 年模型使用的 GQA(8) 基线(`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`),Jamba 的 1:7 混合在 16 GB 时仍小 2 倍。

这就是 AI21 所说的“单张 80GB GPU 上的 256k 上下文”。完整 MHA 的纯 Transformer 的 KV 缓存放不下;即使 GQA 基线也没有给权重和激活留下空间;Jamba 的可以。

### Mamba-3:2026 年的纯 SSM 基线

Mamba-3(ICLR 2026,arXiv:2603.15569)在纯 SSM 一侧引入三项创新:

1. **指数梯形离散化。** 用一个更具表达力的循环结构取代 Mamba-2 中的欧拉法离散化。类卷积操作在核心循环内作用于状态与输入,而不是作为对 `x_t` 的外层卷积。

2. **复数值状态更新。** 之前的 Mamba 将状态矩阵从复数(S4)降到实对角(Mamba)再到缩放单位阵(Mamba-2)。Mamba-3 重新引入复数值 —— 等价于对状态做一个数据依赖的旋转位置编码。这恢复了之前实数值简化所牺牲的状态跟踪能力。

3. **多输入多输出(MIMO)投影。** 不再使用逐特征标量投影,而是使用矩阵值投影。在不增加解码延迟的情况下提升建模能力和推理时的硬件利用率。

在 1.5B 参数下,Mamba-3 比 Gated DeltaNet 的平均下游准确率提升 0.6 个点;MIMO 变体再增加 1.2 个点,总计 1.8 个点。在相同状态大小下,Mamba-3 用一半的状态达到 Mamba-2 的水平。

Mamba-3 尚未在大规模生产混合模型中落地 —— 但它显然是下一代 Jamba 级模型中 SSM 一侧的候选者。

### 何时选择混合架构

混合架构在以下情况占优:

- 上下文长到纯 Transformer 的 KV 缓存变得难以承受(64k 以上)。
- 任务混合了短程结构(SSM 擅长)和长程回忆(需要 Transformer)。
- 你想在单 GPU 内存预算上部署,而仅 Transformer 的 KV 缓存就放不下。

混合架构在以下情况处于劣势:

- 上下文较短(16k 以内)。SSM 的开销被浪费;纯 Transformer 就够了。
- 任务需要处处到处的注意力(深度推理、多文档交叉引用)。混合模型中注意力层的稀疏性会造成损害。
- 你在扩展到万亿参数的前沿模型。纯 Transformer + MLA + MoE(DeepSeek-V3 风格)目前在能力竞赛中领先。

### 竞争格局

| 模型 | 系列 | 规模 | 独特卖点 |
|-------|--------|------|-------------|
| Mamba-2 | 纯 SSM | 3B | 线性时间,常数内存 |
| Jamba | 混合 | 52B/12B | 80GB 上跑 256k |
| Jamba 1.5 Large | 混合 | 398B/94B | 企业级长上下文 |
| Mamba-3 | 纯 SSM | 1.5B(论文) | 状态跟踪能力恢复 |
| DeepSeek-V3 | 纯 Transformer + MoE | 671B/37B | 前沿能力 |

2026 年的格局:纯 Transformer MoE 主导前沿,但混合模型占据了 256k 以上上下文的细分市场。Mamba-3 在状态跟踪上的优势可能推动下一代混合模型降低比例(更多 SSM,更少注意力)。

```figure
swiglu-ffn
```

## 使用它

`code/main.py` 是一个面向混合架构的内存计算器。给定一个 SSM-Transformer 比例和 hidden 大小 / 层数配置,它会计算:

- 目标上下文下的 KV 缓存。
- SSM 状态内存。
- 一系列模型形状在上下文 N 下的总内存。

计算器支持:

- 纯 Transformer 基线(KV 缓存随 N 增长)。
- Jamba 风格的 1:7 混合。
- 纯 SSM(完全没有 KV 缓存)。

对于已发布的形状,数字直接来自 Jamba-1 和 Jamba-1.5 论文;假设变体的数字是外推的。

真实部署中的集成注意事项:

- 大多数生产推理服务器(vLLM、SGLang)支持 Jamba 和 Mamba。请检查具体版本。
- 在 256k 上下文下,Jamba 的内存优势体现在并发请求吞吐量上。在同样的 VRAM 上,你能装入的 Jamba 序列比 Transformer 序列更多。
- Mamba-3 作为独立模型尚未在生产中落地 —— 目前只是 1.5B 的研究预览。

## 交付它

本课产出 `outputs/skill-hybrid-picker.md`。给定一个工作负载规格(上下文长度概况、任务组合、内存预算),它会在纯 Transformer、Jamba 风格混合和纯 SSM 之间给出推荐,并对内存与质量的权衡给出明确的推理。

## 练习

1. 运行 `code/main.py`,计算 32 层纯 Transformer(hidden 4096,32 头)和相同形状 Jamba-1 混合模型在 256k 上下文下的 KV 缓存。验证 AI21 论文声称的约 8 倍内存缩减。

2. 修改计算器,建模 1:3 混合(4 Mamba : 1 Attention)和 1:15 混合(14 Mamba : 1 Attention)。绘制 KV 缓存随比例的变化曲线。在什么比例下 KV 缓存等于 SSM 状态内存?

3. 阅读 Jamba 论文(arXiv:2403.19887)第 3 节。解释为什么尽管 Mamba-2 更快,AI21 仍使用 Mamba-1 而非 Mamba-2。提示:混合消融一节对此有记录。

4. 计算 Jamba 1.5 Large(398B 总参数,94B 激活)中隔层 MoE 的参数开销。将激活比例与 DeepSeek-V3(37B/671B)进行比较,并解释为什么 Jamba 的架构推高了激活比例。

5. 阅读 Mamba-3 论文(arXiv:2603.15569)第 3 节。用三句话解释为什么复数值状态更新等价于数据依赖的旋转位置编码。将答案与 Phase 7 · Lesson 04 的 RoPE 推导联系起来。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| 状态空间模型(SSM) | “带固定状态的循环” | 一个具有可学习循环 `h_t = A h_{t-1} + B x_t` 的层;每个 token 常数内存 |
| 选择性 SSM | “Mamba 的技巧” | 数据依赖的 A、B、C 参数,以线性时间赋予模型类似门控的选择性 |
| 注意力与 Mamba 比例 | “多少个注意力层” | 在 Jamba 中,`l = 8` 表示每 7 层 Mamba 配 1 层注意力 |
| Jamba 块 | “8 层一组” | 一个注意力层 + 七个 Mamba 层 + 隔位 MoE |
| SSM 状态 | “隐藏缓冲区” | 每层固定大小的状态,为 Mamba 层取代 KV 缓存 |
| 256k 上下文 | “Jamba 的招牌数字” | Jamba-1 能在单张 80GB GPU 上装下的序列长度;纯 Transformer 在该尺寸下不行 |
| Mamba-3 | “2026 纯 SSM” | 当前最佳的纯 SSM 架构,具备复数状态 + MIMO;混合模型重建所围绕的基线 |
| MIMO | “多输入多输出” | Mamba-3 的创新,使用矩阵值投影取代逐特征标量 |
| 指数梯形离散化 | “Mamba-3 的循环” | 更具表达力的循环结构,涵盖了 Mamba-2 的欧拉法离散化 |
| 混合架构 | “混合注意力和 SSM” | 任何交错排列 Transformer 层和 SSM 层的模型;Jamba 是生产级原型 |

## 延伸阅读

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) — Jamba 原始论文,比例消融实验,256k 上下文声明
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) — 扩展系列,398B/94B 和 12B/52B 公开发布
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) — Jamba 所基于的选择性 SSM 论文
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) — 简化后的结构化状态空间后继者
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) — 复数值状态、MIMO,2026 年纯 SSM 前沿
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) — S4 论文,SSM 谱系对 LLM 而言的起点