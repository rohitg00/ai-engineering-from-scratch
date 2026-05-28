---
name: skill-mot-evaluator
description: ground-truth tracks に対する MOTA / IDF1 / HOTA の complete evaluation harness を書く
version: 1.0.0
phase: 4
lesson: 27
tags: [mot, evaluation, tracking, metrics]
---

# MOT Evaluator

tracker output を標準の MOTA/IDF1/HOTA pipeline に包み、公平に literature と比較できるようにする。

## 使用する場面

- MOT17 / MOT20 / DanceTrack / SportsMOT で new tracker を benchmark するとき。
- 自分の footage で ByteTrack、BoT-SORT、SAM 2 を比較するとき。
- paper や PR description のために reproducible number を出すとき。

## 入力

- `predictions`: frame ごとの `(track_id, x, y, w, h, confidence)` tuples の list。
- `ground_truth`: frame ごとの `(gt_id, x, y, w, h)` tuples の list。
- `iou_threshold`: MOTA では 0.5 が typical。HOTA は sweep を使う。
- `evaluator`: `py-motmetrics` (MOTA、IDF1) または `TrackEval` (HOTA)。

## output format contract

`py-motmetrics` と `TrackEval` はどちらも特定の on-disk format を期待する。

```
# predictions.txt
<frame>,<track_id>,<x>,<y>,<w>,<h>,<confidence>,-1,-1,-1

# ground_truth.txt
<frame>,<gt_id>,<x>,<y>,<w>,<h>,1,-1,-1,-1
```

frames は 1-indexed、boxes は (x1, y1, x2, y2) ではなく (x, y, w, h) である。integration bug の多くは conversion にある。

## 手順

1. tracker output を MOT Challenge text format に変換する。
2. 両方の file に対して `py-motmetrics.io.loadtxt` を実行する。
3. `mm.metrics.create().compute()` で MOTA + IDF1 を計算する。
4. HOTA については、同じ files と `Metrics: HOTA` で `TrackEval` を呼び出す。
5. dashboard 用に results を JSON として保存する。

## implementation sketch

```python
import motmetrics as mm

def evaluate_mota_idf1(pred_path, gt_path):
    gt = mm.io.loadtxt(gt_path, fmt="mot15-2D")
    pred = mm.io.loadtxt(pred_path, fmt="mot15-2D")
    acc = mm.utils.compare_to_groundtruth(gt, pred, dist="iou", distth=0.5)
    metrics = mm.metrics.create().compute(
        acc, metrics=["num_frames", "mota", "motp", "idf1", "idp", "idr", "num_switches"]
    )
    return metrics


def write_mot_txt(predictions, path):
    with open(path, "w") as f:
        for frame_idx, detections in enumerate(predictions, start=1):
            for tid, x, y, w, h, conf in detections:
                f.write(f"{frame_idx},{tid},{x:.2f},{y:.2f},{w:.2f},{h:.2f},{conf:.3f},-1,-1,-1\n")
```

## report

```
[mot evaluation]
  frames:     <int>
  gt tracks:  <int>
  pred tracks: <int>

[metrics]
  MOTA:       <float>
  MOTP:       <float>
  IDF1:       <float>
  IDP/IDR:    <float/float>
  ID switches: <int>
  HOTA:       <float>  (from TrackEval)
```

## ルール

- output text file では必ず 1-indexed frames を使う。MOT tooling はこれを期待する。
- 書き出す前に (x1, y1, x2, y2) を (x, y, w, h) に変換する。
- modern comparisons で MOTA だけを report しない。IDF1 と HOTA を含める。
- MOT17 の private vs public detections に注意する。別々に評価され、混ぜると score が inflate する。
- per-sequence scores を log する。aggregate は単一の difficult sequence での failure を隠す。
