# Jamba —— SSM-Transformer 混合架构

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 状态空间模型（state space models, SSM）和 transformer 想要的东西不一样。Transformer 用 attention（注意力）换质量，代价是平方级开销；SSM 用递归换线性时间推理和常数内存，代价是质量打折扣。AI21 的 Jamba（2024 年 3 月）和 Jamba 1.5（2024 年 8 月）把两者塞进同一个模型里：每 7 个 Mamba 层配 1 个 Transformer 层，每隔一层用 MoE，256k 的 context window（上下文窗口）能塞进单张 80GB GPU。Mamba-3（ICLR 2026）则在 SSM 这边收紧了刀法：复值状态空间加 MIMO 投影。这一课会把两套架构从头到尾读一遍，并解释为什么这个混合配方能撑过三年的 scaling，而纯 SSM、纯 Transformer 的长上下文方案没能撑住。

**Type:** Learn
**Languages:** Python (stdlib, layer-mix calculator)
**Prerequisites:** Phase 10 · 14 (open-model architectures), Phase 10 · 17 (native sparse attention)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 解释 Jamba 块里的三种基本元件 —— Transformer 层、Mamba 层、MoE —— 以及 1:7:even 的交错配方。
- 用高层次描述说明 SSM 的递归形式，以及它为什么能做到常数内存推理。
- 计算一个 Jamba 模型在 256k context 下的 KV cache 占用，并对比纯 Transformer 模型需要多少。
- 说出 Mamba-3 的三项创新（指数-梯形离散化、复值状态更新、MIMO）以及它们各自瞄准的问题。

## 问题（The Problem）

attention 在序列长度上是平方复杂度，状态空间模型是线性的。这个差距会复利式放大：在 256k token 时，单个 attention head 的 attention 图就是 650 亿个条目；而 SSM 的递归状态是固定大小，与序列长度无关。

纯 SSM 模型（Mamba、Mamba-2）在小规模上能匹平 Transformer 的困惑度（perplexity），但在状态追踪类任务上掉点，且在某些 in-context（上下文内）检索类别上完全失败。直觉上：SSM 把历史压进一个固定状态里，历史一长，信息就漏。attention 则一字不漏全部记住，但代价是平方开销。

显而易见的修法：两个都用。在需要精确召回的地方放 Transformer 层，其他地方用 SSM 层，再调比例。Jamba 是第一个把这套混合配方在工业规模上量产的模型（总参 52B、激活 12B、context 256k、单张 80GB GPU）。Jamba 1.5 把这一家族扩展到 398B 总参 / 94B 激活。Mamba-3（ICLR 2026）则是当前最强的纯 SSM baseline（基线），可以围绕它重建混合架构。

这一课会把这三篇 paper 都读一遍，建立"挑对比例"的心智模型。

## 概念（The Concept）

### 一页纸看懂 SSM（An SSM in one page）

状态空间模型通过一个固定大小的状态 `h` 来处理序列 `x_1, ..., x_N`：

```
h_t = A h_{t-1} + B x_t
y_t = C h_t
```

每一步，状态按线性动力学 `A` 演化，吃进输入 `B x_t`，吐出输出 `C h_t`。`A, B, C` 都可以学。注意一个关键性质：算 `y_t` 只需要 `h_{t-1}` 和 `x_t`，不需要更早的任何 `x`。内存是常数，每个 token 的推理是 O(1)。

建模质量的窍门在于 `A` 的结构。S4（Gu 2021）用了一种高度结构化的矩阵，训练时可以等价地按长卷积高效求值。Mamba（Gu, Dao 2023）把固定的 `A, B, C` 换成了数据相关的（这就是"选择性"那部分）。Mamba-2（2024）进一步简化结构。Mamba-3（2026）则在特定位置上又把复杂度加了回来。

关键性质：对一个 decoder LLM，SSM 层是 attention 层的 drop-in 替换 —— 用一个固定大小的逐层状态，替换不断增长的 KV cache。

### Jamba 块（The Jamba block）

一个 Jamba 块按两个数字交错排层：

- `l`：attention 与 Mamba 的比例。Jamba 取 `l = 8`，意思是每 7 个 Mamba 层配 1 个 Transformer 层（7 个 Mamba + 1 个 Attention = 每组 8 层）。
- `e`：MoE 的频率。Jamba 取 `e = 2`，意思是每隔一层应用一次 MoE。

一个块里的层序列：

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

每个 Jamba 块 8 层。叠 4 个块（共 32 层），就有 28 个 Mamba 层和 4 个 Attention 层，其中 16 层用 MoE。

### 为什么是 1:7（Why the 1:7 ratio）

