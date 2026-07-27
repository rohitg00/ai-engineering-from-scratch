---
name: skill-mask-rcnn-head-swapper
description: 生成用于在 torchvision Mask R-CNN 上为自定义 num_classes 更换框和掩码头部的精确代码
version: 1.0.0
phase: 4
lesson: 8
tags: [computer-vision, mask-rcnn, fine-tuning, torchvision]
---

# Mask R-CNN 头部更换器（Mask R-CNN Head Swapper）

专门为 Mask R-CNN 生成头部更换样板代码。下面的模板假定模型具有 `model.roi_heads.box_predictor` 和 `model.roi_heads.mask_predictor`，这些仅存在于 `maskrcnn_resnet50_fpn` 和 `maskrcnn_resnet50_fpn_v2` 上。Faster R-CNN 有框预测器但没有掩码预测器；RetinaNet 使用 `RetinaNetHead` 且根本没有 `roi_heads`——两者都需要不同的技能。

## 何时使用

- 在自定义类别集上微调 `maskrcnn_resnet50_fpn` 或 `maskrcnn_resnet50_fpn_v2`。
- 将在 COCO 上训练的 Mask R-CNN 检查点移植到非 COCO 类别数量。
- 调试 Mask R-CNN 训练运行，因 `cls_score.out_features` 或 `mask_predictor` 不匹配而崩溃。

## 适用范围

- `fasterrcnn_*` — 没有 mask_predictor。仅更换 `box_predictor`；使用单独的 Faster R-CNN 头部更换方案。
- `retinanet_*` — 没有 `roi_heads`；分类 + 回归头部位于 `model.head.classification_head` 和 `model.head.regression_head`。使用特定于 RetinaNet 的技能。
- `keypointrcnn_*` — 使用 `keypoint_predictor` 而非 `mask_predictor`。

## 输入

- `model_name`：torchvision 检测模型构造函数，例如 `maskrcnn_resnet50_fpn_v2`。
- `num_classes`：包括背景。一个 4 个物体类别的数据集意味着 `num_classes=5`。
- `freeze`：`backbone`、`backbone_fpn`、`none` 之一。

## 步骤

1. 导入模型构造函数和两个预测器类（`FastRCNNPredictor`、`MaskRCNNPredictor`）。
2. 加载默认权重的预训练模型。
3. 将 `model.roi_heads.box_predictor` 替换为新的 `FastRCNNPredictor(in_features, num_classes)`。
4. 将 `model.roi_heads.mask_predictor` 替换为新的 `MaskRCNNPredictor(in_features_mask, hidden_layer=256, num_classes)`。
5. 应用请求的冻结策略。
6. 打印确认块，列出每个模块的可训练参数。

## 输出代码模板

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

其中 `{FREEZE_BLOCK}` 为：

- `none` -> 空
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

## 报告

```
[head-swap]
  model:         <MODEL_NAME>
  num_classes:   <N>  （包含背景）
  freeze policy: <选择>
  trainable:     <N>
  total:         <N>
```

## 规则

- 绝不推荐不含背景的 `num_classes`；始终提醒用户包含背景。
- 只要可用，始终使用 torchvision 检测模型的 `_v2` 变体；它们有比旧版本更好的预训练权重。
- 不在本技能内部实例化模型——生成代码块让用户运行。
- 如果用户在超过 10,000 张图像的数据集上请求 `freeze backbone`，建议他们也考虑微调骨干网络。
