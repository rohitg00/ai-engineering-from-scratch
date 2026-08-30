# 19 · DualPipe 并行

> DeepSeek-V3 在 2,048 块 H800 GPU 上训练，其 MoE 专家分散在各个节点上。跨节点的专家全对全（all-to-all）通信成本极高：每 1 个 GPU-小时的计算就要搭上 1 个 GPU-小时的通信。GPU 有一半时间处于空闲。DualPipe（DeepSeek，2024 年 12 月）是一种双向流水线，它把前向、反向计算与它们触发的全对全通信相互重叠。气泡（bubble）减少、吞吐攀升，而保留两份模型参数副本（即名字中「dual」的由来）的代价很低——因为一旦专家并行（Expert Parallelism）已经把专家分散到各个 rank 上，这点开销就不算什么。本课是一篇「学习」（Learn）型的讲解，剖析 DualPipe 到底做了什么，以及为什么 Sea AI Lab 的 DualPipeV 改进能以略微更紧的气泡为代价，砍掉 2 倍的参数开销。

**类型：** 学习
**语言：** Python（标准库，调度模拟器）
**前置：** 阶段 10 · 05（分布式训练、FSDP、DeepSpeed）、阶段 10 · 14（开源模型架构与 MoE）
**时长：** 约 60 分钟

## 学习目标

- 说出 DualPipe 前向-反向 chunk 的四个组成部分，以及为什么每一部分都有自己的重叠窗口。
- 解释大规模下的流水线气泡问题，以及「无气泡」在实践中相对于营销话术究竟意味着什么。
- 手工推演 8 个 PP rank、16 个 micro-batch 的 DualPipe 调度，并确认前向流和反向流互相填补对方的空闲时段。
- 阐述 DualPipeV（Sea AI Lab，2025）所做的权衡：在专家并行未启用时，以略大的气泡为代价，去掉 2 倍参数复制。

## 问题所在

在 2k 块 H800 GPU 上训练一个 671B 的 MoE 模型，会遭遇三个相互叠加的瓶颈：

1. **显存压力。** 每块 GPU 只保存模型的一个切片。在序列长度 8k、61 层、128 个注意力头的情况下，激活值显存极为庞大。
2. **流水线气泡。** 传统流水线并行（GPipe、1F1B）会让 GPU 在等待本阶段的输入或梯度时空转。在 8 个阶段下，即便采用 1F1B 调度，大约 12% 的 GPU 时间仍可能成为气泡。
3. **跨节点全对全通信。** 采用专家并行的 MoE 会把专家分散到各个节点。每次前向都会触发一次全对全通信，把 token 派发（dispatch）给对应的专家，再触发一次把结果合并（combine）回来。在 2k 块 GPU 上，这很容易变成 1:1 的计算-通信比。

每个瓶颈都有各自的解法：显存靠梯度检查点（gradient checkpointing），流水线气泡靠 Zero Bubble（Sea AI Lab，2023），全对全靠专家并行的通信核（comm kernel）。而 DualPipe 做的是让它们协同起来。它的调度在单个前向-反向 chunk 内部把计算和通信重叠起来，同时从流水线两端注入 micro-batch，并利用由此形成的调度把全对全通信藏进计算窗口里。

报告中的结果是：流水线气泡几乎被消除，在 DeepSeek-V3 的 14.8T-token 训练中 GPU 利用率超过 95%。

## 概念

### 流水线并行回顾

把一个 N 层的模型切分到 P 个设备上。设备 `i` 保存 `i * N/P .. (i+1) * N/P - 1` 这些层。一个 micro-batch 从设备 0 一路前向流到设备 P-1，再从 P-1 反向流回设备 0。每个设备只有在前一个设备发来它的输出后才能开始自己的前向阶段，也只有在下游设备发来上游梯度后才能开始反向。

