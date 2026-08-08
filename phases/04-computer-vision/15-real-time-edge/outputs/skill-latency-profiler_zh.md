---
name: skill-latency-profiler
description: 分析模型推理延迟
version: 1.0.0
phase: 4
lesson: 15
tags: [edge, latency, profiling]
---

# 延迟分析器

## 测量方法

```python
import torch
import time

# 预热
for _ in range(10):
    _ = model(input_tensor)

# 测量
times = []
for _ in range(100):
    start = time.time()
    _ = model(input_tensor)
    torch.cuda.synchronize()  # 等待GPU完成
    times.append(time.time() - start)

print(f"平均延迟: {np.mean(times)*1000:.2f}ms")
print(f"P99延迟: {np.percentile(times, 99)*1000:.2f}ms")
```

## 瓶颈分析

| 瓶颈 | 症状 | 修复 |
|------|------|------|
| 内存带宽 | 大特征图 | 减少通道数 |
| 计算 | 高FLOPs | 使用深度可分离卷积 |
| 启动开销 | 小批次 | 增大批大小 |
| 数据加载 | CPU占用高 | 使用异步加载 |

## 目标延迟

| 应用 | 目标延迟 |
|------|---------|
| 实时视频 | < 33ms (30FPS) |
| 交互式 | < 100ms |
| 后台处理 | < 1s |
