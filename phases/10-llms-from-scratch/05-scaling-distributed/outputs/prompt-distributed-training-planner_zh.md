---
name: prompt-distributed-training-planner
description: 给定模型大小和可用硬件，规划分布式训练运行
version: 1.0.0
phase: 10
lesson: 5
tags: [distributed-training, fsdp, deepspeed, tensor-parallelism, pipeline-parallelism, scaling]
---

# 分布式训练规划器

规划大型语言模型的分布式训练运行时，使用此框架确定并行策略、内存预算、通信开销和预期吞吐量。

## 输入要求

提供：
- **模型大小**（以十亿为单位的参数）
- **目标训练 token**（以万亿为单位）
- **可用 GPU**（类型：A100/H100/H200，数量，互连：NVLink/InfiniBand）
- **GPU 内存**（A100/H100 为 80GB，H200 为 141GB）
- **节点**（每节点 GPU 数，节点数）
- **预算约束**（最大成本（美元），最大实际时间）

## 步骤 1：内存预算

计算每个组件的每 GPU 内存：

| 组件 | 公式 | FP16 | FP32 |
|-----------|---------|------|------|
| 权重 | params x bytes_per_param | params x 2 | params x 4 |
| Adam 优化器 (m + v) | params x 4 x 2 | 始终 8 字节/param | 8 字节/param |
| 梯度 | params x bytes_per_param | params x 2 | params x 4 |
| 激活（估算） | seq_len x batch x hidden x layers x 2 | 变化 | 变化 |

如果总量超过 GPU 内存，则需要分片。按顺序尝试：
1. ZeRO-1（仅分片优化器）-- 通信成本最低
2. ZeRO-2（+ 梯度）-- 中等通信
3. FSDP/ZeRO-3（+ 权重）-- 通信成本最高但内存节省最大
4. 如果激活仍然太大，添加激活检查点
5. 如果单层无法放入一个 GPU，添加张量并行

## 步骤 2：并行策略

### 决策树

1. **一层是否能放入一个 GPU？**
   - 否：你需要张量并行。设置 TP = 2, 4, 或 8（在一个节点内）。
   - 是：跳过张量并行。

2. **完整模型（带分片）是否能放入一个节点内的 GPU？**
   - 否：你需要流水线并行。设置 PP = 节点数 / 组数。
   - 是：跳过流水线并行。

3. **数据并行还能用多少剩余 GPU？**
   - DP = total_gpus / (TP x PP)

4. **数据并行组内的分片级别？**
   - 从 FSDP (ZeRO-3) 开始。如果通信是瓶颈，降低到 ZeRO-2 或 ZeRO-1。

### 典型配置

| 模型大小 | 总 GPU | TP | PP | DP | 分片 |
|-----------|-----------|----|----|-----|----------|
| 7B | 8 | 1 | 1 | 8 | FSDP |
| 13B | 16 | 2 | 1 | 8 | FSDP |
| 70B | 64 | 8 | 1 | 8 | FSDP |
| 70B | 128 | 8 | 2 | 8 | FSDP |
| 405B | 16,384 | 8 | 16 | 128 | FSDP |

## 步骤 3：通信分析

估算每训练步骤的通信量：

- **数据并行 (all-reduce)**：每步 2 x gradient_size x (N-1)/N
- **FSDP (all-gather + reduce-scatter)**：每步约 3 x weight_size x (N-1)/N（高于 DP）
- **张量并行 (每层 all-reduce)**：每步 2 x activation_size x num_layers（需要 NVLink）
- **流水线并行 (点对点)**：每阶段边界 activation_size（最小）

如果通信时间超过计算时间的 20%，策略受通信限制。解决方案：
- 梯度累积（降低 all-reduce 频率）
- 通信与计算重叠（FSDP 默认执行此操作）
- 增加微批次大小（更好的计算通信比）
- 切换到通信强度较低的分片阶段

## 步骤 4：吞吐量和成本估算

**每训练步骤的 FLOPS：**
- 前向：约 2 x params x tokens_per_batch
- 反向：约 4 x params x tokens_per_batch（2 倍前向）
- 总计：约 6 x params x tokens_per_batch

**训练时间：**
- total_flops = 6 x params x total_tokens
- time_seconds = total_flops / (num_gpus x gpu_tflops x 1e12 x utilization)
- 典型利用率：35-45%（考虑通信、流水线气泡、内存开销）

**成本：**
- total_gpu_hours = num_gpus x time_seconds / 3600
- cost = total_gpu_hours x cost_per_gpu_hour

## 步骤 5：验证检查清单

启动前：

1. 每 GPU 内存适合硬件限制（保留 10% 余量）
2. 有效批次大小与目标匹配（per_gpu_batch x DP x gradient_accumulation_steps）
3. 通信计算比低于 20%
4. 流水线气泡比例低于 15%（足够的微批次）
5. 学习率按有效批次大小缩放
6. 检查点频率考虑故障概率（大型运行每 1-2 小时保存）
7. 梯度裁剪已设置（大模型通常为 1.0）
8. 预热步数与总步数成比例（通常为总数的 0.1-1%）

## 危险信号

- **TP > 8**：跨节点的张量并行（通过 InfiniBand）几乎总是比流水线并行慢
- **流水线阶段 > 32**：即使有大量微批次，气泡开销也变得显著
- **有效批次大小 > 10M token**：收益递减；可能损害收敛
- **利用率低于 30%**：受通信限制 -- 重新评估并行策略
- **13B 以上没有激活检查点**：反向传播期间会耗尽内存
- **没有梯度累积的每 GPU 小批次**：梯度噪声增加；累积到有效批次 256+ 样本
