---
name: skill-point-cloud-loader
description: 加载和预处理点云数据
version: 1.0.0
phase: 4
lesson: 13
tags: [3d-vision, point-cloud, preprocessing]
---

# 点云加载器

## 常见格式

| 格式 | 扩展名 | 特点 |
|------|--------|------|
| PLY | .ply | 通用，支持颜色和法线 |
| PCD | .pcd | PCL库标准格式 |
| LAS | .las | 激光雷达标准 |
| OBJ | .obj | 网格+点云 |
| NumPy | .npy | 简单数组 |

## 加载示例

```python
import open3d as o3d
import numpy as np

# 加载PLY文件
pcd = o3d.io.read_point_cloud("point_cloud.ply")
points = np.asarray(pcd.points)
colors = np.asarray(pcd.colors)

# 加载NumPy数组
points = np.load("points.npy")  # (N, 3)
```

## 预处理

### 下采样
```python
# 体素下采样
pcd_down = pcd.voxel_down_sample(voxel_size=0.05)
```

### 去噪
```python
# 统计去噪
pcd_clean, _ = pcd.remove_statistical_outlier(
    nb_neighbors=20, std_ratio=2.0
)
```

### 归一化
```python
# 中心化并缩放
points = points - points.mean(axis=0)
points = points / points.max()
```