GPipe（Huang 等人，2019）每次只调度一个 micro-batch，浪费了大部分 GPU 时间。1F1B（Narayanan 等人，2021）把多个 micro-batch 的前向和反向交错（interleave）起来。Zero Bubble（Qi 等人，2023）把反向过程拆成两部分——针对输入的反向（B）和针对权重的反向（W）——并调度它们去填补气泡。经过 Zero Bubble，流水线已经几乎被填满。

DualPipe 是下一步。它在此基础上加了两个思路：

### 思路 1：chunk 分解

每个前向 chunk 被拆成四个组成部分：

- **注意力（Attention）。** Q/K/V 投影、注意力计算、输出投影。
- **全对全派发（All-to-all dispatch）。** 把 token 发送给对应专家的跨节点通信。
- **MLP。** MoE 专家的计算。
- **全对全合并（All-to-all combine）。** 把专家输出取回来的跨节点通信。

一个反向 chunk 会为上述每一部分增加对应的梯度版本。DualPipe 这样调度它们：全对全派发与下一个 chunk 的注意力计算并行进行，全对全合并与再下一个 chunk 的 MLP 计算并行进行。

### 思路 2：双向调度

大多数流水线调度从阶段 0 注入 micro-batch，向阶段 P-1 流动。DualPipe 从**两端**同时注入 micro-batch。阶段 0 看到从这里出发的前向 micro-batch；阶段 P-1 也看到从那里出发的前向 micro-batch。两股流在中间会合。

要做到这一点，设备 `i` 必须同时保存流水线前段的层 `i` **和**流水线后段的层 `P - 1 - i`。这就是 DualPipe 里「dual（双）」的含义：每个设备保留它需要服务的模型层的两份副本（每个方向一份）。在 DeepSeek-V3 的规模下，这是 2 倍的参数复制成本。之所以负担得起，是因为专家并行已经把 MoE 专家分得极薄，相比之下把非专家层复制两份只是小钱。

关键在于：一个方向的前向流和另一个方向的反向流，恰好在单向调度本会出现气泡的位置上重叠。气泡因此消失。

### 手工推演的调度

考虑 P = 4 个 rank、8 个 micro-batch，按 4 个前向 / 4 个反向划分。时间从左向右推进；每一行是一个设备 rank。

```
           Time →
rank 0:  F1 F2 F3 F4  F5R F6R F7R F8R  B1 B2 B3 B4  ...
rank 1:     F1 F2 F3  F4/F5R F6R F7R   B1 B2 ...
rank 2:        F1 F2  F3/F5R F4/F6R    B1 ...
rank 3:           F1  F2/F5R F3/F6R    ...
```

理解「F4/F5R」这个记号：rank 1 在同一个时间槽里，既运行 micro-batch 4 的前向（在流水线中从左向右流动），又运行 micro-batch 5 的前向（从右向左流动）。这就是「双向」在操作层面上的含义。

在 rank 2 上两股交叉流更早重叠，在 rank 0 和 P-1 上重叠得最晚。在调度的稳定中段，每个 rank 都在用「X 方向的前向」与「Y 方向的反向」相互重叠地运行。计算始终繁忙。前向过程的全对全派发藏在反向计算里，全对全合并藏在前向计算里。气泡被挤了出去。

### 气泡核算

标准 1F1B 流水线气泡（每个 rank 浪费的时间）：

```
bubble_1F1B = (P - 1) * forward_chunk_time
```

Zero Bubble 改进把它降了下来，但没有降到零。DualPipe 在稳定段，只要 micro-batch 数量能被 2 倍流水线深度整除，气泡就为零。在稳定段之外（预热和收尾阶段）会有一些气泡，但它不随 micro-batch 数量增长——这是论文重点强调的一个关键性质。

用营销话术说：「无气泡」。用技术话术说：气泡不随 micro-batch 数量增长。Sea AI Lab 的后续分析（DualPipeV / Cut-in-half）表明，只有当专家并行不是瓶颈时才能实现完全的零气泡；一旦有 EP 驱动的全对全通信，调度上总会存在某种折衷。

