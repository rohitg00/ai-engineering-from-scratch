# DualPipe 并行

> DeepSeek-V3 在 2,048 块 H800 GPU 上训练，MoE 专家分散在多个节点之间。每个节点间的专家 all-to-all 通信，每 1 GPU 小时的计算就伴随着 1 GPU 小时的通信开销。GPU 有一半时间是空闲的。DualPipe（DeepSeek，2024 年 12 月）是一种双向流水线，将前向和反向计算与它们触发的 all-to-all 通信重叠起来。气泡（bubble）减少，吞吐量上升，而且由于专家并行本来就已经把专家分散到各个 rank 上，维护两份模型参数副本（"dual"这一名字的由来）代价很低。本课属于 Learn 类型的讲解，介绍 DualPipe 究竟做了什么，以及为什么 Sea AI Lab 的 DualPipeV 改进版本能消除 2 倍的参数成本，代价是气泡略微变大。

**Type:** Learn
**Languages:** Python（标准库，调度模拟器）
**Prerequisites:** Phase 10 · 05（分布式训练、FSDP、DeepSpeed）、Phase 10 · 14（开源模型架构与 MoE）
**Time:** 约 60 分钟

## 学习目标

- 说出 DualPipe 前向-反向数据块的四个组成部分，以及为什么每个部分都有自己的重叠窗口。
- 解释规模化场景下的流水线气泡问题，以及“无气泡”在实践和营销中的含义差异。
- 手动推演 8 个 PP rank、16 个 micro-batch 的 DualPipe 调度，确认前向和反向数据流互相填补彼此的空闲时段。
- 阐述 DualPipeV（Sea AI Lab，2025）所做的权衡：消除了 2 倍的参数复制成本，代价是当专家并行不活跃时气泡略大。

## 问题所在

在 2k 块 H800 GPU 上训练一个 671B 的 MoE 模型，会遇到三个相互叠加的瓶颈：

1. **内存压力。** 每块 GPU 只保存模型的一个切片。在 61 层、128 个注意力头、序列长度 8k 的情况下，激活内存非常庞大。
2. **流水线气泡。** 传统流水线并行（GPipe、1F1B）会让 GPU 在等待本阶段输入或梯度时空闲。在 8 个阶段的情况下，即使采用 1F1B 调度，大约也可能有 12% 的 GPU 时间是气泡。
3. **跨节点 all-to-all。** 采用专家并行的 MoE 会把专家分散到各节点。每次前向传播都会触发一次 all-to-all 以将 token 分发到专家，再触发一次以合并结果。在 2k 块 GPU 上，计算与通信比很容易达到 1:1。

每个问题都有各自的解决方案：用梯度检查点解决内存问题，用 Zero Bubble（Sea AI Lab，2023）解决流水线气泡，用专家并行通信内核解决 all-to-all。DualPipe 所做的，是让它们协同工作。该调度在单个前向-反向数据块内重叠计算与通信，同时从流水线两端注入 micro-batch，并利用由此产生的调度将 all-to-all 隐藏在计算窗口内。

已报道的结果：流水线气泡几乎被消除，在 DeepSeek-V3 的 14.8T token 训练运行中 GPU 利用率超过 95%。

## 核心概念

### 流水线并行复习

将一个 N 层模型切分到 P 个设备上。设备 `i` 持有第 `i * N/P .. (i+1) * N/P - 1` 层。一个 micro-batch 从设备 0 前向传播到设备 P-1，再从 P-1 反向传播回设备 0。每个设备只有在前一个设备发送其输出后才能开始前向阶段，也只有当下游设备发送上游梯度后才能开始反向阶段。

GPipe（Huang et al.，2019）一次只调度一个 micro-batch，浪费了大量 GPU 时间。1F1B（Narayanan et al.，2021）为多个 micro-batch 交错安排前向和反向传播。Zero Bubble（Qi et al.，2023）将反向传播拆分为两部分——面向输入的反向传播（B）和面向权重的反向传播（W）——并对它们进行调度以填补气泡。经过 Zero Bubble，流水线几乎已经排满。

DualPipe 是更进一步的一步。它在这些基础上增加了两个想法：

### 想法 1：数据块分解

每个前向数据块被拆分为四个组成部分：

- **Attention。** Q/K/V 投影、注意力计算、输出投影。
- **All-to-all dispatch。** 将 token 发送到其专家的跨节点通信。
- **MLP。** MoE 专家计算。
- **All-to-all combine。** 将专家输出送回的跨节点通信。

反向数据块则包含每个部分的梯度版本。DualPipe 对它们进行调度，使 all-to-all dispatch 与下一个数据块的 attention 计算并行，all-to-all combine 与再下一个数据块的 MLP 计算并行。

### 想法 2：双向调度

大多数流水线调度从阶段 0 注入 micro-batch 并流向阶段 P-1。DualPipe 从两端同时注入 micro-batch。阶段 0 看到源自它的前向 micro-batch；阶段 P-1 也看到源自它的前向 micro-batch。两条数据流在中间汇合。

