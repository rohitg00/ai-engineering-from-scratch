---
name: skill-mask-rcnn-head-swapper
description: Generate the exact code for swapping box and mask heads on a torchvision Mask R-CNN for a custom num_classes
version: 1.0.0
phase: 4
lesson: 8
tags: [computer-vision, mask-rcnn, fine-tuning, torchvision]
---

# Mask R-CNN Head Swapper

Produces the head-swap boilerplate for Mask R-CNN specifically. The template below assumes `model.roi_heads.box_predictor` and `model.roi_heads.mask_predictor`, which exist on `maskrcnn_resnet50_fpn` and `maskrcnn_resnet50_fpn_v2` only. Faster R-CNN has a box predictor but no mask predictor; RetinaNet uses `RetinaNetHead` and has no `roi_heads` at all — both require different skills.

## When to use

- Fine-tuning `maskrcnn_resnet50_fpn` or `maskrcnn_resnet50_fpn_v2` on a custom class set.
- Porting a Mask R-CNN checkpoint trained on COCO to a non-COCO class count.
- Debugging a Mask R-CNN training run that crashes on `cls_score.out_features` or `mask_predictor` mismatch.

## Out of scope

- `fasterrcnn_*` — no mask_predictor. Swap only `box_predictor`; use a separate Faster R-CNN head-swap recipe.
- `retinanet_*` — no `roi_heads`; classifier + regression heads live under `model.head.classification_head` and `model.head.regression_head`. Use a RetinaNet-specific skill.
- `keypointrcnn_*` — uses `keypoint_predictor` instead of `mask_predictor`.

## Inputs

- `model_name`: torchvision detection model constructor, e.g. `maskrcnn_resnet50_fpn_v2`.
- `num_classes`: including background. A 4-object-class dataset means `num_classes=5`.
- `freeze`: one of `backbone`, `backbone_fpn`, `none`.

## Steps

1. Import the model constructor and the two predictor classes (`FastRCNNPredictor`, `MaskRCNNPredictor`).
2. Load the default-weights pretrained model.
3. Replace `model.roi_heads.box_predictor` with a new `FastRCNNPredictor(in_features, num_classes)`.
4. Replace `model.roi_heads.mask_predictor` with a new `MaskRCNNPredictor(in_features_mask, hidden_layer=256, num_classes)`.
5. Apply the requested freeze policy.
6. Print a confirmation block listing trainable params per module.

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

- Never recommend `num_classes` without the background included; always remind the user.
- Always use the `_v2` variants of torchvision detection models when available; they have better pretrained weights than the legacy ones.
- Do not instantiate the model inside this skill — produce the code block and let the user run it.
- If the user requests `freeze backbone` on a dataset larger than 10,000 images, suggest they consider fine-tuning the backbone too.
