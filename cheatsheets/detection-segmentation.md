---
id: detection-segmentation
title: Detection and Segmentation Compared
code: DC
subtitle: Boxes, pixel masks, instance masks, keypoints and text-prompted masks. Outputs, losses, metrics and fixes side by side.
hue: 355
sources: phases/04-computer-vision/06-object-detection-yolo, phases/04-computer-vision/07-semantic-segmentation-unet, phases/04-computer-vision/08-instance-segmentation-mask-rcnn, phases/04-computer-vision/21-keypoint-pose, phases/04-computer-vision/24-sam3-open-vocab-segmentation
source_hash: e1f1a8ff6ce84643
---

## Side by side
type: comparison
from: phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md, phases/04-computer-vision/21-keypoint-pose/docs/en.md, phases/04-computer-vision/24-sam3-open-vocab-segmentation/docs/en.md

| Task | Output | Metric |
|---|---|---|
| Detection (YOLO) | `(N, H, W, num_anchors, 5 + C)` | mAP@0.5:0.95, AP@0.5 |
| Semantic (U-Net) | `(N, C, H, W)` | IoU per class, mIoU, Dice |
| Instance (Mask R-CNN) | `(N, 1, H, W)` | Mask AP and box mAP |
| Pose (heatmaps) | `(N, K, H, W)` | OKS, PCK |
| Open vocab (SAM 3) | boxes + labels + scores + masks + IDs | Mask IoU |

## Use X when
type: concepts
from: phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md, phases/04-computer-vision/21-keypoint-pose/docs/en.md, phases/04-computer-vision/24-sam3-open-vocab-segmentation/docs/en.md

- **YOLO-style detector**: boxes and classes in one forward pass, in real time.
- **U-Net semantic**: one class per pixel. Two touching cars become one blob.
- **Mask R-CNN instance**: one mask per object, also when objects share a class.
- **Panoptic**: every pixel gets a class. Every instance gets a unique id.
- **Top-down pose**: highest accuracy. Cost grows with the number of people.
- **Bottom-up pose**: crowds. Constant time for any crowd size.
- **SAM 3**: masks and instance IDs for a noun phrase in one forward pass.
- **Grounded SAM 2 or YOLO-World**: a detector swap or other license. YOLO-World for boxes at high fps.

## Mask R-CNN
type: architecture
from: phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md

```arch
node | img | 1,1 | Input | image tensor | client
node | bb | 2,1 | ResNet backbone | strides 4, 8, 16, 32 | model
node | fpn | 3,1 | FPN | top-down + lateral
node | rpn | 4,1 | RPN | ~1000 proposals, NMS 0.7
node | ra | 4,2 | RoIAlign | bilinear, no rounding
node | bh | 3,2 | Box head | class + refine
node | mh | 2,2 | Mask head | 28x28 per class
node | out | 1,2 | Output | boxes + classes + masks
edge | img | bb |
edge | bb | fpn |
edge | fpn | rpn |
edge | rpn | ra | top-K proposals
edge | ra | bh | 7x7
edge | ra | mh | 14x14
edge | bh | out | NMS
edge | mh | out |
```

## YOLO inference: postprocess
type: flow
from: phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/06-object-detection-yolo/code/main.py

1. **Head**: one 1x1 conv gives `(N, H, W, num_anchors, 5 + C)`.
2. **Unpack**: each anchor holds `tx, ty, tw, th, obj` and C class logits.
3. **Score**: `sigmoid(obj)` times the best class sigmoid.
4. **Threshold**: drop the box when the score is below `conf_threshold`.
5. **Decode**: centre is sigmoid offset plus cell, times `stride`. Size is anchor times `np.exp`.
6. **NMS**: `nms(boxes, scores, iou_threshold)` keeps one box per object.
7. **Return**: `boxes[keep], scores[keep], classes[keep]`.

## Formulas
type: concepts
from: phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md, phases/04-computer-vision/21-keypoint-pose/docs/en.md

- **YOLO output**: $S \times S \times B(5 + C)$. VOC with S=13, B=2, C=20 gives 50 per cell.
- **Decode**: $c_x = (\sigma(t_x) + \mathrm{cell}_x) \cdot \mathrm{stride}$, $w = a_w e^{t_w}$
- **IoU**: area of the intersection over area of the union. A hit needs IoU >= 0.5.
- **mAP@0.5:0.95**: mean AP over IoU 0.5, 0.55, ..., 0.95. The COCO metric.
- **Dice**: $2 \sum p y / (\sum p + \sum y + \epsilon)$. The loss is 1 - Dice.
- **Dice from IoU**: $\mathrm{Dice} = 2 \cdot \mathrm{IoU} / (1 + \mathrm{IoU})$
- **Mask R-CNN loss**: rpn_cls + rpn_box + box_cls + box_reg + mask.
- **Heatmap target**: $\exp(-((x - c_x)^2 + (y - c_y)^2) / 2\sigma^2)$

## Non-max suppression
type: annotated-code
lang: python
from: phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/06-object-detection-yolo/code/main.py

```python
def nms(boxes, scores, iou_threshold=0.45):
    order = np.argsort(-scores)                  # best score first
    keep = []
    while len(order) > 0:
        i = order[0]
        keep.append(i)
        if len(order) == 1:
            break
        rest = order[1:]
        ious = box_iou(boxes[[i]], boxes[rest])[0]
        order = rest[ious <= iou_threshold]      # drop the overlaps
    return np.array(keep, dtype=np.int64)
```