要实现这一点，设备 `i` 必须同时持有流水线早期层 `i` 和流水线后期层 `P - 1 - i`。这就是 DualPipe 中“dual”的部分：每个设备保留其所需服务的模型层的两份副本（每个方向一份）。在 DeepSeek-V3 的规模下，这意味着 2 倍的参数复制成本。这是可以承受的，因为专家并行已经将 MoE 专家切分得非常细，非专家层复制两份只是九牛一毛。

关键在于，一个方向的前向数据流与另一个方向的反向数据流，恰好重叠在单向调度中会出现气泡的位置。气泡由此消失。

### 手动推演调度

考虑 P = 4 个 rank、8 个 micro-batch，分为 4 个前向 / 4 个反向。时间从左到右流动，行是设备 rank。

```
           Time →
rank 0:  F1 F2 F3 F4  F5R F6R F7R F8R  B1 B2 B3 B4  ...
rank 1:     F1 F2 F3  F4/F5R F6R F7R   B1 B2 ...
rank 2:        F1 F2  F3/F5R F4/F6R    B1 ...
rank 3:           F1  F2/F5R F3/F6R    ...
```

解读"F4/F5R"记号：rank 1 在同一时间槽内同时运行 micro-batch 4 的前向（在流水线中自左向右）和 micro-batch 5 的前向（自右向左）。这就是“双向”在操作层面的含义。

在 rank 2 处，两条数据流重叠得更早；在 rank 0 和 P-1 处重叠最晚。在调度的稳定中段，每个 rank 都在运行某一方向的前向与另一方向的反向的重叠。计算保持忙碌。前向传播的 all-to-all dispatch 隐藏在反向计算内。all-to-all combine 隐藏在前向计算内。气泡被挤压出去。

### 气泡核算

标准 1F1B 的流水线气泡（每个 rank 浪费的时间）：

```
bubble_1F1B = (P - 1) * forward_chunk_time
```

Zero Bubble 的改进能将其降低但不能降为零。在稳定阶段，若 micro-batch 数量能被 2 倍流水线深度整除，DualPipe 的气泡为零。在稳定阶段之外（预热和冷却阶段），会有一些气泡，但它不会随 micro-batch 数量增长——这是论文强调的关键特性。

用营销的话说：“无气泡”。用技术的话说：气泡不随 micro-batch 数量增长。Sea AI Lab 的后续分析（DualPipeV / Cut-in-half）表明，只有当专家并行不是瓶颈时才能实现完全的零气泡；在 EP 驱动的 all-to-all 情况下，调度上总会有一些妥协。

### DualPipeV——改进版本

Sea AI Lab（2025）观察到，当 EP 通信重叠不是重点时，2 倍的参数复制是浪费的。他们的 DualPipeV 调度将双向注入折叠为一种在单份参数副本上运行的“V 形”调度。气泡比 DualPipe 略大，但内存节省非常可观。DeepSeek 在其开源的 DualPipe 实现中采用了 DualPipeV 作为 EP 关闭模式。

权衡对比：

| 特性 | DualPipe | DualPipeV | 1F1B | Zero Bubble |
|---------|---------|-----------|------|------------|
| 每设备参数副本数 | 2 | 1 | 1 | 1 |
| 气泡 vs micro-batch | 恒定 | 小幅增长 | 增长 | 增长 |
| 计算-通信重叠 | 完全 | 部分 | 极少 | 部分 |
| 适用场景 | EP 密集的 MoE | 稠密模型或 EP 轻量 | 基线 | 任何流水线 |

### 对 14.8T token 训练的意义

DeepSeek-V3 的预训练在约 2.8M GPU 小时内，在 2,048 块 H800 GPU 上消耗了 14.8T token。如果使用朴素的 1F1B，他们会在流水线气泡上损失 12-15%——即 34-42 万 GPU 小时，足以训练一个完整的 70B 模型。DualPipe 挽回了其中大部分。由于缺乏内部日志，很难直接量化其贡献，但论文声称在整个训练过程中 GPU 利用率平均超过 95%。

对于较小的运行（1k 块 GPU 以下），DualPipe 属于大材小用——流水线气泡相对于总成本更小，而且稠密模型训练很少触及 all-to-all 瓶颈。对于数千块 GPU 规模的前沿 MoE 训练，它实际上是必需的。

### 它在技术栈中的位置

- 与 **FSDP**（Phase 10 · 05）互补。FSDP 将模型参数分片到各 rank；DualPipe 在各 rank 上调度计算。两者可以结合。
- 与 **ZeRO-3** 梯度分片兼容。双副本复制的簿记需要与 ZeRO 的分片梯度配合。
- 需要针对特定集群拓扑调优的**自定义 all-to-all 内核**。DeepSeek 的开源内核是参考实现。

```figure
expert-capacity
```

## 使用它

