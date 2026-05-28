---
name: skill-segmentation-mask-inspector
description: class distribution、predicted-mask statistics、under-predicted または boundary-blurred の可能性が高い classes を報告する
version: 1.0.0
phase: 4
lesson: 7
tags: [computer-vision, segmentation, debugging, evaluation]
---

# Segmentation Mask Inspector

「loss は下がった」と「masks が実際に正しい」の間にある gap を診断します。

## When to use

- training run の直後、mIoU は良く見えるのに visual inspection では違和感があるとき。
- deployment 前に、predictions と ground truth の class balance を確認するとき。
- per-class IoU が large objects では高いが small ones で低いとき。
- pixel count では小さく IoU に現れにくい boundary artefacts を debugging するとき。

## Inputs

- `preds`: predicted class IDs の (N, H, W) tensor。
- `targets`: ground-truth class IDs の (N, H, W) tensor。
- `num_classes`: integer。
- Optional `class_names`: C strings の list。

## Steps

1. **Class pixel histograms.** `preds` と `targets` について class ごとの pixel percentage を計算する。`|pred% - gt%| / max(gt%, 1e-6) > 0.30`（relative deviation 30% 超）の class を flag する。ground truth に存在しない classes（`gt% == 0`）では、predicted share が `0.3` を超えたら直接 flag する。

2. **IoU per class** and **boundary F1 per class**. Boundary F1 は各 mask を 3 pixels dilate して intersect し scoring する。IoU > 0.7 だが boundary F1 < 0.5 の classes は edges が blurred です。

3. **Small-object recall.** すべての ground-truth connected component を size buckets（tiny < 100 px、small < 1000 px、medium < 10000 px、large >= 10000 px）に分ける。bucket ごと、class ごとの recall を報告する。large-object recall が 0.9 超なのに small-object recall が 0.3 未満なら、resolution / receptive-field problem を示します。

4. **Confusion pairs.** 各 class について、最も混同している class（その ground-truth mask 内で最も多い wrong predicted class）を探す。top 3 pairs を報告する。

5. **Saturation check (requires `probs` or `logits`, not just `preds`).** caller が raw per-pixel probability distribution `probs: (N, C, H, W)` を渡した場合、`probs.max(dim=1) > 0.99` である pixels の割合を class ごとに計算する。高い saturation（class pixels の >0.9）は overconfidence を示し、label smoothing または calibration の候補です。argmax 済みの `preds` しかない場合はこの step を skip し、report にその旨を書く。

## Report format

```
[mask-inspector]
  classes: C

[class distribution]
  name       gt %    pred %   delta
  ...

[metrics]
  class       IoU     bF1    recall_tiny  recall_small  recall_medium  recall_large
  ...

[confusion pairs]
  class A confused with class B: <N> pixels (most common)
  class B confused with class A: <N> pixels
  ...

[verdict]
  most impactful issue: <one sentence>
```

## Rules

- class rows は gt pixel share の descending order で sort し、最も frequent な classes を先に出す。
- IoU < 0.4 または boundary F1 < 0.3 の classes は `critical` として flag する。
- small-object recall が dominant failure の場合、higher-resolution training、last encoder stage の smaller stride、feature-pyramid decoder を推奨する。
- boundary F1 が dominant failure の場合、boundary-aware loss（Lovasz または BoundaryLoss）、horizontal flip の TTA、stride-less decoder を推奨する。
- class indices だけを identifier として出力しない。`class_names` があれば全 row で使う。
