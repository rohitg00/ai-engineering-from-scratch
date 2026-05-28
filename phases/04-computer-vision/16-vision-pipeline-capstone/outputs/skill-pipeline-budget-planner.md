---
name: skill-pipeline-budget-planner
description: 目標latencyとthroughputから各pipeline stageへ時間予算を割り当て、どのstageが最初に予算未達になるか示す
version: 1.0.0
phase: 4
lesson: 16
tags: [vision, pipeline, performance, deployment]
---

# Pipeline Budget Planner

latency/throughput目標をstage別の予算に変換し、各チームメンバーがどの数値に向けてengineeringすべきか分かるようにします。

## 使う場面

- 新しいvision serviceを作る前に、各stageへの期待値を設定するとき。
- 初回benchmark後に、どのstageが予算から最も遠いか見るとき。
- SLAが変わり、予算を再交渉する必要があるとき。

## 入力

- `p95_latency_target_ms`: requestごとの予算。
- `target_qps`: replicaごとのthroughput。
- `stages`: `{ name: str, current_ms: float }` のlist。

## 割り当てルール

現在の測定値がない場合、標準的な7stageにはdefaultで次の配分を使う。

| Stage | Share |
|-------|-------|
| decode + preprocess | 15% |
| detector forward | 55% |
| postprocess detections (NMS, clamp) | 5% |
| crop + resize for classifier | 5% |
| classifier forward | 15% |
| schema validation | <1% |
| response serialisation | 4% |

GPU-bound pipeline（cloud）では、detectorの比率が70%まで上がることが多い。CPUではpreprocessingとclassifier batchingの比率が大きくなる。

## レポート

```
[budget plan]
  p95 target:  <ms>
  throughput:  <qps per replica>

| stage               | target_ms | current_ms | headroom | gate |
|---------------------|-----------|------------|----------|------|
| decode+preprocess   | ...       | ...        | ...      | ok|X |
| detector            | ...       | ...        | ...      | ok|X |
| ...                 | ...       | ...        | ...      |      |

[bottleneck]
  stage:  <name>
  miss:   <ms over budget>
  lever:  <specific action>

[levers]
  decode+preprocess:   Pillow-SIMD, libjpeg-turbo, decode on GPU via NVJPEG
  detector:            smaller backbone, lower input resolution, INT8, TensorRT
  postprocess:         GPU-side NMS (torchvision.ops), fused masks
  crop+resize:         GPU crop with grid_sample, batched interpolate
  classifier:          smaller backbone, INT8, warm cache, batch
  schema:              skip validation in hot path, validate at boundaries only
  response:            orjson, stream protobuf
```

## ルール

- production pathからschema validationを落とす提案は絶対にしない。代わりにboundaryへ移すことを提案する。
- preprocessingが予算を超えている場合、modelを変える前に必ずPillow-SIMDまたはNVJPEGを試す。
- detectorの未達がtargetの30%を超える場合、現在のmodelを最適化するのではなくmodelを切り替える。
- `current_ms > 1.1 * target_ms` の場合はgateを `X` とし、予算の10%以内なら `ok` とする。