AI21 做了消融实验（ablation）：什么样的 attention-to-Mamba 比例，能在他们的长上下文评测上同时拿到最好的 perplexity-per-parameter 和 in-context 召回？

- attention 太多（1:1）：质量上去了，但内存和速度都崩。
- attention 太少（1:15）：内存美滋滋，但 in-context 检索失败。
- 甜点：1:7 或 1:8。

直觉上：Transformer 层负责精确召回和状态追踪，Mamba 层负责便宜的大宗处理。

### 位置编码（Positional encoding）

Mamba 层本身就是位置感知的（通过递归实现）。最初基于 Mamba 的混合架构里，attention 层不用 RoPE —— 由 SSM 层提供位置信息。Jamba 1.5 给 attention 层加了 RoPE 以提升更长上下文的泛化能力，这是基于经验性长上下文评测的事后修正。

### 内存预算（The memory budget）

对一个 Jamba-1 形状的模型（32 层：28 Mamba + 4 Attention，hidden 4096，32 个 attention heads）：

- KV cache（仅 attention 层贡献）：256k BF16 下 `2 * 4 * 32 * 128 * 256k * 2 = 8.4 GB`。只有那 4 层 attention 在算。
- SSM state：每层固定大小，不随序列长度增长。典型的 Mamba state 每个 feature 16，hidden 4096：总共 `28 * 4096 * 16 * 2 = 3.7 MB`。

对比一下纯 Transformer，同样 32 层、同样 hidden、32 头 full MHA：256k BF16 下 `2 * 32 * 32 * 128 * 256k * 2 = 128 GB`。KV cache 缩了 8 倍。即便对比 2024 年大多数模型用的 GQA(8) baseline（`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`），Jamba 的 1:7 混合 16 GB 仍然小一倍。

这就是 AI21 所谓"单张 80GB GPU 跑 256k 上下文"的来源。full-MHA 纯 Transformer 的 KV cache 根本塞不下；即便是 GQA baseline 也没给权重和激活留位置；Jamba 能塞下。

### Mamba-3：2026 年的纯 SSM baseline（Mamba-3: the pure-SSM baseline in 2026）

Mamba-3（ICLR 2026, arXiv:2603.15569）在纯 SSM 这边引入了三项创新：

1. **指数-梯形离散化（Exponential-trapezoidal discretization）。** 把 Mamba-2 里的 Euler 法离散化换成更具表达力的递归。卷积式操作被作用在核心递归内部的"状态-输入"上，而不是作为外层卷积作用在 `x_t` 上。

2. **复值状态更新（Complex-valued state update）。** 之前几代 Mamba 把状态矩阵从复数（S4）一路简化到实对角（Mamba），再到 scaled identity（Mamba-2）。Mamba-3 把复值加了回来 —— 等价于在状态上做一个数据相关的 rotary embedding。这恢复了之前实值简化所损失的状态追踪能力。

3. **多输入多输出（MIMO）投影。** 不再用逐 feature 的标量投影，而用矩阵值投影。在不增加 decode（解码）延迟的前提下，提升建模能力和推理时的硬件利用率。

在 1.5B 参数规模上，Mamba-3 的下游平均准确率比 Gated DeltaNet 高 0.6 分；MIMO 变体再多 1.2 分，总共 1.8 分增益。在相同 state size 下，Mamba-3 用一半的 state 就能匹平 Mamba-2。

Mamba-3 还没在工业规模的混合模型里量产 —— 但它是下一代 Jamba 级模型 SSM 部分的明显候选。

### 什么时候选混合（When to reach for a hybrid）

混合在以下情况下赢：

- 上下文够长，纯 Transformer 的 KV cache 已经痛了（64k 起）。
- 任务里既有短程结构（SSM 擅长）又有长程召回（需要 Transformer）。
- 你要在单 GPU 内存预算里部署，而 Transformer KV cache 单独都装不下。

混合在以下情况下输：

- 上下文短（16k 以下）。SSM 那点开销纯属浪费，纯 Transformer 就够。
- 任务需要全局到全局的 attention（深度推理、多文档交叉引用）。混合架构里 attention 层稀疏会拖后腿。
- 你在往万亿参数前沿模型上 scaling。纯 Transformer + MLA + MoE（DeepSeek-V3 风格）目前在能力赛道上领先。

### 竞争格局（The competitive landscape）

| Model | Family | Scale | Unique claim |
|-------|--------|------|-------------|
| Mamba-2 | pure SSM | 3B | linear time, constant memory |
| Jamba | hybrid | 52B/12B | 256k on 80GB |
| Jamba 1.5 Large | hybrid | 398B/94B | enterprise-grade long-context |
| Mamba-3 | pure SSM | 1.5B (paper) | state-tracking restored |
| DeepSeek-V3 | pure Transformer + MoE | 671B/37B | frontier capability |

