---
name: skill-noise-schedule-designer
description: 设计扩散模型的噪声调度
version: 1.0.0
phase: 4
lesson: 10
tags: [diffusion, noise-schedule, generation]
---

# 噪声调度设计器

## 常见调度类型

### 线性调度
```python
# beta从0.0001到0.02线性增长
betas = torch.linspace(0.0001, 0.02, timesteps)
```

### 余弦调度
```python
# 更平滑的调度，在两端变化较慢
def cosine_schedule(timesteps, s=0.008):
    steps = timesteps + 1
    x = torch.linspace(0, timesteps, steps)
    alphas_cumprod = torch.cos(((x / timesteps) + s) / (1 + s) * torch.pi * 0.5) ** 2
    alphas_cumprod = alphas_cumprod / alphas_cumprod[0]
    betas = 1 - (alphas_cumprod[1:] / alphas_cumprod[:-1])
    return torch.clip(betas, 0.0001, 0.9999)
```

### sigmoid调度
```python
def sigmoid_schedule(timesteps, start=-3, end=3, tau=1.0):
    timesteps = torch.linspace(start, end, timesteps)
    v_start = torch.tensor(start / tau).sigmoid()
    v_end = torch.tensor(end / tau).sigmoid()
    alphas_cumprod = (-timesteps / tau).sigmoid()
    alphas_cumprod = (alphas_cumprod - v_start) / (v_end - v_start)
    return 1 - (alphas_cumprod[1:] / alphas_cumprod[:-1])
```

## 选择建议

| 场景 | 推荐调度 |
|------|---------|
| 标准图像生成 | 余弦调度 |
| 高分辨率图像 | 线性调度（更稳定） |
| 视频生成 | 余弦调度 |
| 音频生成 | sigmoid调度 |