### DualPipeV——改进版

Sea AI Lab（2025）观察到，当 EP 通信重叠并非重点时，2 倍参数复制就是一种浪费。他们的 DualPipeV 调度把双向注入折叠成一个「V 形」调度，仅在单份参数副本上运行。气泡比 DualPipe 略大，但显存节省相当可观。DeepSeek 在其开源的 DualPipe 实现中把 DualPipeV 作为一种 EP 关闭模式采用了进来。

权衡如下：

| 特性 | DualPipe | DualPipeV | 1F1B | Zero Bubble |
|---------|---------|-----------|------|------------|
| 每设备参数副本数 | 2 | 1 | 1 | 1 |
| 气泡 vs micro-batch 数 | 恒定 | 小幅增长 | 增长 | 增长 |
| 计算-通信重叠 | 完全 | 部分 | 极少 | 部分 |
| 适用场景 | EP 密集的 MoE | 稠密或 EP 较轻 | 基线 | 任意流水线 |

### 它对 14.8T-token 训练意味着什么

DeepSeek-V3 的预训练在 2,048 块 H800 GPU 上消耗了 14.8T token，约耗 2.8M GPU-小时。若用朴素的 1F1B，其中 12-15% 会因流水线气泡而损失——也就是 340-420K GPU-小时，足以训出一个完整的 70B 模型。DualPipe 把这部分大都收了回来。没有内部日志，很难直接量化它的贡献，但论文中的说法是训练全程平均 GPU 利用率超过 95%。

对于更小的训练（1k 块 GPU 以下），DualPipe 属于杀鸡用牛刀——相对于总成本，流水线气泡更小，而稠密模型训练也很少撞上全对全瓶颈。但对于数千 GPU 规模的前沿 MoE 训练，它基本上是必需品。

### 它在技术栈中的位置

- 与 **FSDP**（阶段 10 · 05）互补。FSDP 把模型参数分片到各个 rank 上；DualPipe 把计算调度到各个 rank 上。二者可以结合。
- 兼容 **ZeRO-3** 梯度分片。两份副本复制的簿记工作需要与 ZeRO 的分片梯度配合。
- 需要针对特定集群拓扑调优的**定制全对全核（custom all-to-all kernels）**。DeepSeek 的开源核是参考实现。

## 上手用

`code/main.py` 是一个流水线调度模拟器。它接收 `(P, n_micro_batches, schedule)`，并为 1F1B、Zero Bubble、DualPipe、DualPipeV 各打印出稳定段利用率。它是个教学工具——这些数字与论文中的定性论断相符，但并不是对生产环境实测加速比的声明。

这个模拟器的价值在于：用不同的 P 和 micro-batch 数量运行它，观察 1F1B 的气泡占比如何增长，而 DualPipe 不增长。

真实训练运行的集成注意事项：

- 选一个能整除你 micro-batch 数量的流水线并行深度。
- 确保你的专家并行网格（mesh）支持双向全对全。DeepSeek 的核是参考。
- 第一次做好准备在调度本身上烧掉一周的调试时间。簿记很琐碎。
- 监控每个 rank 的 GPU 利用率，而不只是聚合值。DualPipe 的收益来自于收紧那些拖后腿的 rank（straggler）。

## 交付物

本课产出 `outputs/skill-dualpipe-planner.md`。给定一份训练集群规格（GPU 数量、拓扑、互联、模型形状），它会推荐一种流水线并行策略、要使用的调度算法，以及目标规模下的预期气泡占比。

## 练习

1. 在 `(P=8, micro_batches=16, schedule=dualpipe)` 和 `(P=8, micro_batches=16, schedule=1f1b)` 上运行 `code/main.py`。计算 GPU 利用率差值，并把它表达为「每百万训练 token 所挽回的 GPU-小时」。

