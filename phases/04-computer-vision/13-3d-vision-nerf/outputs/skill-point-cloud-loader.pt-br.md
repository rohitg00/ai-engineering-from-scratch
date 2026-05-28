---
name: skill-point-cloud-loader
description: Escreva um Dataset PyTorch pra arquivos .ply / .pcd / .xyz com normalização, centralização e amostragem de pontos corretas
version: 1.0.0
phase: 4
lesson: 13
tags: ['3d-vision', 'point-cloud', 'data-loading', 'pytorch']
---


# Loader de Point Cloud

Transforme uma pasta de arquivos de scan 3D em um `Dataset` PyTorch pronto pra treino.

## Quando usar

- Começando um novo projeto de classificação / segmentação de point cloud.
- Trocando entre formatos `.ply`, `.pcd` e `.xyz`.
- Debugando um modelo que treina sem erro mas converge mal; geralmente a normalização do data loader está errada.

## Entradas

- `data_root`: pasta de arquivos de point cloud e um CSV opcional com labels.
- `file_format`: ply | pcd | xyz | npy.
- `num_points`: tamanho fixo de amostragem, tipicamente 1024 ou 2048.
- `augmentation`: none | rotate | jitter | mixup.

## Política de normalização

Toda pipeline de point cloud em produção aplica na ordem:

1. **Centre** the cloud: subtract the centroid.
2. **Scale** to unit sphere: divide by the max distance from centre.
3. **Sample** `num_points` points. If the cloud has more, use **farthest point sampling** (FPS) for faithful shape representation or random sampling for speed. If fewer, repeat points.
4. **Shuffle** point order (order should not matter for the model anyway, but shuffling breaks accidental order dependencies).

## Template de saída

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

## Relatório

```
[dataset]
  files:          <N>
  format:         <ply|pcd|xyz|npy>
  points_per_sample: <int>
  normalise:      centre + unit sphere
  sampling:       FPS | random
  augmentation:   <list>
```

## Regras

- Sempre centralize antes de escalar; trocar a ordem muda o significado de "esfera unitária".
- Prefira FPS sobre amostragem aleatória pra tarefas de forma; aleatório é ok pra segmentação onde cada ponto importa.
- Nunca faça augmentação durante avaliação; apenas durante treinamento.
- Se os arquivos de point cloud incluem cor ou normais como canais extras, estenda o Dataset pra retornar um tensor `(3 + C, num_points)`, não só xyz.
