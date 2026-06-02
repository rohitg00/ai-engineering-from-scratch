# DualPipe 流水线并行（DualPipe Parallelism）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> DeepSeek-V3 在 2,048 张 H800 GPU 上完成训练，MoE 专家分散在多个节点上。跨节点的专家 all-to-all 通信代价巨大——每 1 个 GPU-小时的计算就要搭上 1 个 GPU-小时的通信，GPU 一半时间都在空转。DualPipe（DeepSeek，2024 年 12 月）是一种双向流水线（pipeline），它把前向、反向计算与它们触发的 all-to-all 通信重叠起来。气泡（bubble）减少，吞吐上升；而保留两份模型参数副本（"dual" 这个名字的由来）的代价并不高——既然 Expert Parallelism 已经把专家铺到各个 rank 上了，再多复制一份非专家层算不上什么大开销。本课是 Learn 类型的讲解，带你走一遍 DualPipe 究竟做了什么，以及 Sea AI Lab 的 DualPipeV 改进版如何用「略微更紧的气泡」换掉那 2 倍参数代价。

**Type:** Learn
**Languages:** Python (stdlib, schedule simulator)
**Prerequisites:** Phase 10 · 05（分布式训练、FSDP、DeepSpeed），Phase 10 · 14（开放模型架构与 MoE）
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 说出 DualPipe 一个 forward-backward chunk 的四个组成部分，以及每一部分为何要有自己的重叠窗口。
- 解释规模化训练里的流水线气泡问题，以及「无气泡（bubble-free）」在工程上和在营销话术上的区别。
- 手工推演 8 个 PP rank、16 个 micro-batch 的 DualPipe 调度，验证正向流和反向流确实互相填上了对方的空闲时隙。
- 说清楚 DualPipeV（Sea AI Lab，2025）的取舍：在 Expert Parallelism 不活跃时，用「稍大一些的气泡」换掉 2 倍参数复制开销。

## 问题（The Problem）

在 2k 张 H800 上训练一个 671B 的 MoE 模型，会同时撞上三个相互叠加的瓶颈：

1. **显存压力。** 每张 GPU 只持有模型的一片。在 128 头、61 层、序列长度 8k 的情形下，激活值（activation）显存极其庞大。
2. **流水线气泡。** 传统流水线并行（GPipe、1F1B）让 GPU 在等本阶段的输入或梯度时空转。在 8 个 stage 时，即便采用 1F1B 调度，大约也有 12% 的 GPU 时间是气泡。
3. **跨节点 all-to-all。** 带 expert parallelism 的 MoE 把专家分散在各节点。每次前向都要触发一次 all-to-all 把 token 派发到对应专家，再触发一次把结果合回来。在 2k GPU 规模下，计算与通信的比例很容易达到 1:1。

每个问题各自都有解：显存可以用 gradient checkpointing，流水线气泡可以用 Zero Bubble（Sea AI Lab，2023），all-to-all 可以用 expert-parallel 通信内核。DualPipe 做的事情，是让这三类技术配合起来——它把计算与通信的重叠塞进单个 forward-backward chunk 里，从流水线两端同时注入 micro-batch，再用最终的调度把 all-to-all 隐藏在计算窗口之内。

公开的结果：流水线气泡几近消除；DeepSeek-V3 那次 14.8T-token 训练里，GPU 利用率超过 95%。

## 概念（The Concept）

### 流水线并行回顾

把一个 N 层模型切到 P 个设备上。设备 `i` 持有 `i * N/P .. (i+1) * N/P - 1` 这几层。一个 micro-batch 先从设备 0 一路前向传到 P-1，再从 P-1 反向传回 0。每个设备只有等到上游设备把输出送过来才能开始自己的前向，只有等到下游设备把上游梯度送过来才能开始反向。

GPipe（Huang 等，2019）一次只调度一个 micro-batch，浪费了大部分 GPU 时间。1F1B（Narayanan 等，2021）把多个 micro-batch 的前向、反向交错起来。Zero Bubble（Qi 等，2023）进一步把反向拆成两部分——backward-for-input（B）和 backward-for-weights（W）——并把它们调度到气泡里去。Zero Bubble 之后，流水线已经几乎贴满。

DualPipe 是再下一步。它在此基础上加了两个想法：

### 想法 1：chunk 拆解

每个前向 chunk 拆成四个部分：

- **Attention。** Q/K/V 投影、attention、输出投影。
- **All-to-all dispatch。** 跨节点通信，把 token 派发到对应的专家。
- **MLP。** MoE 专家计算。
- **All-to-all combine。** 跨节点通信，把专家的输出收回来。

反向 chunk 则给上述每一部分加上对应的梯度版本。DualPipe 的调度让 all-to-all dispatch 与下一个 chunk 的 attention 计算并行，而 all-to-all combine 与再下一个 chunk 的 MLP 计算并行。

### 想法 2：双向调度

绝大多数流水线调度只从 stage 0 注入 micro-batch，向 stage P-1 流动。DualPipe 同时从**两端**注入：stage 0 看到从这里出发的前向 micro-batch，stage P-1 也看到从那里出发的前向 micro-batch。两股流在中间相遇。

