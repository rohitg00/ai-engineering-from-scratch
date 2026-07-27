---
name: checkpointing-planner
description: 根据训练配置和 HBM 预算为每层选择激活重计算策略（无 / 选择性 / 全量 / 卸载）。
version: 1.0.0
phase: 10
lesson: 34
tags: [gradient-checkpointing, activation-recomputation, selective-checkpoint, fsdp-offload, training-memory]
---

给定训练配置（层数 L、隐藏大小 d、序列长度 S、微批处理 B、dtype 每值字节数、注意力内核、张量并行度 TP、流水线并行度 PP、如果 MoE 则为专家并行度 EP）和每等级在权重和优化器状态后的 HBM 预算，输出：

1. 每层策略。对栈中的每个层家族（嵌入层、注意力、FFN、MoE 专家、归一化层、输出头）选择无、选择性、全量或卸载。当 S 超过 4096 时注意力默认选择性；残差流和归一化层默认无；仅当该层激活值的测量 PCIe 传输时间小于其测量重计算时间时，FFN 默认卸载。
2. 段大小 k。如果启用全量检查点，在均匀层成本下选择 k = round(sqrt(L))，当激活内存占预算主导时选择更小的 k。报告额外 FLOP 百分比为前向 FLOP 的 (1/k)。
3. FlashAttention 交互。确认注意力内核是否已重计算 softmax。如果是，选择性注意力检查点购买价值不大；降级为无。按名称说明内核（FlashAttention-2/3、xFormers 内存高效、vanilla）。
4. TP / PP 计划。对于 TP，命名在重计算时需要收集或重散布的激活值以及每步增加的通信字节数。对于 PP，确认哪些流水线阶段获得端到端检查点，以便反向微批处理在流回之前释放激活内存。
5. 预算数学。预测策略前后的激活内存（每等级 MB 数）。预测 FLOP 开销为前向+反向的百分比。拒绝任何在 HBM 预算内且无 10% 余量的计划。

当仅选择性注意力检查点就能闭合预算时，拒绝每层全量检查点；性能分析显示，对于相同的内存节省，全量检查点的 FLOP 开销比选择性高许多倍，且确切的比率是工作负载特定的。当该层在目标 PCIe 链路上的测量激活传输时间超过其测量重计算时间时拒绝卸载；重计算胜出。当所选框架未快照 amax 历史时，拒绝 FP8 训练的"到处检查点"；重计算会漂移缩放因子并静默损坏梯度。

示例输入："L=64, d=8192, S=8192, B=1, bf16, FlashAttention-3, TP=8, PP=4, HBM budget per rank 32 GB after weights, MoE with 8 experts and EP=8."

示例输出：
- 每层策略：注意力选择性，FFN 无，MoE 专家全量，嵌入层无，输出头卸载。
- 段大小：仅在 MoE 上应用全量检查点，k=8；专家路径上 FLOP 开销 12%，其他地方为 0。
- FlashAttention 交互：FA-3 已重计算 softmax；在层封装器处选择性，而非内核内部。
- TP / PP 计划：TP 在重计算时收集注意力输入，每步额外通信 0.3 GB；PP 各阶段检查其完整前向；PP 阶段 3 保留其激活用于最终反向。
- 预算数学：无策略时激活 38 GB，有策略时 11 GB。总 FLOP 开销为前向+反向的 7.5%。
