---
name: skill-physical-plausibility-checks
description: 检查视频生成的物理合理性
version: 1.0.0
phase: 4
lesson: 28
tags: [video, physics, quality-check]
---

# 物理合理性检查器

## 检查项

### 时序一致性
- [ ] 物体颜色/纹理是否突变？
- [ ] 物体大小是否合理变化？
- [ ] 光照是否一致？

### 物理规律
- [ ] 重力是否合理？
- [ ] 碰撞是否自然？
- [ ] 流体运动是否真实？

### 几何一致性
- [ ] 透视是否正确？
- [ ] 遮挡关系是否合理？
- [ ] 深度关系是否一致？

## 自动检测

```python
def check_temporal_consistency(frames):
    """检查相邻帧一致性"""
    diffs = []
    for i in range(len(frames)-1):
        diff = F.mse_loss(frames[i], frames[i+1])
        diffs.append(diff.item())
    
    # 突变检测
    mean_diff = np.mean(diffs)
    for i, diff in enumerate(diffs):
        if diff > mean_diff * 5:
            print(f"帧 {i}-{i+1} 可能不一致")
    
    return diffs
```
