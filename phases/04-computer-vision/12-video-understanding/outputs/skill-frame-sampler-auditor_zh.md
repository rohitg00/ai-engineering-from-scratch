---
name: skill-frame-sampler-auditor
description: 审计视频帧采样策略
version: 1.0.0
phase: 4
lesson: 12
tags: [video, sampling, frames]
---

# 帧采样审计器

## 采样策略

### 均匀采样
```python
# 从视频中均匀采样N帧
frames = np.linspace(0, total_frames-1, num=N, dtype=int)
```

### 随机采样
```python
# 随机采样N帧
frames = np.random.choice(total_frames, size=N, replace=False)
frames = np.sort(frames)
```

### 密集采样
```python
# 从随机起点采样连续N帧
start = np.random.randint(0, total_frames - N)
frames = range(start, start + N)
```

## 策略对比

| 策略 | 优点 | 缺点 | 适用场景 |
|------|------|------|---------|
| 均匀 | 覆盖整个视频 | 可能错过短时动作 | 分类 |
| 随机 | 数据增强 | 不一致 | 训练 |
| 密集 | 捕获时序信息 | 覆盖范围小 | 动作检测 |

## 检查清单

- [ ] 采样帧数是否足够？
- [ ] 是否覆盖整个视频？
- [ ] 时序顺序是否保留？
- [ ] 预处理是否与图像一致？