要做到这点，设备 `i` 必须同时持有早段的第 `i` 层**和**晚段的第 `P - 1 - i` 层。这就是 DualPipe 名字里 "dual" 的来源——每个设备保留它要服务的两份模型层副本（每个方向一份）。在 DeepSeek-V3 的规模下，这意味着 2 倍的参数复制成本。之所以可以接受，是因为 Expert Parallelism 已经把 MoE 专家铺得很薄，再把非专家层复制两份相比之下只是小钱。

关键之处：一个方向的前向流和另一个方向的反向流，恰好重叠在「单向调度本会出现气泡」的位置。气泡就这样消失了。

### 手工推演调度

考虑 P = 4 个 rank、8 个 micro-batch，分成 4 个正向 / 4 个反向。时间从左往右走，行是设备 rank。

```
           Time →
rank 0:  F1 F2 F3 F4  F5R F6R F7R F8R  B1 B2 B3 B4  ...
rank 1:     F1 F2 F3  F4/F5R F6R F7R   B1 B2 ...
rank 2:        F1 F2  F3/F5R F4/F6R    B1 ...
rank 3:           F1  F2/F5R F3/F6R    ...
```

读懂 "F4/F5R" 这个写法：rank 1 在同一个时隙里既跑 micro-batch 4 的前向（在流水线里从左往右走），又跑 micro-batch 5 的前向（从右往左走）。这就是「双向」在工程上的实际含义。

在 rank 2，两股交叉流更早重叠；在 rank 0 和 P-1 上则最晚重叠。在调度的稳定中段，每个 rank 都同时跑着「X 方向的前向」与「Y 方向的反向」。计算单元一直忙着。前向的 all-to-all dispatch 藏在反向计算里，前向计算里又藏着 all-to-all combine。气泡被挤了出去。

### 气泡账本

标准 1F1B 流水线气泡（每个 rank 浪费的时间）：

```
bubble_1F1B = (P - 1) * forward_chunk_time
```

Zero Bubble 改进版能压低这个量，但压不到零。DualPipe 在稳定段里，只要 micro-batch 数能被流水线深度的 2 倍整除，就有零气泡。稳定段之外（warmup 和 cooldown）确实还有气泡，但它**不会**随 micro-batch 数增长——这是论文重点强调的关键属性。

营销话术里叫「无气泡（bubble-free）」；技术上更准确的说法是：气泡不随 micro-batch 数增长。Sea AI Lab 后续的分析（DualPipeV / Cut-in-half）指出，只有在 Expert Parallelism 不是瓶颈时才能完全零气泡；当 EP 驱动的 all-to-all 占主导时，调度上总会有一些妥协。

### DualPipeV——改进版

Sea AI Lab（2025）注意到，当 EP 通信重叠不再是重点时，那 2 倍参数复制就是浪费。他们的 DualPipeV 调度把双向注入折成一个「V 形」调度，只跑一份参数副本。气泡比 DualPipe 略大，但显存节省非常可观。DeepSeek 在他们开源的 DualPipe 实现里采纳了 DualPipeV，作为 EP-off 模式。

取舍如下：

| 特性 | DualPipe | DualPipeV | 1F1B | Zero Bubble |
|---------|---------|-----------|------|------------|
| 每设备参数副本数 | 2 | 1 | 1 | 1 |
| 气泡随 micro-batch 数变化 | 常数 | 缓慢增长 | 增长 | 增长 |
| 计算-通信重叠 | 完整 | 部分 | 极少 | 部分 |
| 何时使用 | EP 重的 MoE | dense 模型或 EP 较轻 | 基线 | 任意流水线 |

### 这对一次 14.8T-token 训练意味着什么

DeepSeek-V3 的预训练消耗了 14.8T token、2,048 张 H800、约 280 万 GPU-小时。如果用朴素的 1F1B，会有 12-15% 被流水线气泡吞掉——也就是 34 万到 42 万 GPU-小时，足够训练一个完整的 70B 模型。DualPipe 把这部分大头救了回来。没有内部日志的话很难精确量化它单独的贡献，但论文宣称训练全程平均 GPU 利用率超过 95%。

对更小规模的训练（不到 1k GPU），DualPipe 是杀鸡用牛刀——流水线气泡相对总成本占比更小，dense 模型训练也很少撞上 all-to-all 瓶颈。但对多千卡规模的前沿 MoE 训练，它基本是必备的。

### 它在技术栈里的位置

- 与 **FSDP**（Phase 10 · 05）互补。FSDP 把模型参数 shard 到各 rank；DualPipe 把计算调度到各 rank。两者可以叠加。
- 与 **ZeRO-3** 梯度 sharding 兼容。两份副本复制对应的 bookkeeping 需要与 ZeRO 的分片梯度协同。
- 需要为具体的集群拓扑调优过的 **自定义 all-to-all 内核**。DeepSeek 开源的内核就是参考实现。

## 用起来（Use It）

