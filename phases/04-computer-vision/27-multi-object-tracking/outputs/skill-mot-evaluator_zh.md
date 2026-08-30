---
name: skill-mot-evaluator
description: 评估多目标跟踪性能
version: 1.0.0
phase: 4
lesson: 27
tags: [mot, evaluation, tracking]
---

# MOT评估器

## 指标计算

### MOTA (Multiple Object Tracking Accuracy)
```
MOTA = 1 - (FN + FP + IDS) / GT
```
- FN: 漏检
- FP: 误检
- IDS: 身份切换

### IDF1
```
IDF1 = 2 * IDTP / (2 * IDTP + IDFP + IDFN)
```
- 衡量身份保持能力

### HOTA
```
HOTA = sqrt(DetA * AssA)
```
- 检测和关联的平衡

## 评估工具

```python
from motmetrics import mot

# 创建评估器
acc = mot.MOTAccumulator()

# 添加帧
for frame_id in range(num_frames):
    gt_ids = ground_truth[frame_id]
    pred_ids = predictions[frame_id]
    dist_matrix = compute_distance(gt_boxes, pred_boxes)
    acc.update(gt_ids, pred_ids, dist_matrix)

# 计算指标
mh = mot.metrics.create()
summary = mh.compute(acc, metrics=['mota', 'idf1', 'hota'])
```
