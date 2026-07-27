---
name: skill-mot-evaluator
description: 编写完整的 MOTA / IDF1 / HOTA 评估框架，与地面真值轨迹对比
version: 1.0.0
phase: 4
lesson: 27
tags: [mot, evaluation, tracking, metrics]
---

# MOT 评估器

将你的跟踪器输出包装到标准的 MOTA/IDF1/HOTA 流水线中，以便与文献进行公平比较。

## 使用时机

- 在 MOT17 / MOT20 / DanceTrack / SportsMOT 上基准测试新跟踪器。
- 在自己的视频上比较 ByteTrack、BoT-SORT 和 SAM 2。
- 为论文或 PR 描述生成可重现的指标。

## 输入

- `predictions`：每帧的 `(track_id, x, y, w, h, confidence)` 元组列表。
- `ground_truth`：每帧的 `(gt_id, x, y, w, h)` 元组列表。
- `iou_threshold`：MOTA 通常为 0.5；HOTA 使用扫描方式。
- `evaluator`：`py-motmetrics`（MOTA、IDF1）或 `TrackEval`（HOTA）。

## 输出格式契约

`py-motmetrics` 和 `TrackEval` 都期望特定的磁盘格式：

```
# predictions.txt
<帧号>,<跟踪ID>,<x>,<y>,<w>,<h>,<置信度>,-1,-1,-1

# ground_truth.txt
<帧号>,<地面真值ID>,<x>,<y>,<w>,<h>,1,-1,-1,-1
```

帧从 1 开始索引，框为 (x, y, w, h)，而非 (x1, y1, x2, y2)。转换是大多数集成错误的来源。

## 步骤

1. 将跟踪器的输出转换为 MOT Challenge 文本格式。
2. 在两个文件上运行 `py-motmetrics.io.loadtxt`。
3. 使用 `mm.metrics.create().compute()` 计算 MOTA + IDF1。
4. 对于 HOTA，使用相同文件和 `Metrics: HOTA` 调用 `TrackEval`。
5. 将结果保存为 JSON 用于仪表盘。

## 实现草图

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

## 报告

```
[mot evaluation]
  frames:     <整数>
  gt tracks:  <整数>
  pred tracks: <整数>

[metrics]
  MOTA:       <浮点数>
  MOTP:       <浮点数>
  IDF1:       <浮点数>
  IDP/IDR:    <浮点数/浮点数>
  ID switches: <整数>
  HOTA:       <浮点数>（来自 TrackEval）
```

## 规则

- 在输出的文本文件中始终使用从 1 开始索引的帧；MOT 工具期望如此。
- 在写入之前将 (x1, y1, x2, y2) 转换为 (x, y, w, h)。
- 对于现代比较，不要单独报告 MOTA；包括 IDF1 和 HOTA。
- 注意 MOT17 上的 private vs public 检测——它们是分开评估的，混合使用会夸大分数。
- 记录每个序列的分数；聚合会掩盖单个困难序列上的失败。
