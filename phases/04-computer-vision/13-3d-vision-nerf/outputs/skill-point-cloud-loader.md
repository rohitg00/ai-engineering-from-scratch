---
name: skill-point-cloud-loader
description: Write a PyTorch Dataset for .ply / .pcd / .xyz files with correct normalisation, centring, and point sampling
version: 1.0.0
phase: 4
lesson: 13
tags: [3d-vision, point-cloud, data-loading, pytorch]
---

# Point Cloud Loader

Turn a folder of 3D scan files into a ready-to-train PyTorch `Dataset`.

## When to use

- Starting a new point-cloud classification / segmentation project.
- Switching between `.ply`, `.pcd`, and `.xyz` formats.
- Debugging a model that trains without error but converges poorly; often the data loader normalisation is wrong.

## Inputs

- `data_root`: folder of point-cloud files and an optional CSV with labels.
- `file_format`: ply | pcd | xyz | npy.
- `num_points`: fixed sampling size, typically 1024 or 2048.
- `augmentation`: none | rotate | jitter | mixup.

## Normalisation policy

Every production point-cloud pipeline applies in order:

1. **Centre** the cloud: subtract the centroid.
2. **Scale** to unit sphere: divide by the max distance from centre.
3. **Sample** `num_points` points. If the cloud has more, use **farthest point sampling** (FPS) for faithful shape representation or random sampling for speed. If fewer, repeat points.
4. **Shuffle** point order (order should not matter for the model anyway, but shuffling breaks accidental order dependencies).

## Output template

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
    # Fallback: minimal ascii-ply reader
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
        # Shuffle point order to break any accidental dependencies (especially
        # important when tiling repeats points in deterministic order).
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

## Report

```
[dataset]
  files:          <N>
  format:         <ply|pcd|xyz|npy>
  points_per_sample: <int>
  normalise:      centre + unit sphere
  sampling:       FPS | random
  augmentation:   <list>
```

## Rules

- Always centre before scaling; swapping the order changes the meaning of "unit sphere".
- Prefer FPS over random sampling for shape tasks; random is fine for segmentation where every point matters anyway.
- Never augment during evaluation; only during training.
- If point cloud files include colour or normals as extra channels, extend the Dataset to return a `(3 + C, num_points)` tensor, not just xyz.
