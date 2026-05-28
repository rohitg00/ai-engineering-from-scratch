---
name: skill-anchor-designer
description: ground-truth boxes の dataset から (w, h) に k-means を実行し、FPN level ごとの anchor sets と coverage statistics を返す
version: 1.0.0
phase: 4
lesson: 6
tags: [computer-vision, detection, anchors, kmeans]
---

# Anchor Designer

Anchors は anchor-based detector で最も dataset-specific な hyperparameter です。default COCO anchors は cell-culture images、satellite tiles、small-object surveillance では性能が落ちます。この skill は target data に実際に合う anchors を導出します。

## When to use

- 新しい dataset で最初の training run を始める前。
- otherwise healthy な model で very small objects または very large objects の recall が弱いとき。
- box size distribution が変わった可能性のある大きな dataset expansion の後。

## Inputs

- `boxes`: `(cx, cy, w, h)` または `(x1, y1, x2, y2)` format の shape (N, 4) の numpy array。positive boxes は少なくとも 1000 推奨。
- `num_anchors_per_level`: 通常 3。
- `num_fpn_levels`: 通常 3（P3, P4, P5）または 4。
- `input_size`: training-resolution HxW。
- Optional `strides`: level ごとの strides。省略時は `[8, 16, 32, 64]` の先頭 `num_fpn_levels` entries を使う。detector の FPN が異なる strides を持つ場合は、長さの合う array を明示する。

## Steps

1. **Normalise boxes** を `input_size` における pixel unit の `(w, h)` pairs にする。w または h が 2 pixels 未満のものは落とす。

2. **Run k-means** on `(w, h)` pairs, with `k = num_anchors_per_level * num_fpn_levels`. 距離関数は Euclidean distance ではなく `1 - IoU(box, cluster)` を使う。`(w, h)` への Euclidean は thin tall boxes と square boxes を一緒に潰してしまう。すべての boxes は同じ重みで寄与する。class-imbalanced dataset で larger-box recall を重視したい場合は、weight vector ではなく rare-class boxes を input array 内で繰り返す。

3. **Sort clusters by area** ascending. `num_anchors_per_level` ごとに `num_fpn_levels` groups へ split する。smallest areas は highest-resolution level（smallest stride）へ割り当てる。

4. **Compute coverage statistics** per level:
   - 各 ground-truth box がその level の best anchor に対して持つ `median IoU`。
   - `recall@IoU=0.5` — best anchor の IoU が 0.5 以上の boxes の割合。
   - `area coverage` — box area がその level の `[anchor_min_area / 4, anchor_max_area * 4]` に入る割合。

5. **Report per-level anchors** and flag levels where `recall@IoU=0.5 < 0.9`; その level の anchors は data に合っていないため、retune するか level あたりの anchors 数を増やすべきです。

## Report format

```
[anchor-designer]
  total boxes:         <N>
  clusters:            <k>
  distance metric:     1 - IoU

[level P3  stride=8]
  anchors (w, h):      [(A, B), (C, D), (E, F)]
  median IoU:          <X>
  recall@IoU=0.5:      <X>
  coverage:            <X>
  flag:                ok | retune

[level P4  stride=16]
  ...

[summary]
  overall recall@IoU=0.5: <X>
  smallest anchor:        <w x h>
  largest anchor:         <w x h>
  recommendation:         <one sentence if any level flagged>
```

## Rules

- 必ず IoU-based distance を使う。Euclidean k-means は見た目には妥当でも empirical に劣る anchors を作ります。
- clusters は area で sort し、ascending order で levels に割り当てる。
- `num_anchors_per_level = 1` の場合は k-means を完全に skip する。boxes を area quantile で `num_fpn_levels` bins に分け（3 levels なら terciles など）、各 level の anchor を bin ごとの median (w, h) にする。これは small datasets で `k = num_fpn_levels` の k-means より robust です。
- negative anchor dimensions は出力しない。1 で clamp する。
- dataset が 200 boxes 未満なら、anchor search は unreliable だと warning し、default COCO anchors と追加 training data を推奨する。
