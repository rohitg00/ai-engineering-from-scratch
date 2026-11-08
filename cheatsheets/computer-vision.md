---
id: computer-vision
title: Computer Vision
code: CV
subtitle: Preprocess, convolve, classify, fine-tune, detect, segment and patchify images. PyTorch and NumPy from the lessons.
hue: 5
sources: phases/04-computer-vision/01-image-fundamentals, phases/04-computer-vision/02-convolutions-from-scratch, phases/04-computer-vision/03-cnns-lenet-to-resnet, phases/04-computer-vision/04-image-classification, phases/04-computer-vision/05-transfer-learning, phases/04-computer-vision/06-object-detection-yolo, phases/04-computer-vision/07-semantic-segmentation-unet, phases/04-computer-vision/08-instance-segmentation-mask-rcnn, phases/04-computer-vision/14-vision-transformers
source_hash: 39d79137b3c784bf
---

## Mask R-CNN pipeline
type: architecture
from: phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md

```arch
node | img | 1,1 | Input image | list of (3, H, W)
node | bb | 2,1 | ResNet backbone | strides 4, 8, 16, 32
node | fpn | 3,1 | FPN | top down + lateral
node | rpn | 4,1 | RPN | about 1000 proposals
node | roi | 3,2 | RoIAlign | bilinear, no rounding
node | box | 2,2 | Box head | class + refine
node | mask | 4,2 | Mask head | 28x28 per class
node | nms | 1,2 | NMS | boxes, labels, masks
edge | img | bb |
edge | bb | fpn |
edge | fpn | rpn |
edge | fpn | roi | features
edge | rpn | roi | top K
edge | roi | box |
edge | roi | mask |
edge | box | nms |
```

## Preprocess for a pretrained model
type: flow
from: phases/04-computer-vision/01-image-fundamentals/docs/en.md

1. **Decode**: the file becomes `uint8` HWC in `[0, 255]`.
2. **Colour**: convert to RGB. BGR input costs about ten points.
3. **Float and layout**: divide by 255, then HWC to NCHW.
4. **Resize**: shorter side to 256, bilinear.
5. **Crop**: center crop to 224x224.
6. **Standardize**: subtract the ImageNet mean, divide by the std.
7. **Model**: the input now matches the training input.

## Key formulas
type: concepts
from: phases/04-computer-vision/02-convolutions-from-scratch/docs/en.md, phases/04-computer-vision/03-cnns-lenet-to-resnet/docs/en.md, phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/04-image-classification/docs/en.md

- **Output size**: $H_{\text{out}} = \left\lfloor \frac{H - K + 2P}{S} \right\rfloor + 1$
- **Same padding**: $P = (K - 1) / 2$ for odd $K$ and $S = 1$
- **Conv params**: $C_{\text{out}} \cdot C_{\text{in}} \cdot K \cdot K + C_{\text{out}}$
- **Receptive field**: $1 + L \cdot (K - 1)$ for $L$ stacked convs, stride 1
- **Residual**: $y = F(x) + x$
- **IoU**: $\mathrm{IoU}(A, B) = \frac{\mathop{\mathrm{area}}(A \cap B)}{\mathop{\mathrm{area}}(A \cup B)}$
- **Dice**: $\frac{2 \sum (p \cdot y)}{\sum p + \sum y + \epsilon}$, and $\text{Dice} = 2 \cdot \text{IoU} / (1 + \text{IoU})$
- **YOLO decode**: $x = (\sigma(t_x) + \text{cell}_x) \cdot \text{stride}$, $w = \text{anchor}_w \cdot \exp(t_w)$

## Tasks in code
type: task-table
from: phases/04-computer-vision/01-image-fundamentals/docs/en.md, phases/04-computer-vision/02-convolutions-from-scratch/docs/en.md, phases/04-computer-vision/04-image-classification/docs/en.md, phases/04-computer-vision/05-transfer-learning/docs/en.md, phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/14-vision-transformers/docs/en.md

| Task | Code |
|---|---|
| HWC to CHW | `img_hwc.permute(2, 0, 1)` |
| Same size 3x3 conv | `nn.Conv2d(in_channels=3, out_channels=64, kernel_size=3, stride=1, padding=1)` |
| Loss with label smoothing | `nn.CrossEntropyLoss(label_smoothing=0.1)` |
| Replace a ResNet head | `model.fc = nn.Linear(model.fc.in_features, num_classes)` |
| Pretrained backbone, any family | `timm.create_model("resnet50", pretrained=True, num_classes=10)` |
| Deduplicate boxes | `nms(boxes, scores, iou_threshold=0.45)` |
| U-Net with a pretrained encoder | `smp.Unet(encoder_name="resnet34", encoder_weights="imagenet", in_channels=3, classes=3)` |
| Pretrained ViT | `timm.create_model("vit_base_patch16_224", pretrained=True, num_classes=10)` |

## ViT forward
type: annotated-code
lang: python
from: phases/04-computer-vision/14-vision-transformers/code/main.py, phases/04-computer-vision/14-vision-transformers/docs/en.md

```python
self.proj = nn.Conv2d(in_channels, dim, kernel_size=patch_size, stride=patch_size)
self.cls_token = nn.Parameter(torch.zeros(1, 1, dim))  # one learned token
self.pos_embed = nn.Parameter(torch.zeros(1, num_patches + 1, dim))  # learned
x = self.proj(x)                                 # (N, dim, 14, 14) at 224 px
x = x.flatten(2).transpose(1, 2)                 # (N, 196, dim) tokens
cls = self.cls_token.expand(x.size(0), -1, -1)
x = torch.cat([cls, x], dim=1)                   # (N, 197, dim)
x = x + self.pos_embed                           # add position
normed = self.ln1(x)                             # pre-LN
a, _ = self.attn(normed, normed, normed, need_weights=False)
x = x + a                                        # residual
x = x + self.mlp(self.ln2(x))                    # D to 4D to D, GELU
return self.head(self.ln(x[:, 0]))               # classify from [CLS]
```