2026 年的格局：纯 Transformer MoE 统治前沿，但混合架构占据 256k 以上长上下文的生态位。Mamba-3 在状态追踪上的胜利可能让下一代混合架构把比例往下压（更多 SSM、更少 attention）。

## 用起来（Use It）

`code/main.py` 是一个混合架构的内存计算器。给定 SSM-Transformer 比例和 hidden-size / 层数配置，它会算出：

- 目标上下文下的 KV cache。
- SSM state 内存。
- 一系列模型形状在 context N 下的总内存。

计算器支持：

- 纯 Transformer baseline（KV cache 随 N 增长）。
- Jamba 风格的 1:7 混合。
- 纯 SSM（完全没有 KV cache）。

数值对已发布的形状直接取自 Jamba-1 和 Jamba-1.5 paper，对假想变体则做了外推。

真实部署时要考虑的集成事项：

- 大多数生产推理服务器（vLLM、SGLang）都支持 Jamba 和 Mamba。具体看版本。
- 256k 上下文下，Jamba 的内存优势体现在并发请求吞吐上。同样的 VRAM，能塞下的 Jamba 序列数比 Transformer 序列数多。
- Mamba-3 作为独立模型还没量产 —— 在 1.5B 规模做研究预览。

## 上线部署（Ship It）

这一课会产出 `outputs/skill-hybrid-picker.md`。给定一份工作负载规格（上下文长度分布、任务组合、内存预算），它会在纯 Transformer、Jamba 风格的混合、纯 SSM 之间给出推荐，并对内存与质量的权衡给出明确推理。

## 练习（Exercises）

1. 跑 `code/main.py`，计算 256k 上下文下一个 32 层纯 Transformer（hidden 4096，32 头）和同样形状的 Jamba-1 混合的 KV cache。验证 AI21 paper 声称的 ~8x 内存缩减。

2. 改造计算器，建模 1:3 混合（4 个 Mamba : 1 个 Attention）和 1:15 混合（14 个 Mamba : 1 个 Attention）。把 KV cache 对比例画出来。在什么比例下，KV cache 等于 SSM state 内存？

3. 读 Jamba paper（arXiv:2403.19887）的第 3 节。解释为什么 AI21 选 Mamba-1 而不是更快的 Mamba-2。提示：混合架构的消融实验那一节有记录。

4. 计算 Jamba 1.5 Large（398B 总参，94B 激活）里"每隔一层 MoE"带来的参数开销。把激活比与 DeepSeek-V3（37B/671B）做对比，并解释为什么 Jamba 的架构会把激活比推得更高。

5. 读 Mamba-3 paper（arXiv:2603.15569）的第 3 节。用三句话解释为什么复值状态更新等价于一个数据相关的 rotary embedding。把答案与 Phase 7 · Lesson 04 的 RoPE 推导挂上钩。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| State space model (SSM) | "Recurrence with a fixed state" | A layer with a learned recurrence `h_t = A h_{t-1} + B x_t`; constant memory per token |
| Selective SSM | "Mamba's trick" | Data-dependent A, B, C parameters that give the model gating-like selectivity at linear time |
| Attention-to-Mamba ratio | "How many attention layers" | In Jamba, `l = 8` means 1 attention layer per 7 Mamba layers |
| Jamba block | "The 8-layer group" | One attention + seven Mamba + MoE on alternate positions |
| SSM state | "The hidden buffer" | Fixed-size per-layer state that replaces the KV cache for Mamba layers |
| 256k context | "Jamba's flagship number" | The sequence length Jamba-1 fits on a single 80GB GPU; pure Transformer cannot at that size |
| Mamba-3 | "2026 pure SSM" | Current-best pure-SSM architecture with complex state + MIMO; the baseline hybrids rebuild around |
| MIMO | "Multi-input multi-output" | Mamba-3 innovation using matrix-valued projections instead of scalar per-feature |
| Exponential-trapezoidal discretization | "Mamba-3's recurrence" | More expressive recurrence that subsumes Mamba-2's Euler-method discretization |
| Hybrid architecture | "Mix attention and SSM" | Any model that interleaves Transformer and SSM layers; Jamba is the production archetype |

## 延伸阅读（Further Reading）

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) —— 原版 Jamba paper，比例消融、256k 上下文论断
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) —— 放大版的家族，398B/94B 与 12B/52B 公开发布
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) —— Jamba 所基于的选择性 SSM paper
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) —— 简化结构化状态空间的后继版本
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) —— 复值状态、MIMO，2026 年纯 SSM 前沿
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) —— S4 paper，LLM SSM 谱系的起点
