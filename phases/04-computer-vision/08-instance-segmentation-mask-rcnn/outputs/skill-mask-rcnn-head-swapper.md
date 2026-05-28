---
name: skill-mask-rcnn-head-swapper
description: custom num_classes 用に torchvision Mask R-CNN の box head と mask head を差し替える正確な code を生成する
version: 1.0.0
phase: 4
lesson: 8
tags: [computer-vision, mask-rcnn, fine-tuning, torchvision]
---

# Mask R-CNN Head Swapper

Mask R-CNN 専用の head-swap boilerplate を生成します。下の template は `model.roi_heads.box_predictor` と `model.roi_heads.mask_predictor` を前提にしており、これは `maskrcnn_resnet50_fpn` と `maskrcnn_resnet50_fpn_v2` にだけ存在します。Faster R-CNN には box predictor はありますが mask predictor はありません。RetinaNet は `RetinaNetHead` を使い `roi_heads` がありません。どちらも別の skill が必要です。

## When to use

- custom class set で `maskrcnn_resnet50_fpn` または `maskrcnn_resnet50_fpn_v2` を fine-tuning するとき。
- COCO で学習した Mask R-CNN checkpoint を non-COCO class count に porting するとき。
- `cls_score.out_features` または `mask_predictor` mismatch で落ちる Mask R-CNN training run を debugging するとき。

## Out of scope

- `fasterrcnn_*` — `mask_predictor` がない。`box_predictor` だけを swap する。別の Faster R-CNN head-swap recipe を使う。
- `retinanet_*` — `roi_heads` がない。classifier + regression heads は `model.head.classification_head` と `model.head.regression_head` の下にある。RetinaNet-specific skill を使う。
- `keypointrcnn_*` — `mask_predictor` ではなく `keypoint_predictor` を使う。

## Inputs

- `model_name`: torchvision detection model constructor。例: `maskrcnn_resnet50_fpn_v2`。
- `num_classes`: background を含む。4-object-class dataset なら `num_classes=5`。
- `freeze`: `backbone`, `backbone_fpn`, `none` のいずれか。

## Steps

1. model constructor と 2 つの predictor classes（`FastRCNNPredictor`, `MaskRCNNPredictor`）を import する。
2. default-weights pretrained model を load する。
3. `model.roi_heads.box_predictor` を新しい `FastRCNNPredictor(in_features, num_classes)` に置き換える。
4. `model.roi_heads.mask_predictor` を新しい `MaskRCNNPredictor(in_features_mask, hidden_layer=256, num_classes)` に置き換える。
5. requested freeze policy を適用する。
6. module ごとの trainable params を listed した confirmation block を print する。

## Output code template

```python
from torchvision.models.detection import {MODEL_NAME}, {MODEL_WEIGHTS}
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.models.detection.mask_rcnn import MaskRCNNPredictor

def build_model(num_classes={NUM_CLASSES}):
    model = {MODEL_NAME}(weights={MODEL_WEIGHTS}.DEFAULT)
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)
    in_features_mask = model.roi_heads.mask_predictor.conv5_mask.in_channels
    model.roi_heads.mask_predictor = MaskRCNNPredictor(in_features_mask, 256, num_classes)

    {FREEZE_BLOCK}

    return model
```

Where `{FREEZE_BLOCK}` is:

- `none` -> empty
- `backbone` ->
  ```python
  for p in model.backbone.parameters():
      p.requires_grad = False
  ```
- `backbone_fpn` ->
  ```python
  for p in model.backbone.parameters():
      p.requires_grad = False
  # FPN parameters live inside backbone.fpn
  ```

## Report

```
[head-swap]
  model:         <MODEL_NAME>
  num_classes:   <N>  (includes background)
  freeze policy: <choice>
  trainable:     <N>
  total:         <N>
```

## Rules

- background を含めずに `num_classes` を推奨しない。必ず user に reminder を出す。
- torchvision detection models では、利用可能なら必ず `_v2` variants を使う。legacy ones より pretrained weights が良い。
- この skill の中では model を instantiate しない。code block を生成し、user に実行してもらう。
- user が 10,000 images を超える dataset で `freeze backbone` を要求した場合は、backbone も fine-tuning することを検討するよう提案する。
