---
name: skill-depth-to-pointcloud
description: 正しい intrinsics handling と .ply export を使って depth maps から point clouds を構築する
version: 1.0.0
phase: 4
lesson: 26
tags: [depth, point-cloud, 3d, intrinsics]
---

# Depth to Point Cloud

depth map と colour image を textured point cloud に変換し、visualisation や追加の 3D work のために export できるようにする。

## 使用する場面

- depth predictions を実際の 3D scene として visualise するとき。
- single image から sparse 3D reconstruction を bootstrapping するとき。
- SfM が失敗する場合に 3DGS training 用 input を作るとき。
- predicted depth を LiDAR ground truth と比較するとき。

## 入力

- `depth`: output で使いたい単位の depths を持つ `(H, W)` numpy array (metres 推奨)。
- `rgb`: colours を持つ `(H, W, 3)` numpy array (uint8 または float32 [0, 1])。
- `intrinsics`: pixel units の `(fx, fy, cx, cy)`。
- Optional `depth_scale`: predicted depth units を metres に変換する multiplier。

## pipeline

1. **Validate** — include する予定の場所では depth が positive かつ finite でなければならない。invalid pixels を mask out する。
2. **Lift** — pixel ごとに `X = (u - cx) * d / fx`、`Y = (v - cy) * d / fy`、`Z = d`。
3. **Pair** with RGB — 各 3D point は対応する pixel から `(r, g, b)` triple を受け取る。
4. **Export** — PLY (portable)、`.xyz` (lightweight)、`.pcd` (Open3D-native)、`.las`/`.laz` (geospatial)。

## implementation template

```python
import numpy as np

def depth_to_point_cloud(depth, intrinsics, depth_scale=1.0, min_depth=0.1, max_depth=100.0):
    H, W = depth.shape
    fx, fy, cx, cy = intrinsics
    v, u = np.meshgrid(np.arange(H), np.arange(W), indexing="ij")
    z = depth.astype(np.float32) * depth_scale
    valid = (z > min_depth) & (z < max_depth) & np.isfinite(z)
    x = (u - cx) * z / fx
    y = (v - cy) * z / fy
    points = np.stack([x, y, z], axis=-1)
    return points, valid


def write_ply(path, points, colors=None, valid_mask=None):
    p = points.reshape(-1, 3)
    if valid_mask is not None:
        p = p[valid_mask.flatten()]
    lines = [
        "ply",
        "format ascii 1.0",
        f"element vertex {p.shape[0]}",
        "property float x", "property float y", "property float z",
    ]
    if colors is not None:
        c = colors.reshape(-1, 3).astype(np.uint8)
        if valid_mask is not None:
            c = c[valid_mask.flatten()]
        lines += ["property uchar red", "property uchar green", "property uchar blue"]
    lines.append("end_header")
    with open(path, "w") as f:
        f.write("\n".join(lines) + "\n")
        if colors is not None:
            for pt, col in zip(p, c):
                f.write(f"{pt[0]:.4f} {pt[1]:.4f} {pt[2]:.4f} {col[0]} {col[1]} {col[2]}\n")
        else:
            for pt in p:
                f.write(f"{pt[0]:.4f} {pt[1]:.4f} {pt[2]:.4f}\n")
```

## report

```
[export]
  input depth shape:  (H, W)
  valid points:       <N> of <H*W>
  output format:      ply | xyz | pcd | las
  coordinate system:  camera (+X right, +Y down, +Z forward)
  scale:              metres | millimetres | normalised
```

## ルール

- invalid depth (zero、NaN、inf、saturated) を必ず mask する。含めると origin 付近に garbage points の cloud ができる。
- relative-depth model からの prediction では、metric として export しない。convention が分かるよう output filename に `relative_` prefix を付ける。
- camera coordinate convention を一貫させる (OpenCV: +X right、+Y down、+Z forward)。downstream tool が OpenGL (+Y up) を想定する場合は sign を入れ替える。
- dense scenes (> 1M points) では subsample parameter を用意する。500 MB を超える PLY files はどこでも扱いづらい。
- 「reasonable」な output を作るために silently clip しない。discard された内容が user に分かるよう、warned thresholds で明示的に clip する。
