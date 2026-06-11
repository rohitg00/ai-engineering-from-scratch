---
name: skill-heatmap-to-coords
description: 从热图提取坐标
version: 1.0.0
phase: 4
lesson: 21
tags: [pose, heatmap, keypoints]
---

# 热图到坐标转换

## 方法

### argmax
```python
coords = heatmaps.argmax(dim=-1)  # 简单但量化误差大
```

### soft-argmax
```python
def soft_argmax(heatmaps):
    """
    heatmaps: (B, K, H, W)
    """
    B, K, H, W = heatmaps.shape
    
    # 归一化
    heatmaps = F.softmax(heatmaps.view(B, K, -1), dim=-1)
    
    # 创建坐标网格
    y_coords = torch.arange(H, device=heatmaps.device).float()
    x_coords = torch.arange(W, device=heatmaps.device).float()
    
    # 计算期望坐标
    y = (heatmaps.view(B, K, H, W).sum(dim=3) * y_coords).sum(dim=2)
    x = (heatmaps.view(B, K, H, W).sum(dim=2) * x_coords).sum(dim=2)
    
    return torch.stack([x, y], dim=-1)
```

### 分布感知坐标
```python
def integral_coords(heatmaps):
    """DSNT方法"""
    heatmaps = F.softmax(heatmaps.flatten(-2), dim=-1).view_as(heatmaps)
    
    # 使用积分计算精确坐标
    y = torch.linspace(-1, 1, heatmaps.size(-2), device=heatmaps.device)
    x = torch.linspace(-1, 1, heatmaps.size(-1), device=heatmaps.device)
    
    coords_x = (heatmaps.sum(-2) * x).sum(-1)
    coords_y = (heatmaps.sum(-1) * y).sum(-1)
    
    return torch.stack([coords_x, coords_y], dim=-1)
```
