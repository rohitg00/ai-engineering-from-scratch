# Evidence: cheatsheets/detection-segmentation.md

Abbreviations: P04 = phases/04-computer-vision. L06 = P04/06-object-detection-yolo, L07 = P04/07-semantic-segmentation-unet, L08 = P04/08-instance-segmentation-mask-rcnn, L21 = P04/21-keypoint-pose, L24 = P04/24-sam3-open-vocab-segmentation. d = docs/en.md, c = code/main.py.

## Side by side (defaults, 5 rows)
- Detection output (N, H, W, num_anchors, 5 + C), metrics mAP@0.5:0.95 and AP@0.5: L06/d:137-138, 251
- Semantic output (N, C, H, W), IoU per class, mIoU, Dice: L07/d:90, 124-125
- Instance masks (N, 1, H, W), mask AP and box mAP: L08/d:200, 266, 290
- Pose output (N, K, H, W), OKS and PCK: L21/d:80, 137
- SAM 3 boxes + labels + scores + masks + IDs, mask IoU: L24/d:105, 274

## Use X when (concepts, 8)
- YOLO single forward pass, real time: L06/d:23
- Semantic, two cars collapse into one blob: L07/d:40
- Instance, one mask per object even with a shared class: L08/d:19
- Panoptic, every pixel class, every instance unique id: L07/d:42
- Top-down highest accuracy, scales linearly with people: L21/d:44
- Bottom-up, constant time regardless of crowd size: L21/d:45
- SAM 3 noun phrase, all masks and instance IDs in one pass: L24/d:21
- Grounded SAM 2 for detector flexibility or license, YOLO-World boxes at high fps: L24/d:79-81, 88, 241

## Mask R-CNN (architecture, 8 nodes)
- Input, ResNet backbone at strides 4, 8, 16, 32: L08/d:50
- FPN top-down + lateral: L08/d:51
- RPN ~1000 proposals, NMS at IoU 0.7: L08/d:52, 77
- RoIAlign bilinear, no rounding: L08/d:53, 67-71
- Box head class + refine: L08/d:36, 54
- Mask head 28x28 per class: L08/d:54, 81
- Output boxes + classes + masks: L08/d:40
- Edges top-K proposals, NMS: L08/d:35, 38-40; 7 for box head, 14 for mask head: L08/d:133

## YOLO inference: postprocess (flow, 7 steps)
1. 1x1 conv head, output (N, H, W, num_anchors, 5 + C): L06/d:230, 251
2. tx, ty, tw, th, obj and class logits: L06/c:163-165
3. score = sigmoid(obj) * best class sigmoid: L06/c:166-167
4. score < conf_threshold, continue: L06/c:168-169
5. centre (sigmoid + cell) * stride, size anchor * np.exp: L06/d:343-346
6. nms(boxes, scores, iou_threshold): L06/c:185
7. return boxes[keep], scores[keep], classes[keep]: L06/c:186

## Formulas (concepts, 8)
- S x S x (5 + C), B * (5 + C), VOC S=13, B=2, C=20 gives 50: L06/d:29, 53
- Decode sigmoid(t_x) + cell_x times stride, anchor_w * exp(t_w): L06/d:77-84
- IoU intersection over union, TP at IoU >= 0.5: L06/d:92-96
- mAP@0.5:0.95 over 0.5, 0.55, ..., 0.95, COCO metric: L06/d:138
- Dice formula, loss 1 - Dice: L07/d:104-109
- Dice = 2 IoU / (1 + IoU): L07/d:125
- Mask R-CNN loss rpn_cls + rpn_box + box_cls + box_reg + mask: L08/d:89-91
- Gaussian heatmap target: L21/d:53-55

## Non-max suppression (annotated-code, 11 lines)
- nms body, argsort descending, box_iou, keep ious <= iou_threshold: L06/d:179-190, L06/c:30-41

## U-Net losses (annotated-code, 12 lines)
- dice_loss body, dims (0, 2, 3), eps, 1 - dice.mean(): L07/d:244-251, L07/c:75-82
- eps prevents division by zero on absent classes, macro Dice: L07/d:260
- combined_loss with lam=1.0, F.cross_entropy, return dict: L07/d:254-257, L07/c:85-88
- (N, C, H, W) output, (N, H, W) target: L07/d:90

## Fine-tune Mask R-CNN (annotated-code, 10 lines)
- maskrcnn_resnet50_fpn_v2 weights DEFAULT, swap box_predictor and mask_predictor with 256 hidden: L08/d:215-220, L08/c:61-65
- num_classes includes background: L08/d:227
- freeze model.backbone.parameters(), covers FPN: L08/d:234-240, L08/c:69-73
- loss_dict = model(images, targets), sum of values: L08/d:256-257
- binary_masks = (p['masks'] > 0.5).squeeze(1), (N, H, W): L08/d:203
- dict of losses in train, predictions in eval: L08/d:264

## Tasks in code (task-table, 8)
- box_iou(boxes_a, boxes_b): L06/c:11
- postprocess(pred_tensor, anchors, stride, ...): L06/c:155
- iou_per_class(logits, targets, num_classes): L07/c:92
- roi_align_single(feature, box, ...): L08/c:6
- heatmap_to_coords(heatmaps): L21/c:29
- subpixel_refine(heatmaps): L21/c:38
- split_concepts(sentence): L24/c:17
- processor.set_text_prompt(inputs, "yellow school bus"): L24/d:219

## Defaults (defaults, 8)
- iou_threshold 0.45: L06/c:30, 155; typical 0.45 for detection: L06/d:112
- conf_threshold 0.25, objectness times best class: L06/c:155, 167
- lambda_coord 5.0: L06/c:122; YOLOv1 ratio: L06/d:322
- lambda_noobj 0.5, empty cells dominate: L06/c:122, L06/d:127
- RPN NMS IoU 0.7 after top ~1,000: L08/d:77
- Mask threshold 0.5: L08/d:109
- sigma 2.0: L21/c:7
- lam 1.0, ce + lam * dc: L07/c:85, 88

## Troubleshooting (troubleshooting, 8)
- weak mAP@0.5:0.95, rough localisation, better box loss: L06/d:140; CIoU / DIoU: L06/d:129
- high precision low recall, too conservative, lower confidence threshold: L06/d:140
- same object many times, adjacent anchors, NMS: L06/d:21, 100, 112
- 99% accuracy predicting background, Dice: L07/d:100-102, 113
- mIoU hides a class at 15%: L07/d:128
- checkerboard from transposed conv, bilinear + 3x3 conv: L07/d:83-84
- num_classes includes background, 4 classes use 5: L08/d:227
- freeze backbone and FPN on 500-image datasets: L08/d:231, 247

## Questions (qa, 6)
- RoIPool rounds, RoIAlign lifts mask AP by 3-4 points: L08/d:58, 73
- heatmaps align with spatial structure: L21/d:59
- anchors predict small deltas from priors: L06/d:59
- skip connections hand back high-resolution maps: L07/d:77
- input divisible by 16, halves four times: L07/d:132
- SAM 3 latency net-neutral or slight speedup: L24/d:237
