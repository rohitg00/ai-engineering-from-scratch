---
name: skill-mot-evaluator
description: Write a complete evaluation harness for MOTA / IDF1 / HOTA against ground-truth tracks
version: 1.0.0
phase: 4
lesson: 27
tags: [mot, evaluation, tracking, metrics]
---

# MOT Evaluator

Wrap your tracker's output into the standard MOTA/IDF1/HOTA pipeline so you can compare fairly against the literature.

## When to use

- Benchmarking a new tracker on MOT17 / MOT20 / DanceTrack / SportsMOT.
- Comparing ByteTrack to BoT-SORT to SAM 2 on your own footage.
- Producing a reproducible number for a paper or a PR description.

## Inputs

- `predictions`: list per frame of `(track_id, x, y, w, h, confidence)` tuples.
- `ground_truth`: list per frame of `(gt_id, x, y, w, h)` tuples.
- `iou_threshold`: 0.5 typical for MOTA; HOTA uses a sweep.
- `evaluator`: `py-motmetrics` (MOTA, IDF1) or `TrackEval` (HOTA).

## Output format contract

Both `py-motmetrics` and `TrackEval` expect a specific on-disk format:

```
# predictions.txt
<frame>,<track_id>,<x>,<y>,<w>,<h>,<confidence>,-1,-1,-1

# ground_truth.txt
<frame>,<gt_id>,<x>,<y>,<w>,<h>,1,-1,-1,-1
```

Frames are 1-indexed, boxes are (x, y, w, h), not (x1, y1, x2, y2). Conversion is where most integration bugs live.

## Steps

1. Convert your tracker's output to MOT Challenge text format.
2. Run `py-motmetrics.io.loadtxt` on both files.
3. Compute MOTA + IDF1 with `mm.metrics.create().compute()`.
4. For HOTA, invoke `TrackEval` with the same files and `Metrics: HOTA`.
5. Save results as JSON for dashboards.

## Implementation sketch

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

## Report

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

## Rules

- Always use 1-indexed frames in the output text file; MOT tooling expects this.
- Convert (x1, y1, x2, y2) to (x, y, w, h) before writing.
- Do not report MOTA alone for modern comparisons; include IDF1 and HOTA.
- Watch for private vs public detections on MOT17 — they are evaluated separately and mixing them inflates scores.
- Log per-sequence scores; aggregate hides failures on single difficult sequences.