## U-Net losses
type: annotated-code
lang: python
from: phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/code/main.py

```python
def dice_loss(logits, targets, num_classes, eps=1e-6):
    probs = F.softmax(logits, dim=1)
    targets_one_hot = F.one_hot(targets, num_classes).permute(0, 3, 1, 2).float()
    dims = (0, 2, 3)                                    # batch, H, W
    intersection = (probs * targets_one_hot).sum(dim=dims)
    denom = probs.sum(dim=dims) + targets_one_hot.sum(dim=dims)
    dice = (2 * intersection + eps) / (denom + eps)     # eps for absent classes
    return 1 - dice.mean()                              # macro Dice
def combined_loss(logits, targets, num_classes, lam=1.0):
    ce = F.cross_entropy(logits, targets)               # (N, C, H, W) and (N, H, W)
    dc = dice_loss(logits, targets, num_classes)
    return ce + lam * dc, {"ce": ce.item(), "dice": dc.item()}
```

## Fine-tune Mask R-CNN
type: annotated-code
lang: python
from: phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/code/main.py

```python
model = maskrcnn_resnet50_fpn_v2(weights=MaskRCNN_ResNet50_FPN_V2_Weights.DEFAULT)
in_features = model.roi_heads.box_predictor.cls_score.in_features
model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)  # counts background
in_features_mask = model.roi_heads.mask_predictor.conv5_mask.in_channels
model.roi_heads.mask_predictor = MaskRCNNPredictor(in_features_mask, 256, num_classes)
for p in model.backbone.parameters():
    p.requires_grad = False                      # freezes the FPN too
loss_dict = model(images, targets)               # train mode: dict of losses
losses = sum(loss for loss in loss_dict.values())
binary_masks = (p['masks'] > 0.5).squeeze(1)     # eval mode: (N, H, W)
```

## Tasks in code
type: task-table
from: phases/04-computer-vision/06-object-detection-yolo/code/main.py, phases/04-computer-vision/07-semantic-segmentation-unet/code/main.py, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/code/main.py, phases/04-computer-vision/21-keypoint-pose/code/main.py, phases/04-computer-vision/24-sam3-open-vocab-segmentation/code/main.py, phases/04-computer-vision/24-sam3-open-vocab-segmentation/docs/en.md

| Task | Code |
|---|---|
| Pairwise box IoU | `box_iou(boxes_a, boxes_b)` |
| Head output to boxes | `postprocess(pred_tensor, anchors, stride)` |
| IoU for each class | `iou_per_class(logits, targets, num_classes)` |
| Crop a box from a feature map | `roi_align_single(feature, box)` |
| Heatmaps to (x, y) | `heatmap_to_coords(heatmaps)` |
| Sub-pixel keypoints | `subpixel_refine(heatmaps)` |
| Split a sentence into concepts | `split_concepts(sentence)` |
| SAM 3 text prompt | `processor.set_text_prompt(inputs, "<concept>")` |

## Defaults
type: defaults
from: phases/04-computer-vision/06-object-detection-yolo/code/main.py, phases/04-computer-vision/07-semantic-segmentation-unet/code/main.py, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md, phases/04-computer-vision/21-keypoint-pose/code/main.py

| Setting | Default | Note |
|---|---|---|
| `iou_threshold` | 0.45 | NMS for object detection |
| `conf_threshold` | 0.25 | Objectness times best class |
| `lambda_coord` | 5.0 | Box loss weight, YOLOv1 ratio |
| `lambda_noobj` | 0.5 | Empty cells dominate otherwise |
| RPN NMS IoU | 0.7 | After the top ~1,000 boxes |
| Mask threshold | 0.5 | Float mask to binary mask |
| Heatmap `sigma` | 2.0 | Gaussian blob per keypoint |
| Dice weight `lam` | 1.0 | Loss is ce plus lam times dice |

## Troubleshooting
type: troubleshooting
from: phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Weak mAP@0.5:0.95 only | Rough box localisation | Better box loss, CIoU or DIoU |
| High precision, low recall | Detector too conservative | Lower the confidence threshold |
| One object, many boxes | Adjacent anchors overlap | Run NMS at 0.45 |
| 99% pixel acc, empty mask | Background dominates | Add Dice to cross-entropy |
| mIoU looks fine | One class at 15% hides | Report IoU per class |
| Checkerboard artifacts | Transposed conv | Bilinear upsample + 3x3 conv |
| Labels shift by one | `num_classes` without background | 4 classes use `num_classes=5` |
| Overfits on 500 images | Backbone and FPN train | Freeze `model.backbone` |

## Questions
type: qa
from: phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md, phases/04-computer-vision/21-keypoint-pose/docs/en.md, phases/04-computer-vision/24-sam3-open-vocab-segmentation/docs/en.md

- **Why RoIAlign, not RoIPool?** RoIPool rounds coordinates. RoIAlign lifts mask AP by 3-4 points.
- **Why heatmaps, not direct (x, y)?** The conv map aligns with the spatial output.
- **Why anchors?** The head predicts small deltas from prior box shapes.
- **Why skips in U-Net?** The encoder loses edge detail. Skips give back high-resolution maps.
- **Why must U-Net input divide by 16?** The encoder halves the resolution four times.
- **Is SAM 3 faster than Grounded SAM 2?** Usually net-neutral or a slight speedup.