2. 手工绘制 `(P=4, micro_batches=8, schedule=dualpipe)` 的调度表。给每个时间槽标上 micro-batch ID 和方向。指出第一个不再有气泡的时间槽。

3. 阅读 DeepSeek-V3 技术报告（arXiv:2412.19437）的图 5。找出 DualPipe 前向 chunk 内全对全派发的重叠窗口。解释计算调度是如何把它藏起来的。

4. 计算 DualPipe 在两种情形下的 2 倍参数开销：一个 P=8 流水线阶段的 70B 稠密模型，以及一个 P=16 流水线阶段的 671B MoE 模型。说明为什么 MoE 情形下的开销在比例上更小（大多数参数是专家，被分片到一个很大的 EP 组上）。

5. 把 DualPipe 与 Chimera（2021 年一个与之竞争的双向调度器）做对比。以论文第 3.4 节为参考，指出 DualPipe 新增而 Chimera 没有的两个具体性质。

## 关键术语

| 术语 | 人们怎么说 | 它实际意味着什么 |
|------|----------------|------------------------|
| 流水线气泡（Pipeline bubble） | 「每个 rank 的空闲时间」 | 因为某个流水线阶段在等待输入或梯度而浪费掉的 GPU 周期 |
| 1F1B | 「默认流水线调度」 | 一前向一反向交错的调度；DualPipe 要打败的基线 |
| Zero Bubble | 「Sea AI Lab 2023」 | 把反向拆成 B（输入梯度）和 W（权重梯度）；几乎把流水线完全填满 |
| DualPipe | 「DeepSeek-V3 调度」 | 双向流水线 + 计算-通信重叠；气泡不随 micro-batch 数量增长 |
| DualPipeV | 「Cut-in-half」 | V 形改进，以略大的气泡为代价去掉 2 倍参数复制 |
| Chunk | 「流水线工作单元」 | 一个 micro-batch 通过一个流水线阶段的一次前向或反向 |
| 全对全派发（All-to-all dispatch） | 「把 token 发给专家」 | 把 token 路由到其分配到的 MoE 专家的跨节点通信 |
| 全对全合并（All-to-all combine） | 「把专家输出取回来」 | MLP 之后收集专家输出的跨节点通信 |
| 专家并行（Expert Parallelism，EP） | 「专家跨 GPU」 | 把 MoE 专家分片到各个 rank 上，使不同 GPU 持有不同专家 |
| 流水线并行（Pipeline Parallelism，PP） | 「层跨 GPU」 | 把模型层分片到各个 rank 上；这正是 DualPipe 调度的维度 |
| 气泡占比（Bubble fraction） | 「浪费的 GPU 时间」 | （bubble_time / total_time）；DualPipe 把它推向零的那个比例 |

## 延伸阅读

- [DeepSeek-AI — DeepSeek-V3 技术报告（arXiv:2412.19437），第 3.3.2 节及图 5](https://arxiv.org/abs/2412.19437) —— DualPipe 的主要参考文献
- [DeepSeek — DualPipe GitHub 仓库](https://github.com/deepseek-ai/DualPipe) —— 开源参考实现，含 DualPipeV（Cut-in-half）模式
- [Qi 等人 — Zero Bubble Pipeline Parallelism（arXiv:2401.10241，Sea AI Lab 2023）](https://arxiv.org/abs/2401.10241) —— Zero Bubble 前作
- [Sea AI Lab — DualPipe could be better without the Dual](https://sail.sea.com/blog/articles/63) —— 启发了 DeepSeek EP 关闭模式的 DualPipeV 分析
- [Narayanan 等人 — PipeDream / 1F1B（arXiv:1806.03377，2018-2021）](https://arxiv.org/abs/1806.03377) —— DualPipe 对比的 1F1B 调度
- [Huang 等人 — GPipe（arXiv:1811.06965，2018）](https://arxiv.org/abs/1811.06965) —— 流水线并行与气泡问题的原始论文