## Shapes
type: command-table
from: phases/04-computer-vision/01-image-fundamentals/docs/en.md, phases/04-computer-vision/02-convolutions-from-scratch/docs/en.md, phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md, phases/04-computer-vision/14-vision-transformers/docs/en.md

| Tensor | Shape |
|---|---|
| Decoded image | `(H, W, 3)`, uint8 |
| Model input | `(N, 3, 224, 224)`, float32 |
| Conv weight | `(C_out, C_in, K, K)` |
| YOLO head output | `(N, H, W, num_anchors, 5 + C)` |
| Segmentation logits | `(N, C, H, W)`, target `(N, H, W)` |
| Mask R-CNN masks | `(N, 1, H, W)` in [0, 1] |
| ViT tokens at 224 px | `(197, 768)` with [CLS] |

## Defaults and numbers
type: defaults
from: phases/04-computer-vision/01-image-fundamentals/docs/en.md, phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/04-image-classification/docs/en.md, phases/04-computer-vision/14-vision-transformers/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md

| Setting | Default | Note |
|---|---|---|
| ImageNet mean | 0.485, 0.456, 0.406 | on [0, 1] pixels |
| ImageNet std | 0.229, 0.224, 0.225 | per channel |
| NMS iou_threshold | 0.45 | RPN uses 0.7 |
| conf_threshold | 0.25 | objectness times class score |
| lambda_noobj | 0.5 | lambda_coord is 5.0, YOLOv1 ratios |
| Mixup alpha | 0.2 | lam from Beta(alpha, alpha) |
| ViT patch size | 16 | 196 tokens at 224 px |
| MAE mask ratio | 75% | encoder sees 25% |

## Backbones
type: command-table
from: phases/04-computer-vision/03-cnns-lenet-to-resnet/docs/en.md, phases/04-computer-vision/14-vision-transformers/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md

| Model | Size and idea |
|---|---|
| LeNet-5 | 61,706 params. Conv, pool, dense |
| AlexNet | 60M. ReLU, dropout, depth |
| VGG-16 | 138M. Only 3x3 convs |
| ResNet-18 | 11.7M. Identity skips, 69.8% top-1 |
| ViT-B/16 | 86M. 12 blocks, 12 heads, dim 768 |
| Mask R-CNN R50 FPN | 46M. 91 COCO classes |

## Troubleshooting
type: troubleshooting
from: phases/04-computer-vision/01-image-fundamentals/docs/en.md, phases/04-computer-vision/04-image-classification/docs/en.md, phases/04-computer-vision/05-transfer-learning/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Garbage output, no error | raw uint8 into the model | divide by 255, then standardize |
| First conv sees height as channels | HWC input | `permute(2, 0, 1)` to CHW |
| Wrong gradient, no error | softmax before cross-entropy | pass raw logits |
| Unstable loss | no `zero_grad()` each step | call it before `backward()` |
| Fine-tuned worse than linear probe | LR or BN bug | discriminative LR, `freeze_bn_stats` |
| 99% pixel accuracy, useless masks | class imbalance | add Dice to the loss |
| Checkerboard artifacts | transposed conv | bilinear upsample + 3x3 conv |
| Head has one class too few | background not counted | `num_classes` = classes + 1 |

## Abbreviations
type: glossary
from: phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md, phases/04-computer-vision/14-vision-transformers/docs/en.md

- **IoU**: Intersection over Union. Overlap of two boxes or masks.
- **NMS**: Non-maximum suppression. Keeps the top box, drops overlaps.
- **mAP@0.5:0.95**: COCO AP. Mean over IoU 0.5 to 0.95, step 0.05.
- **mIoU**: mean IoU over classes. The segmentation metric.
- **FPN**: Feature Pyramid Network. Semantic features at every stride.
- **RPN**: Region Proposal Network. Object or no object per anchor.
- **ViT**: Vision Transformer. Patches as tokens.
- **MAE**: Masked Autoencoder. Mask 75% of patches, reconstruct.

## Questions
type: qa
from: phases/04-computer-vision/02-convolutions-from-scratch/docs/en.md, phases/04-computer-vision/03-cnns-lenet-to-resnet/docs/en.md, phases/04-computer-vision/08-instance-segmentation-mask-rcnn/docs/en.md, phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/14-vision-transformers/docs/en.md

- **Why 3x3 everywhere?** Two 3x3 convs see 5x5 with $18C^2$ params, not $25C^2$.
- **Why residuals?** A block can learn identity, so depth stops hurting.
- **Why RoIAlign over RoIPool?** No rounding. It adds 3 to 4 mask AP on COCO.
- **Why anchors?** The head predicts small deltas from a prior box.
- **Why pre-LN in ViT?** It trains deep stacks without warmup.

## Tips
type: tips
from: phases/04-computer-vision/04-image-classification/docs/en.md, phases/04-computer-vision/05-transfer-learning/docs/en.md, phases/04-computer-vision/07-semantic-segmentation-unet/docs/en.md, phases/04-computer-vision/06-object-detection-yolo/docs/en.md, phases/04-computer-vision/01-image-fundamentals/docs/en.md

- Compute mean and std on your own training set.
- Use nearest resize for masks and label maps.
- Print linear probe and fine-tuned accuracy for every transfer run.
- Rebuild the optimizer when the set of trainable parameters changes.
- Report IoU per class, not only mIoU.
- Report precision, recall, AP@0.5 and mAP@0.5:0.95 together.
