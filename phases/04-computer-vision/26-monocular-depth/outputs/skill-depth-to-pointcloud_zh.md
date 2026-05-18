---
name: skill-depth-to-pointcloud
description: 从深度图生成点云
version: 1.0.0
phase: 4
lesson: 26
tags: [depth, point-cloud, 3d]
---

# 深度到点云转换器

## 原理

利用相机内参将像素坐标和深度转换为3D点。

## 实现

```python
def depth_to_pointcloud(depth, intrinsics):
    """
    depth: (H, W) 深度图
    intrinsics: (3, 3) 相机内参矩阵
    """
    H, W = depth.shape
    
    # 创建像素坐标网格
    u, v = torch.meshgrid(
        torch.arange(W), torch.arange(H), indexing='xy'
    )
    
    # 转换为相机坐标
    fx, fy = intrinsics[0, 0], intrinsics[1, 1]
    cx, cy = intrinsics[0, 2], intrinsics[1, 2]
    
    z = depth
    x = (u - cx) * z / fx
    y = (v - cy) * z / fy
    
    # 堆叠为点云 (H*W, 3)
    points = torch.stack([x, y, z], dim=-1).reshape(-1, 3)
    
    # 过滤无效深度
    valid = (z > 0) & (z < 100)
    points = points[valid.reshape(-1)]
    
    return points
```

## 后处理

- **下采样**：体素网格过滤
- **去噪**：统计异常值移除
- **配准**：多帧点云融合
