---
name: skill-rectified-flow-trainer
description: 编写完整的整流流训练循环，包含 AdaLN DiT 和欧拉采样
version: 1.0.0
phase: 4
lesson: 23
tags: [diffusion, rectified-flow, DiT, training]
---

# 整流流训练器

生成一个干净、极简的训练循环，能够在任意图像张量数据集上成功训练一个小型 DiT 整流流模型。

## 使用时机

- 在小规模上复现 SD3 / FLUX 的训练目标。
- 在同一数据上基准测试整流流 vs DDPM。
- 为非标准领域（医疗、卫星）构建自定义整流流模型。

## 输入

- `model`：接收 `(x, t)` 并返回预测速度的 `nn.Module`。
- `dataset`：模型领域内干净图像的可迭代对象。
- `optimizer`：AdamW，`lr=1e-4`，`weight_decay=0.01`，`betas=(0.9, 0.99)`。
- `scheduler`：带预热的余弦退火，默认 1000 预热步。

## 训练步骤

```python
def rectified_flow_train_step(model, x0, optimizer, device):
    model.train()
    x0 = x0.to(device)
    n = x0.size(0)
    t = torch.rand(n, device=device)                     # 在 [0, 1] 上均匀分布
    epsilon = torch.randn_like(x0)
    x_t = (1 - t[:, None, None, None]) * x0 + t[:, None, None, None] * epsilon
    target_v = epsilon - x0                              # 速度目标
    pred_v = model(x_t, t)
    loss = F.mse_loss(pred_v, target_v)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    return loss.item()
```

## 采样（欧拉）

```python
@torch.no_grad()
def sample(model, shape, steps=20, device="cpu"):
    model.eval()
    x = torch.randn(shape, device=device)
    dt = 1.0 / steps
    t = torch.ones(shape[0], device=device)
    for _ in range(steps):
        v = model(x, t)
        x = x - dt * v
        t = t - dt
    return x
```

## 提示

- 使用 `torch.rand` 均匀分布 `t`；logit-normal 或 Sd3 风格的加权 `t` 采样略有帮助，但不是起步所必需的。
- 模型权重的 EMA 是标准做法；保持 `ema_model`，衰减系数 0.9999。
- 条件模型的无分类器引导：训练期间以 10% 的概率用空/零嵌入替换条件；推理时使用 `v_uncond + w * (v_cond - v_uncond)` 混合，`w` 约 3-5。
- 对于 LDM 风格训练（FLUX、SD3），整个循环在 VAE 潜空间中运行；上面的干净 `x0` 实际上是 `VAE.encode(image)`。
- 在 32x32 玩具数据集上的典型收敛：2000-5000 步。在真实的潜在 SD3 训练上：几十万步。

## 报告

```
[rectified flow training]
  steps:        <整数>
  final loss:   <浮点数>
  ema decay:    <浮点数>
  vae?:         yes | no
  cfg dropout:  <比例>

[sampling]
  default steps: 20
  schnell / turbo target: 4
  full quality reference: 50+（仅用于比较）
```

## 规则

- 绝不要使用 RGB `uint8` 数据上的图像空间速度目标来训练整流流；先归一化为零均值、单位方差。
- 始终按时间步桶记录训练损失；如果早期时间步（接近 0）的损失高于后期（接近 1），则速度参数化可能配置错误。
- 不要在同一个训练循环中混合整流流速度目标和 DDPM 噪声目标；选择其中一个。
- 在 Ampere+ GPU 上使用 bfloat16 训练；由于速度幅度较大，float16 有时会在整流流中产生 NaN 梯度。