`code/main.py` 是一个流水线调度模拟器。它接收 `(P, n_micro_batches, schedule)`，并打印 1F1B、Zero Bubble、DualPipe 和 DualPipeV 各自在稳定阶段的利用率。它是一个教学工具——数字与论文中的定性结论一致，并非对生产环境实测加速比的声明。

模拟器的价值在于：用不同的 P 和 micro-batch 数量运行它，观察 1F1B 的气泡比例如何增长，而 DualPipe 不会。

真实训练集成的注意事项：

- 选择能被你的 micro-batch 数量整除的流水线并行深度。
- 确保你的专家并行网格支持双向 all-to-all。DeepSeek 的内核是参考实现。
- 首次使用时，预计要在调度本身上花费一周的调试时间。簿记工作非常繁琐。
- 监控每个 rank 的 GPU 利用率，而不仅仅是聚合值。DualPipe 的收益来自收紧最慢的那部分。

## 交付

本课产出 `outputs/skill-dualpipe-planner.md`。给定训练集群规格（GPU 数量、拓扑、互连、模型形状），它会推荐一种流水线并行策略、要使用的调度算法，以及目标规模下预期的气泡比例。

## 练习

1. 对 `(P=8, micro_batches=16, schedule=dualpipe)` 和 `(P=8, micro_batches=16, schedule=1f1b)` 运行 `code/main.py`。计算 GPU 利用率差异，并将其换算为每百万训练 token 可挽回的 GPU 小时。

2. 手动绘制 `(P=4, micro_batches=8, schedule=dualpipe)` 的调度表。在每个时间槽中标注 micro-batch ID 和方向。找出第一个没有气泡的时间槽。

3. 阅读 DeepSeek-V3 技术报告（arXiv:2412.19437）的图 5。找出 DualPipe 前向数据块内 all-to-all dispatch 的重叠窗口。解释计算调度如何将其隐藏。

4. 计算一个 P=8 流水线阶段的 70B 稠密模型和一个 P=16 流水线阶段的 671B MoE 模型使用 DualPipe 的 2 倍参数开销。说明为什么 MoE 的情况开销比例更小（大部分参数是专家，已分片到较大的 EP 组中）。

5. 将 DualPipe 与 Chimera（2021 年的一个竞争性双向调度器）进行比较。以论文 3.4 节为参考，找出 DualPipe 增加、而 Chimera 不具备的两个具体特性。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| 流水线气泡 | “每个 rank 的空闲时间” | GPU 周期因流水线阶段在等待输入或梯度而被浪费 |
| 1F1B | “默认流水线调度” | 一前向 / 一反向交错调度；DualPipe 所超越的基线 |
| Zero Bubble | “Sea AI Lab 2023” | 将反向传播拆分为 B（输入梯度）和 W（权重梯度）；几乎完全填满流水线 |
| DualPipe | “DeepSeek-V3 调度” | 双向流水线 + 计算-通信重叠；气泡不随 micro-batch 数量增长 |
| DualPipeV | “Cut-in-half” | V 形改进，消除 2 倍参数复制，代价是气泡略大 |
| Chunk（数据块） | “流水线工作单元” | 一个 micro-batch 通过一个流水线阶段的一次前向或反向传播 |
| All-to-all dispatch | “把 token 发给专家” | 将 token 路由到其所属 MoE 专家的跨节点通信 |
| All-to-all combine | “把专家输出送回来” | MLP 之后汇集专家输出的跨节点通信 |
| 专家并行（EP） | “专家分布到各 GPU” | 将 MoE 专家分片到各 rank，使不同 GPU 持有不同的专家 |
| 流水线并行（PP） | “层分布到各 GPU” | 将模型层分片到各 rank；DualPipe 调度所在的维度 |
| 气泡比例 | “浪费的 GPU 时间” | (bubble_time / total_time)；DualPipe 力推至零的比例 |

## 延伸阅读

- [DeepSeek-AI — DeepSeek-V3 技术报告（arXiv:2412.19437），第 3.3.2 节与图 5](https://arxiv.org/abs/2412.19437) — DualPipe 的主要参考
- [DeepSeek — DualPipe GitHub 仓库](https://github.com/deepseek-ai/DualPipe) — 开源参考实现，包括 DualPipeV（Cut-in-half）模式
- [Qi et al. — Zero Bubble Pipeline Parallelism（arXiv:2401.10241，Sea AI Lab 2023）](https://arxiv.org/abs/2401.10241) — Zero Bubble 前作
- [Sea AI Lab — DualPipe could be better without the Dual](https://sail.sea.com/blog/articles/63) — 启发 DeepSeek EP-off 模式的 DualPipeV 分析
- [Narayanan et al. — PipeDream / 1F1B（arXiv:1806.03377，2018-2021）](https://arxiv.org/abs/1806.03377) — DualPipe 所对比的 1F1B 调度
- [Huang et al. — GPipe（arXiv:1811.06965，2018）](https://arxiv.org/abs/1811.06965) — 流水线并行的原始论文及气泡问题