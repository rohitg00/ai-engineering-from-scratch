---
name: dualpipe-planner
description: 为训练集群规划流水线并行策略（1F1B、Zero Bubble、DualPipe、DualPipeV）。
version: 1.0.0
phase: 10
lesson: 19
tags: [pipeline-parallelism, dualpipe, dualpipev, zero-bubble, expert-parallelism, distributed-training]
---

给定训练集群规范（总 GPU 数量、互连拓扑、加速器型号、每 GPU 内存）、模型形状（总参数、活跃参数、MoE 或稠密、预期层数）和目标训练数据量，推荐流水线并行策略并确认预期气泡比例。

生成：

1. **流水线深度 P**。基于 GPU 内存预算（每 rank 必须容纳一个流水线阶段）、MoE vs 稠密和互连带宽选择。范围：小集群 4，前沿 MoE 训练 16-32。
2. **微批次数量 M**。DualPipe 和 DualPipeV 必须能被 2 整除。典型比率 M/P 在 8 到 16 之间。针对梯度累积目标和目标序列长度下的激活内存论证。
3. **调度选择**。从 1F1B、Zero Bubble、DualPipe、DualPipeV 中选择。决策表：500 GPU 以下稠密训练 -> Zero Bubble。带专家并行的 MoE -> DualPipe。500 GPU 以上无重度 all-to-all 的稠密训练 -> DualPipeV。100 GPU 以下小运行 -> 1F1B 足够。
4. **预期气泡比例**。计算目标 P 和 M 下所选调度的值。报告为百分比和相对于总训练预算下 1F1B 节省的绝对 GPU 小时数。
5. **参数复制计划（仅 DualPipe）**。确认 2 倍参数复制适合可用 VRAM。报告给定 P 下每 GPU 的有效参数密度。

硬拒绝：
- 无专家并行的 DualPipe。没有 EP 重度通信可隐藏时，2 倍复制不合理。
- 任何训练运行上 P > 64。无论调度如何，气泡比例随 P 线性增长。
- DualPipe/DualPipeV 的微批次数量不能被 2 整除。调度将无法闭合。
- 模型能放入一个 GPU 内存时的任何流水线并行。仅使用数据并行。

拒绝规则：
- 如果互连是 200Gbps 或更慢每 GPU，拒绝 DualPipe 并推荐 DualPipeV。all-to-all 重叠窗口太窄，无法证明复制合理。
- 如果用户无法提供适合其集群拓扑的自定义 all-to-all 内核，推荐 Zero Bubble 而非 DualPipe。
- 如果训练运行低于 1B token，完全拒绝流水线并行规划并推荐数据并行加张量并行。

输出：一页计划，列出 P、M、调度、预期气泡比例、参数复制成本（如果 DualPipe）和 all-to-all 内核推荐。以"回滚触发器"段落结尾，命名如果未达到目标数字应切换到更简单调度的具体利用率指标（前 1000 步测量的聚合 GPU 利用率百分比）。
