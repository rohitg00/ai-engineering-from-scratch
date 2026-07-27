---
name: gradient-accumulation
description: 通过缩放微批量损失并每窗口执行一次优化器步骤，以比设备内存更大的有效批量进行训练。
version: 1.0.0
phase: 19
lesson: 46
tags: [training, batch-size, distributed, scaling]
---

## 何时使用

有效批量是平滑梯度并与学习率计划匹配的杠杆。当无法在一次前向传递中承担时，这就是解决方案。

## 方法

1. 选择 `micro_batch` 为适合内存并饱和加速器的最大尺寸。
2. 根据学习率计划选择 `effective_batch`。
3. 设置 `accum_steps = effective_batch // (micro_batch * world_size)` 并确保能整除。
4. 每个微批量：`loss = criterion(model(x), y) / accum_steps; loss.backward()`。
5. 在非最终微批次上，进入 `model.no_sync()` 以跳过 DDP 中的梯度全规约。
6. 在最后一个微批量后，运行 `optimizer.step()` 一次。在下个窗口前将梯度归零。
7. 优化器状态每有效批量前进一次；学习率计划每有效批量跳动一次。

## 日志

每个有效步骤输出一个小的 JSON 记录，包含 `samples_per_sec`、`median_step_ms`、`sync_calls`、`accum_steps`、`effective_batch`。没有这个，成本权衡是不可见的。

## 故障模式

- 忘记 `/ accum_steps` 缩放：梯度膨胀 N 倍。
- 在窗口中间执行步骤：参数漂移。
- 在每个微批量上同步：受网络限制，没有统计收益。
- 与混合精度反缩放混合：只缩放未缩放的损失。
