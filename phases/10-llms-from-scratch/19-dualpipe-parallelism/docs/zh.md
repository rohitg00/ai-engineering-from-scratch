# DualPipe 并行

> DeepSeek-V3 在 2,048 个 H800 GPU 上训练，MoE 专家分散在节点间。跨节点专家 all-to-all 通信每 1 GPU 小时计算消耗 1 GPU 小时通信。GPU 一半时间空闲。DualPipe（DeepSeek，2024 年 12 月）是一种双向流水线，将前向和后向计算与它们触发的 all-to-all 通信重叠。气泡减少，吞吐量攀升，且两个模型参数副本的保持（给出名称的"dual"）一旦 Expert Parallelism 已经将专家分散到各 rank 就很便宜。本课是对 DualPipe 实际做什么以及为什么 Sea AI Lab 的 DualPipeV 改进以略紧的气泡为代价降低 2x 参数成本的 Learn 型讲解。

**类型：** 学习
**语言：** Python（标准库，调度模拟器）
**前置要求：** 第 10 阶段 · 05（分布式训练，FSDP，DeepSpeed），第 10 阶段 · 14（开放模型架构和 MoE）
**时间：** ~60 分钟

## 学习目标

- 命名 DualPipe 前向后向块的四个组件以及为什么每个组件获得自己的重叠窗口
- 解释大规模下的流水线气泡问题，以及"无气泡"在实践中与营销中的含义
- 手工追踪 8 个 PP rank 和 16 个微批次的 DualPipe 调度，并确认前向和反向流填充彼此的空闲槽
- 陈述 DualPipeV（Sea AI Lab，2025）做出的权衡：当 Expert Parallelism 不活跃时，以稍大的气泡为代价降低 2x 参数复制

## 问题

在 2k H800 GPU 上训练 671B MoE 模型遇到三个叠加瓶颈：

1. **内存压力。** 每个 GPU 持有模型切片。8k 序列、61 层、128 个 head 的激活内存巨大。
2. **流水线气泡。** 传统流水线并行（GPipe，1F1B）在 GPU 等待其阶段的输入或梯度时空闲。在 8 个阶段，即使使用 1F1B 调度，约 12% 的 GPU 时间可能是气泡。
3. **跨节点 all-to-all。** 带有专家并行的 MoE 将专家分散在节点间。每次前向传递触发 all-to-all 将 token 分派到其专家，以及另一次 all-to-all 组合。在 2k GPU 上，这很容易变成 1:1 的计算与通信比率。

每个都有单独的解决方案：梯度检查点用于内存，Zero Bubble（Sea AI Lab，2023）用于流水线气泡，专家并行通信内核用于 all-to-all。DualPipe 做的是让它们协同工作。调度在单个前向后向块内重叠计算和通信，从流水线两端同时注入微批次，并使用结果调度将 all-to-all 隐藏在计算窗口内。

报告结果：近消除流水线气泡，DeepSeek-V3 的 14.8T token 训练运行中 GPU 利用率超过 95%。

## 核心概念

### 流水线并行复习

将 N 层模型拆分到 P 个设备。设备 `i` 持有层 `i * N/P .. (i+1) * N/P - 1`。微批次向前流过设备 0 到 P-1，然后从 P-1 向后到 0。每个设备只能在前一个设备发送其输出时开始其前向阶段，且只能在下游设备发送上游梯度时开始后向。

GPipe（Huang et al., 2019）一次调度一个微批次，浪费大部分 GPU 时间。1F1B（Narayanan et al., 2021）交错多个微批次的前向和后向传递。Zero Bubble（Qi et al., 2023）将后向传递分成两部分 —— 输入梯度（B）和权重梯度（W）— 并调度它们填充气泡。Zero Bubble 之后，流水线几乎紧凑。

DualPipe 是下一步。它在之上添加两个想法：

### 想法 1：块分解

每个前向块分成四个组件：

- **Attention。** Q/K/V 投影、attention、输出投影。
- **All-to-all 分派。** 跨节点通信，将 token 发送到其专家。
- **MLP。** MoE 专家计算。
- **All-to-all 组合。** 跨节点通信，将专家输出带回。

后向块添加每个的梯度版本。DualPipe 调度它们，使 all-to-all 分派与下一个块的 attention 计算并行发生，且 all-to-all 组合与后续块的 MLP 计算并行发生。

### 想法 2：双向调度

大多数流水线调度从阶段 0 注入微批次并流向阶段 P-1。DualPipe 从两端注入微批次。阶段 0 看到起源于那里的前向微批次；阶段 P-1 也看到起源于那里的前向微批次。两个流在中间相遇。

