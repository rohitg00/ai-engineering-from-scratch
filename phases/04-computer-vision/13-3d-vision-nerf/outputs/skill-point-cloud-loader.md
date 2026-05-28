---
name: skill-point-cloud-loader
description: 正しいnormalisation、centring、point samplingを備えた.ply / .pcd / .xyzファイル用PyTorch Datasetを書く
version: 1.0.0
phase: 4
lesson: 13
tags: [3d-vision, point-cloud, data-loading, pytorch]
---

# Point Cloud Loader

3D scanファイルのフォルダを、すぐ学習に使えるPyTorch `Dataset` に変換します。

## 使う場面

- 新しいpoint-cloud分類 / セグメンテーションprojectを始めるとき。
- `.ply`、`.pcd`、`.xyz` 形式を切り替えるとき。
- エラーなく学習するが収束が悪いモデルをdebugするとき。多くの場合、data loaderのnormalisationが間違っています。

## 入力

- `data_root`: point-cloudファイルのフォルダと、任意のlabel付きCSV。
- `file_format`: ply | pcd | xyz | npy。
- `num_points`: 固定samplingサイズ。通常は1024または2048。
- `augmentation`: none | rotate | jitter | mixup。

## Normalisation方針

本番のpoint-cloud pipelineはすべて次の順に処理します。

1. cloudを **Centre** する: centroidを引く。
2. unit sphereへ **Scale** する: 中心からの最大距離で割る。
3. `num_points` 点を **Sample** する。cloudが多い場合は形状表現を保つため **farthest point sampling**（FPS）を使い、速度重視ならrandom samplingを使う。少ない場合は点を繰り返す。
4. 点の順序を **Shuffle** する（モデルにとって順序は関係ないはずだが、shuffleにより偶然の順序依存を壊せる）。

## 出力テンプレート

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

## レポート

```
[dataset]
  files:          <N>
  format:         <ply|pcd|xyz|npy>
  points_per_sample: <int>
  normalise:      centre + unit sphere
  sampling:       FPS | random
  augmentation:   <list>
```

## ルール

- scalingの前に必ずcentreする。順序を入れ替えると「unit sphere」の意味が変わる。
- 形状タスクではrandom samplingよりFPSを優先する。各点が重要なsegmentationではrandomでも問題ない。
- evaluation中はaugmentationを絶対に使わない。training中だけ使う。
- point cloudファイルにcolourやnormalなどの追加channelがある場合、Datasetはxyzだけでなく `(3 + C, num_points)` tensorを返すように拡張する。