`code/main.py` 是一个流水线调度模拟器。它接收 `(P, n_micro_batches, schedule)`，分别打印出 1F1B、Zero Bubble、DualPipe、DualPipeV 在稳定段的利用率。这是一个教学工具——数字与论文里的定性结论一致，但不是对生产环境实测加速的承诺。

模拟器的价值：用不同的 P 和 micro-batch 数跑一跑，看着 1F1B 的气泡占比怎么涨、而 DualPipe 不涨。

实际训练运行的集成注意事项：

- 选一个能被 micro-batch 数整除的流水线并行深度。
- 确认你的 expert-parallel mesh 支持双向 all-to-all。DeepSeek 的内核是参考。
- 第一次上手时，预留一周的时间专门 debug 调度本身。bookkeeping 非常琐碎。
- 监控**每个 rank** 的 GPU 利用率，不要只看聚合值。DualPipe 的好处来自把 straggler 拉紧。

## 上线部署（Ship It）

本课会产出 `outputs/skill-dualpipe-planner.md`。给定一份训练集群规格（GPU 数量、拓扑、互联、模型形状），它会推荐一种流水线并行策略、要使用的调度算法，以及在目标规模下的预期气泡占比。

## 练习（Exercises）

1. 用 `code/main.py` 跑 `(P=8, micro_batches=16, schedule=dualpipe)` 和 `(P=8, micro_batches=16, schedule=1f1b)`。算出 GPU 利用率差值，并把它折算成「每百万 token 训练量找回的 GPU-小时」。

2. 手画 `(P=4, micro_batches=8, schedule=dualpipe)` 的调度表，在每个时隙里标出 micro-batch ID 和方向。指出第一个**不存在**气泡的时隙。

3. 阅读 DeepSeek-V3 技术报告（arXiv:2412.19437）的图 5。指出 DualPipe 一个前向 chunk 里 all-to-all dispatch 的重叠窗口在哪。解释计算调度是怎么把它隐藏起来的。

4. 计算 DualPipe 在 P=8 流水线 stage 的 70B dense 模型上的 2 倍参数开销，以及在 P=16 流水线 stage 的 671B MoE 模型上的 2 倍参数开销。说明为什么 MoE 那种情况开销占比更小（绝大多数参数都是专家，已经被分到一个很大的 EP 组上）。

5. 把 DualPipe 与 Chimera（2021 年的一个竞争对手——双向调度器）对比。以论文 3.4 节为参考，指出 DualPipe 加了哪两条 Chimera 没有的具体性质。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际指什么 |
|------|----------------|------------------------|
| Pipeline bubble（流水线气泡） | "每个 rank 的空闲时间" | 流水线某 stage 在等输入或梯度，导致 GPU 周期被浪费 |
| 1F1B | "默认的流水线调度" | 一个前向 / 一个反向交错调度；DualPipe 要击败的基线 |
| Zero Bubble | "Sea AI Lab 2023" | 把反向拆成 B（输入梯度）和 W（权重梯度）；几乎让流水线贴满 |
| DualPipe | "DeepSeek-V3 的调度" | 双向流水线 + 计算-通信重叠；气泡不随 micro-batch 数增长 |
| DualPipeV | "Cut-in-half" | V 形改进版，用稍大一些的气泡换掉 2 倍参数复制 |
| Chunk | "流水线工作单元" | 一个 micro-batch 在一个流水线 stage 上的前向或反向 |
| All-to-all dispatch | "把 token 送到专家" | 跨节点通信，把 token 路由到它被分配到的 MoE 专家 |
| All-to-all combine | "把专家输出收回来" | 跨节点通信，在 MLP 之后把专家输出聚合回来 |
| Expert Parallelism (EP) | "把专家铺到 GPU 上" | 把 MoE 专家分片到各 rank，让不同 GPU 持有不同专家 |
| Pipeline Parallelism (PP) | "把层铺到 GPU 上" | 把模型层分片到各 rank；DualPipe 调度的就是这个维度 |
| Bubble fraction（气泡占比） | "浪费的 GPU 时间" | (bubble_time / total_time)；DualPipe 把它压向零 |

## 延伸阅读（Further Reading）

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437), Section 3.3.2 and Figure 5](https://arxiv.org/abs/2412.19437) — DualPipe 的主要参考文献
- [DeepSeek — DualPipe GitHub repository](https://github.com/deepseek-ai/DualPipe) — 开源参考实现，包含 DualPipeV（Cut-in-half）模式
- [Qi et al. — Zero Bubble Pipeline Parallelism (arXiv:2401.10241, Sea AI Lab 2023)](https://arxiv.org/abs/2401.10241) — Zero Bubble 前作
- [Sea AI Lab — DualPipe could be better without the Dual](https://sail.sea.com/blog/articles/63) — 启发了 DeepSeek EP-off 模式的 DualPipeV 分析
- [Narayanan et al. — PipeDream / 1F1B (arXiv:1806.03377, 2018-2021)](https://arxiv.org/abs/1806.03377) — DualPipe 对照的 1F1B 调度
- [Huang et al. — GPipe (arXiv:1811.06965, 2018)](https://arxiv.org/abs/1811.06965) — 流水线并行的开山之作和气泡问题
