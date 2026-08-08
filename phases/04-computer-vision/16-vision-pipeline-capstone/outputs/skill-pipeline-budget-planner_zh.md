---
name: skill-pipeline-budget-planner
description: 规划视觉流水线的计算预算
version: 1.0.0
phase: 4
lesson: 16
tags: [pipeline, budget, optimization]
---

# 流水线预算规划器

## 计算预算分配

### 典型视觉流水线

```
输入预处理 (5%) → 特征提取 (60%) → 后处理 (10%) → 输出格式化 (5%)
                                    ↓
                              可选：NMS/过滤 (20%)
```

## 优化策略

### 减少预处理开销
- 使用硬件加速解码
- 批量预处理
- 缓存常用变换

### 优化特征提取
- 选择轻量级骨干
- 使用TensorRT/ONNX
- 量化到INT8

### 加速后处理
- 向量化NMS
- 使用GPU排序
- 提前退出低置信度

## 预算检查清单

- [ ] 每帧总延迟 < 目标FPS
- [ ] 内存使用 < 可用显存
- [ ] 功耗 < 设备限制
- [ ] 精度损失 < 可接受阈值