为此，设备 `i` 必须持有早期流水线层 `i` AND 晚期流水线层 `P - 1 - i`。这就是 DualPipe 的"dual"部分：每个设备保留两份它需要服务的模型层副本（每个方向一份）。在 DeepSeek-V3 的规模上，这是 2x 参数复制成本。它是可负担的，因为 Expert Parallelism 已经将 MoE 专家分散得如此之薄，以至于将非专家层复制两次是小菜一碟。

关键的是，一个方向的正向流和另一个方向的反向流恰好在单向调度中气泡所在的位置重叠。气泡消失。

### 手工追踪的调度

考虑 P = 4 个 rank，8 个微批次，分为 4 个正向 / 4 个反向。时间从左到右移动；行是设备 rank。

```
           Time →
rank 0:  F1 F2 F3 F4  F5R F6R F7R F8R  B1 B2 B3 B4  ...
rank 1:     F1 F2 F3  F4/F5R F6R F7R   B1 B2 ...
rank 2:        F1 F2  F3/F5R F4/F6R    B1 ...
rank 3:           F1  F2/F5R F3/F6R    ...
```

阅读 "F4/F5R" 符号：rank 1 在同一时间槽运行微批次 4 的正向（在流水线中从左到右）AND 微批次 5 的正向（从右到左）。这就是"双向"在操作上的含义。

在 rank 2，交叉流更早重叠；在 rank 0 和 P-1，它们最晚重叠。在调度的稳定中间阶段，每个 rank 运行 X 方向的前向与 Y 方向的后向重叠。计算繁忙。前向传递的 all-to-all 分派隐藏在后向计算内。All-to-all 组合隐藏在前向计算内。气泡被挤出。

### 气泡核算

标准 1F1B 流水线气泡（每 rank 浪费的时间）：

```
bubble_1F1B = (P - 1) * forward_chunk_time
```

Zero Bubble 改进将其降低但不到零。DualPipe 在稳定阶段，如果微批次计数可被 2 倍流水线深度整除，则零气泡。在稳定阶段之外（预热和冷却），有一些气泡，但它不随微批次数量增长 —— 论文强调的关键特性。

营销术语："无气泡"。技术术语：气泡不随微批次计数增长。Sea AI Lab 的后续分析（DualPipeV / Cut-in-half）显示，仅当 Expert Parallelism 不是瓶颈时才有完全零气泡；使用 EP 驱动的 all-to-all，一些调度妥协始终存在。

### DualPipeV —— 改进

Sea AI Lab（2025）观察到，当 EP 通信重叠不是重点时，2x 参数复制是浪费的。他们的 DualPipeV 调度将双向注入折叠成"V 形"调度，在单个参数副本上运行。气泡略大于 DualPipe 的，但内存节省可观。DeepSeek 在其开源 DualPipe 实现中将 DualPipeV 作为 EP 关闭模式采用。

权衡：

| 特性 | DualPipe | DualPipeV | 1F1B | Zero Bubble |
|---------|---------|-----------|------|------------|
| 每设备参数副本 | 2 | 1 | 1 | 1 |
| 气泡与微批次 | 恒定 | 小增长 | 增长 | 增长 |
| 计算-通信重叠 | 完全 | 部分 | 最小 | 部分 |
| 何时使用 | EP 重的 MoE | dense 或 EP 轻 | 基线 | 任何流水线 |

### 对 14.8T token 运行意味着什么

DeepSeek-V3 的预训练在 2,048 H800 GPU 上消耗 14.8T token，约 2.8M GPU 小时。使用朴素 1F1B，他们会因流水线气泡损失 12-15% —— 340-420K GPU 小时，足以训练完整的 70B 模型。DualPipe 恢复了大部分。没有内部日志直接量化贡献很困难，但论文中的声明是训练期间平均 GPU 利用率超过 95%。

对于较小运行（1k GPU 以下），DualPipe 过度杀伤 —— 流水线气泡相对于总成本较小，且 dense 模型训练很少碰到 all-to-all 瓶颈。对于多千 GPU 规模的前沿 MoE 训练，它实际上是必需的。

### 在栈中的位置

- 与 **FSDP**（第 10 阶段 · 05）互补。FSDP 跨 rank 分片模型参数；DualPipe 跨 rank 调度计算。它们结合。
- 与 **ZeRO-3** 梯度分片兼容。两份复制的簿记需要与 ZeRO 的分片梯度合作。
- 需要为特定集群拓扑调优的**自定义 all-to-all 内核**。DeepSeek 的开源内核是参考实现。

## 使用它

