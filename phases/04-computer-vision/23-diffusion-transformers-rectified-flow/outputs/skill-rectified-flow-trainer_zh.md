---
name: skill-rectified-flow-trainer
description: 训练Rectified Flow模型
version: 1.0.0
phase: 4
lesson: 23
tags: [rectified-flow, diffusion, training]
---

# Rectified Flow训练器

## 原理

Rectified Flow用直线路径替代扩散的曲线路径，更快收敛。

## 训练目标

```python
def rectified_flow_loss(model, x0, t):
    """
    x0: 干净数据
    t: 时间步 (0, 1)
    """
    # 采样噪声
    x1 = torch.randn_like(x0)
    
    # 直线路径插值
    xt = (1 - t) * x0 + t * x1
    
    # 预测速度
    v_pred = model(xt, t)
    
    # 目标速度
    v_target = x1 - x0
    
    # MSE损失
    loss = F.mse_loss(v_pred, v_target)
    return loss
```

## 采样

```python
def sample_rectified_flow(model, shape, num_steps=50):
    x = torch.randn(shape)
    dt = 1.0 / num_steps
    
    for i in range(num_steps):
        t = i * dt
        v = model(x, t)
        x = x + v * dt
    
    return x
```

## 优势

- 更少的采样步数（10-50步）
- 更稳定的训练
- 更好的模式覆盖
