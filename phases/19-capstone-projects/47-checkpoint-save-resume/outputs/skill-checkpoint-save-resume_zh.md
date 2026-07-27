---
name: checkpoint-save-resume
description: 原子性、分片的检查点，带有完整的 RNG 捕获，使被杀死的运行在 epoch 中间恢复，保持相同的损失轨迹。
version: 1.0.0
phase: 19
lesson: 47
tags: [training, durability, resume, sharded-state]
---

## 何时使用

任何运行时间长于集群墙上时钟上限的训练，任何必须承受节点重启的运行，任何对于单个负载来说过大的模型。

## 负载形状

```python
{
  "schema": "ckpt.v1",
  "model": model.state_dict(),
  "optimizer": opt.state_dict(),
  "scheduler": sched.state_dict(),
  "state": {"step": int, "epoch": int, "batch_in_epoch": int, "losses": [float, ...]},
  "rng": {"python": ..., "numpy": ..., "torch_cpu": ..., "torch_cuda": ...},
  "wall_saved_at": time.time(),
}
```

## 原子性保存

1. 将负载写入目标同一目录中的唯一临时文件。
2. 使用 `os.replace(tmp, target)` 进行原子性交换。
3. 绝不直接写入目标文件名。

## 分片布局

- `model.shard-NNN.pt` 每个分片，按键轮询或按参数组分割。
- `meta.pt` 携带优化器、调度器、训练状态、RNG 和分片清单。
- `index.json` 携带每个分片和 `meta.pt` 的 `sha256`。
- 加载器在合并前验证每个哈希值。

## Epoch 中间恢复

- 将 `(epoch, batch_in_epoch)` 保存在 `step` 旁边。
- 在恢复的 epoch 的第一个批量之前恢复 RNG 状态。
- 快进生成器跳过已消费的批量。

## 故障模式

- 跨设备重命名：非原子性，丢失前一个文件。将临时文件放在同一目录中。
- 忘记 RNG：恢复的损失偏离基线。运行演示的断言。
- 忘记优化器状态：下一步骤剧烈变化。同样的差异会爆炸。
- 剪枝错误的检查点：保留最后 K 个加最佳的一个。