`code/main.py` 是流水线调度模拟器。它接受 `(P, n_micro_batches, schedule)` 并打印 1F1B、Zero Bubble、DualPipe 和 DualPipeV 每个的稳定阶段利用率。它是教学工具 —— 数字匹配论文中的定性声明，不是关于生产测量加速的声明。

模拟器的价值：用不同的 P 和微批次计数运行它，观察气泡分数如何对 1F1B 增长但不对 DualPipe 增长。

真实训练运行的集成考虑：

- 选择能干净整除微批次计数的流水线并行深度。
- 确保你的专家并行网格支持双向 all-to-all。DeepSeek 的内核是参考。
- 预期第一次调度本身要烧掉一周的调试时间。簿记很繁琐。
- 监控每 rank 的 GPU 利用率，不只是聚合。DualPipe 的收益来自收紧落后者。

## 交付

本课生成 `outputs/skill-dualpipe-planner.md`。给定训练集群规范（GPU 数量、拓扑、互连、模型形状），它推荐流水线并行策略、使用的调度算法和目标规模下的预期气泡分数。

## 练习

1. 在 `(P=8, micro_batches=16, schedule=dualpipe)` 和 `(P=8, micro_batches=16, schedule=1f1b)` 上运行 `code/main.py`。计算 GPU 利用率差异并将其表示为每百万训练 token 恢复的 GPU 小时。

2. 手工绘制 `(P=4, micro_batches=8, schedule=dualpipe)` 的调度表。用微批次 ID 和方向标记每个时间槽。识别气泡消失的第一个时间槽。

3. 阅读 DeepSeek-V3 技术报告（arXiv:2412.19437）的图 5。识别 DualPipe 前向块内 all-to-all 分派的重叠窗口。解释计算调度如何隐藏它。

4. 计算 P=8 流水线阶段和 70B dense 模型以及 P=16 流水线阶段和 671B MoE 模型的 DualPipe 2x 参数开销。展示为什么 MoE 情况的开销比例更小（大多数参数是专家，分片在大的 EP 组上）。

5. 将 DualPipe 与 Chimera（2021 年的竞争双向调度器）比较。识别 DualPipe 添加而 Chimera 没有的两个具体特性，使用论文的第 3.4 节作为参考。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 流水线气泡 | "每 rank 空闲时间" | 因为流水线阶段等待其输入或梯度而浪费的 GPU 周期 |
| 1F1B | "默认流水线调度" | 一个前向 / 一个后向交错调度；DualPipe 击败的基线 |
| Zero Bubble | "Sea AI Lab 2023" | 将后向分成 B（输入梯度）和 W（权重梯度）；几乎完全收紧流水线 |
| DualPipe | "DeepSeek-V3 调度" | 双向流水线 + 计算-通信重叠；气泡不随微批次计数增长 |
| DualPipeV | "Cut-in-half" | V 形改进，以稍大气泡为代价降低 2x 参数复制 |
| 块 | "流水线工作单元" | 一个微批次通过一个流水线阶段的前向或后向传递 |
| All-to-all 分派 | "发送 token 到专家" | 将 token 路由到其分配的 MoE 专家的跨节点通信 |
| All-to-all 组合 | "带回专家输出" | MLP 后收集专家输出的跨节点通信 |
| 专家并行（EP） | "跨 GPU 的专家" | 跨 rank 分片 MoE 专家，不同 GPU 持有不同专家 |
| 流水线并行（PP） | "跨 GPU 的层" | 跨 rank 分片模型层；DualPipe 调度的维度 |
| 气泡分数 | "浪费的 GPU 时间" | (bubble_time / total_time)；DualPipe 驱动向零的分数 |

## 延伸阅读

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437), Section 3.3.2 and Figure 5](https://arxiv.org/abs/2412.19437) —— 主要 DualPipe 参考
- [DeepSeek — DualPipe GitHub repository](https://github.com/deepseek-ai/DualPipe) —— 开源参考实现，包括 DualPipeV（Cut-in-half）模式
- [Qi et al. — Zero Bubble Pipeline Parallelism (arXiv:2401.10241, Sea AI Lab 2023)](https://arxiv.org/abs/2401.10241) —— Zero Bubble 前身
- [Sea AI Lab — DualPipe could be better without the Dual](https://sail.sea.com/blog/articles/63) —— 影响 DeepSeek EP 关闭模式的 DualPipeV 分析
- [Narayanan et al. — PipeDream / 1F1B (arXiv:1806.03377, 2018-2021)](https://arxiv.org/abs/1806.03377) —— DualPipe 比较的 1F1B 调度
- [Huang et al. — GPipe (arXiv:1811.06965, 2018)](https://arxiv.org/abs/1811.06965) —— 原始流水线并行论文和气泡问题
