---
name: skill-heatmap-to-coords
description: Write the sub-pixel heatmap-to-coordinate routine used by every production pose model
version: 1.0.0
phase: 4
lesson: 21
tags: [keypoint, pose, subpixel, inference]
---

# Heatmap to Coords

生の keypoint heatmaps を sub-pixel 精度の座標に変換する。あらゆる pose pipeline で最も安価な accuracy upgrade である。

## 使う場面

- heatmap-based keypoint model を deploy するとき。
- pose metrics を benchmark するとき。OKS は sub-pixel accuracy に非常に敏感である。
- pose code をある framework から別の framework へ移植するとき。

## 入力

- `heatmaps`: `(N, K, H, W)` tensor。model からの keypoint ごとの heatmaps。
- `confidence_threshold`: peak がこの値を下回る keypoint を破棄する。

## 手順

1. 各 heatmap に **Argmax** を適用して integer peak location を見つける。
2. **First-difference offset** — 近傍 pixel から sub-pixel offset を推定する。`0.25` coefficient は `sigma >= 1` の Gaussian heatmaps に合わせた heuristic である。より原理的な sub-pixel recovery には、full quadratic fit (DARK) または Gaussian fit を使う。

```
dx = 0.25 * sign(heatmap[y, x+1] - heatmap[y, x-1])
dy = 0.25 * sign(heatmap[y+1, x] - heatmap[y-1, x])
```

DARK / quadratic variant では、local quadratic を使って近似する。

```
dx = -0.5 * (heatmap[y, x+1] - heatmap[y, x-1])
        / (heatmap[y, x+1] - 2 * heatmap[y, x] + heatmap[y, x-1] + eps)
```

Quadratic fit は peak の鋭い heatmap でより正確である。sign-based offset は heatmap が noisy な場合のより安全な default である。

3. integer peak に **offset を加える**。
4. **Confidence** — keypoint ごとに peak value を返す。client はこれを使って low-confidence predictions を mask する。
5. **Boundary case** — peak が axis 上の最初または最後の pixel に落ちた場合、近傍の一方は clamp される。offset は zero に潰れるが、これが最も安全な fallback である。

## 出力テンプレート

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

## レポート

```
[subpixel decode]
  keypoints:   K
  threshold:   <float>
  valid_rate:  fraction of keypoints above threshold
```

## ルール

- neighbour indices は必ず valid range に clamp する。edge 外の keypoint は zero-difference offset になるが crash しない。
- client が low-confidence points を mask できるよう、coordinates と一緒に confidence を返す。
- Sub-pixel refinement が効くのは、heatmap が peak 周辺で smooth な場合だけである。training が sigma >= 1 の Gaussian target を使っていることを確認する。
- 非常に小さな heatmap resolutions (< 48x48) では、coordinate を抽出する前に heatmap を full image size へ upsample することを検討する。sub-pixel offset は stride に合わせて scale する。
