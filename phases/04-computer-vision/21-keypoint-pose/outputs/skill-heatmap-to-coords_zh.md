---
name: skill-heatmap-to-coords
description: 编写每个生产级姿态模型使用的亚像素热图到坐标转换程序
version: 1.0.0
phase: 4
lesson: 21
tags: [keypoint, pose, subpixel, inference]
---

# 热图到坐标转换

将原始关键点热图转换为亚像素精度的坐标。每个姿态流水线中最廉价的准确率升级。

## 使用时机

- 部署基于热图的关键点模型。
- 基准测试姿态指标——OKS 对亚像素精度极其敏感。
- 将姿态代码从一个框架移植到另一个框架。

## 输入

- `heatmaps`：`(N, K, H, W)` 张量，来自模型的每个关键点热图。
- `confidence_threshold`：丢弃峰值低于此值的关键点。

## 步骤

1. **Argmax** 每个热图以找到整数峰值位置。
2. **一阶差分偏移**——从相邻像素估计亚像素偏移。`0.25` 系数是针对 `sigma >= 1` 的高斯热图校准的启发式值；对于原理性亚像素恢复，使用完整的二次拟合（DARK）或高斯拟合。

```
dx = 0.25 * sign(heatmap[y, x+1] - heatmap[y, x-1])
dy = 0.25 * sign(heatmap[y+1, x] - heatmap[y-1, x])
```

对于 DARK / 二次变体，使用局部二次函数近似：

```
dx = -0.5 * (heatmap[y, x+1] - heatmap[y, x-1])
        / (heatmap[y, x+1] - 2 * heatmap[y, x] + heatmap[y, x-1] + eps)
```

二次拟合在峰值热图上更准确；基于符号的偏移是热图有噪声时更安全的默认选择。

3. **添加偏移**到整数峰值。
4. **置信度**——返回每个关键点的峰值；客户端使用它来屏蔽低置信度预测。
5. **边界情况**——当峰值落在某轴的第一或最后一个像素上时，相邻像素被限制；偏移降为零，这是最安全的回退。

## 输出模板

```python
import torch

def heatmap_to_coords_subpixel(heatmaps, threshold=0.2):
    N, K, H, W = heatmaps.shape
    flat = heatmaps.reshape(N, K, -1)
    conf, idx = flat.max(dim=-1)
    ys = (idx // W).float()
    xs = (idx % W).float()

    ys_int = ys.long()
    xs_int = xs.long()

    x_minus = (xs_int - 1).clamp(min=0)
    x_plus = (xs_int + 1).clamp(max=W - 1)
    y_minus = (ys_int - 1).clamp(min=0)
    y_plus = (ys_int + 1).clamp(max=H - 1)

    batch_idx = torch.arange(N).view(-1, 1).expand(-1, K)
    kp_idx = torch.arange(K).view(1, -1).expand(N, -1)

    dx_raw = (heatmaps[batch_idx, kp_idx, ys_int, x_plus]
              - heatmaps[batch_idx, kp_idx, ys_int, x_minus])
    dy_raw = (heatmaps[batch_idx, kp_idx, y_plus, xs_int]
              - heatmaps[batch_idx, kp_idx, y_minus, xs_int])
    dx = 0.25 * torch.sign(dx_raw)
    dy = 0.25 * torch.sign(dy_raw)

    at_left = xs_int == 0
    at_right = xs_int == (W - 1)
    at_top = ys_int == 0
    at_bottom = ys_int == (H - 1)
    dx = torch.where(at_left | at_right, torch.zeros_like(dx), dx)
    dy = torch.where(at_top | at_bottom, torch.zeros_like(dy), dy)

    refined_x = xs + dx
    refined_y = ys + dy
    coords = torch.stack([refined_x, refined_y], dim=-1)
    mask = conf >= threshold
    return coords, conf, mask
```

## 报告

```
[subpixel decode]
  keypoints:   K
  threshold:   <浮点数>
  valid_rate:  高于阈值的关键点比例
```

## 规则

- 始终将相邻索引限制在有效范围内；边缘关键点具有零差分偏移但不会崩溃。
- 返回置信度以及坐标，以便客户端屏蔽低置信度点。
- 亚像素优化仅在热图在峰值附近平滑时才有帮助——检查训练是否使用了 sigma >= 1 的高斯目标。
- 对于非常小的热图分辨率（< 48x48），考虑在提取坐标之前将热图上采样到完整图像大小；亚像素偏移随步长缩放。
