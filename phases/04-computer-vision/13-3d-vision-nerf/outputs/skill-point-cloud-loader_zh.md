---
name: skill-point-cloud-loader
description: 为 .ply / .pcd / .xyz 文件编写 PyTorch Dataset，包含正确的归一化、居中和点采样
version: 1.0.0
phase: 4
lesson: 13
tags: [3d-vision, point-cloud, data-loading, pytorch]
---

# 点云加载器

将 3D 扫描文件的文件夹转换为可直接训练的 PyTorch `Dataset`。

## 使用时机

- 开始新的点云分类/分割项目。
- 在 `.ply`、`.pcd` 和 `.xyz` 格式之间切换。
- 调试训练无错误但收敛不佳的模型；数据加载器的归一化常常是问题所在。

## 输入

- `data_root`：点云文件文件夹及可选的包含标签的 CSV。
- `file_format`：ply | pcd | xyz | npy。
- `num_points`：固定采样数，通常为 1024 或 2048。
- `augmentation`：none（无） | rotate（旋转） | jitter（抖动） | mixup。

## 归一化策略

每个生产级点云流水线按顺序应用：

1. **居中**点云：减去质心。
2. **缩放到**单位球体：除以距中心的最大距离。
3. **采样** `num_points` 个点。如果点云有更多点，使用 **最远点采样（FPS）** 以忠实表示形状，或随机采样以加快速度。如果点数更少，则重复点。
4. **打乱**点顺序（顺序对模型而言本应无关紧要，但打乱可打破意外的顺序依赖关系）。

## 输出模板

```python
import numpy as np
import torch
from torch.utils.data import Dataset

try:
    import open3d as o3d
    HAS_O3D = True
except ImportError:
    HAS_O3D = False

def _read_ply(path):
    if HAS_O3D:
        pc = o3d.io.read_point_cloud(path)
        return np.asarray(pc.points, dtype=np.float32)
    # 回退：最简 ascii-ply 读取器
    ...

def _fps(points, k):
    idx = np.zeros(k, dtype=np.int64)
    dist = np.full(len(points), np.inf)
    seed = np.random.randint(len(points))
    idx[0] = seed
    for i in range(1, k):
        dist = np.minimum(dist, ((points - points[idx[i-1]]) ** 2).sum(axis=1))
        idx[i] = int(np.argmax(dist))
    return idx

def normalise(points):
    centre = points.mean(axis=0)
    points = points - centre
    scale = np.max(np.linalg.norm(points, axis=1))
    return points / max(scale, 1e-8)

class PointCloudDataset(Dataset):
    def __init__(self, files, labels, num_points=1024, augment=False):
        self.files = files
        self.labels = labels
        self.num_points = num_points
        self.augment = augment

    def __len__(self):
        return len(self.files)

    def __getitem__(self, i):
        pts = _read_ply(self.files[i])
        pts = normalise(pts)
        if len(pts) >= self.num_points:
            idx = _fps(pts, self.num_points)
            pts = pts[idx]
        else:
            reps = int(np.ceil(self.num_points / len(pts)))
            pts = np.tile(pts, (reps, 1))[:self.num_points]
        # 打乱点顺序以打破任何意外依赖关系（平铺以确定顺序重复点时尤为重要）。
        np.random.shuffle(pts)
        if self.augment:
            theta = np.random.uniform(0, 2 * np.pi)
            R = np.array([[np.cos(theta), 0, np.sin(theta)],
                          [0, 1, 0],
                          [-np.sin(theta), 0, np.cos(theta)]], dtype=np.float32)
            pts = pts @ R
            pts = pts + np.random.normal(0, 0.02, pts.shape).astype(np.float32)
        pts = np.ascontiguousarray(pts, dtype=np.float32)
        return torch.from_numpy(pts).transpose(0, 1), int(self.labels[i])
```

## 报告

```
[dataset]
  files:          <N>
  format:         <ply|pcd|xyz|npy>
  points_per_sample: <整数>
  normalise:      centre + unit sphere（居中 + 单位球体）
  sampling:       FPS | random（随机）
  augmentation:   <列表>
```

## 规则

- 始终先居中再缩放；交换顺序会改变"单位球体"的含义。
- 对于形状任务，优先选择 FPS 而非随机采样；对于分割任务，每个点都很重要，随机采样也可以。
- 评估期间绝不进行数据增强；仅在训练期间进行。
- 如果点云文件包含颜色或法线等其他通道，扩展 Dataset 返回 `(3 + C, num_points)` 张量，而不仅仅是 xyz。
