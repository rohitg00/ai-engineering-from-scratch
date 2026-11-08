# Evidence: cheatsheets/computer-vision.md

Abbreviations: P04 = phases/04-computer-vision. L01 = P04/01-image-fundamentals, L02 = P04/02-convolutions-from-scratch, L03 = P04/03-cnns-lenet-to-resnet, L04 = P04/04-image-classification, L05 = P04/05-transfer-learning, L06 = P04/06-object-detection-yolo, L07 = P04/07-semantic-segmentation-unet, L08 = P04/08-instance-segmentation-mask-rcnn, L14 = P04/14-vision-transformers. All docs paths are docs/en.md unless code/main.py is named.

## Architecture: Mask R-CNN pipeline (8 nodes)
- img "Input image, list of (3, H, W)": L08/docs/en.md:31, 191-192 (model([x]) with x = torch.randn(3, 400, 600))
- bb "ResNet backbone, strides 4, 8, 16, 32": L08/docs/en.md:32, 50
- fpn "FPN, top down + lateral": L08/docs/en.md:32, 51
- rpn "RPN, about 1000 proposals": L08/docs/en.md:33, 52
- roi "RoIAlign, bilinear, no rounding": L08/docs/en.md:34, 53, 67-70
- box "Box head, class + refine": L08/docs/en.md:36, 54
- mask "Mask head, 28x28 per class": L08/docs/en.md:37, 54, 81
- nms "NMS, boxes, labels, masks": L08/docs/en.md:38-40, 104-110
- edges: L08/docs/en.md:31-40 (edge "top K" L08/docs/en.md:35, "features" L08/docs/en.md:34)

## Flow: Preprocess for a pretrained model (7 steps)
1. decode uint8 HWC [0, 255]: L01/docs/en.md:33, 231
2. RGB, BGR costs ten points: L01/docs/en.md:19, 34
3. divide by 255, HWC to NCHW: L01/docs/en.md:37, 39-40, 385, 413
4. resize shorter side 256, bilinear: L01/docs/en.md:388, 394, 413
5. center crop 224x224: L01/docs/en.md:399-401, 413
6. standardize ImageNet mean and std: L01/docs/en.md:147, 403-405, 413
7. input matches training input: L01/docs/en.md:29, 413

## Key formulas (concepts, 8)
- output size: L02/docs/en.md:77-79
- same padding P = (K - 1) / 2: L02/docs/en.md:91
- conv params C_out * C_in * K * K + C_out: L02/docs/en.md:146
- receptive field 1 + L * (K - 1): L02/docs/en.md:176
- residual y = F(x) + x: L03/docs/en.md:123-127
- IoU: L06/docs/en.md:92-94
- Dice and Dice = 2 IoU / (1 + IoU): L07/docs/en.md:104-108, 125
- YOLO decode: L06/docs/en.md:77-84

## Tasks in code (task-table, 8)
- img_hwc.permute(2, 0, 1): L01/docs/en.md:116
- nn.Conv2d(in_channels=3, out_channels=64, kernel_size=3, stride=1, padding=1): L02/docs/en.md:349
- nn.CrossEntropyLoss(label_smoothing=0.1): L04/docs/en.md:103
- model.fc = nn.Linear(model.fc.in_features, num_classes): L05/docs/en.md:294
- timm.create_model("resnet50", pretrained=True, num_classes=10): L05/docs/en.md:300
- nms(boxes, scores, iou_threshold=0.45): L06/docs/en.md:179
- smp.Unet(encoder_name="resnet34", encoder_weights="imagenet", in_channels=3, classes=3): L07/docs/en.md:359-364 (joined to one line)
- timm.create_model("vit_base_patch16_224", pretrained=True, num_classes=10): L14/docs/en.md:237

## Annotated code: ViT forward (13 lines)
- self.proj conv k=s=patch_size: L14/code/main.py:9
- cls_token, pos_embed: L14/code/main.py:45-46
- proj, flatten(2).transpose(1, 2): L14/code/main.py:13-14. Shape (768, 14, 14), (196, 768): L14/docs/en.md:50-55
- cls expand, torch.cat, + pos_embed: L14/code/main.py:55-57. (197, 768): L14/docs/en.md:64
- normed = self.ln1(x), attn, x + a, mlp: L14/code/main.py:32-35. Pre-LN: L14/docs/en.md:84-85. MLP d to 4d to d with GELU: L14/docs/en.md:87
- return self.head(self.ln(x[:, 0])): L14/code/main.py:60. [CLS] output: L14/docs/en.md:67
- Note: lines from PatchEmbedding, Block and ViT are joined into one forward listing.

## Shapes (command-table, 7)
- decoded (H, W, 3) uint8: L01/docs/en.md:231
- model input (N, 3, 224, 224) float32: L01/docs/en.md:401, 407-408, 413
- conv weight (C_out, C_in, K, K): L02/docs/en.md:143
- YOLO head (N, H, W, num_anchors, 5 + C): L06/docs/en.md:251
- segmentation logits (N, C, H, W), target (N, H, W): L07/docs/en.md:90
- Mask R-CNN masks (N, 1, H, W) in [0, 1]: L08/docs/en.md:109
- ViT tokens (197, 768): L14/docs/en.md:64

## Defaults and numbers (defaults, 8)
- ImageNet mean 0.485, 0.456, 0.406 on [0, 1]: L01/docs/en.md:147
- ImageNet std 0.229, 0.224, 0.225: L01/docs/en.md:147
- NMS iou_threshold 0.45: L06/docs/en.md:112, 179. RPN NMS 0.7: L08/docs/en.md:77
- conf_threshold 0.25, objectness times class score: L06/docs/en.md:329, 339
- lambda_noobj 0.5, lambda_coord 5.0: L06/docs/en.md:291, 322
- mixup alpha 0.2, Beta(alpha, alpha): L04/docs/en.md:90, 218
- patch size 16, 196 tokens: L14/docs/en.md:48, 98
- MAE mask 75%, encoder sees 25%: L14/docs/en.md:124

## Backbones (command-table, 6)
- LeNet-5 61,706: L03/docs/en.md:195
- AlexNet 60M, ReLU, dropout, depth: L03/docs/en.md:60-62
- VGG-16 138M, 3x3 only: L03/docs/en.md:68, 77, 352
- ResNet-18 11.7M, 69.8%: L03/docs/en.md:352
- ViT-B/16 86M, 12 blocks, 12 heads, 768: L14/docs/en.md:90, 266
- Mask R-CNN 46M, 91 classes: L08/docs/en.md:185

## Troubleshooting (8)
- raw uint8 into model: L01/docs/en.md:19, 147
- channels-last makes first conv treat height as channel: L01/docs/en.md:19, fix L01/docs/en.md:116
- softmax before CE: L04/docs/en.md:49, 68
- missing zero_grad: L04/docs/en.md:49, 295
- fine-tuned below linear probe, LR or BN bug: L05/docs/en.md:116. freeze_bn_stats: L05/docs/en.md:199
- 99% accuracy useless, Dice: L07/docs/en.md:100-102, 113-119
- checkerboard artifacts, bilinear + 3x3 conv: L07/docs/en.md:83-84
- num_classes includes background: L08/docs/en.md:227

## Abbreviations (glossary, 8)
- IoU: L06/docs/en.md:400
- NMS: L06/docs/en.md:401
- mAP@0.5:0.95: L06/docs/en.md:138, 406
- mIoU: L07/docs/en.md:124, 397
- FPN: L08/docs/en.md:51, 286
- RPN: L08/docs/en.md:52, 287
- ViT: L14/docs/en.md:1, 266
- MAE: L14/docs/en.md:124, 268

## Questions (qa, 5)
- 3x3 vs 5x5 parameters: L02/docs/en.md:181, L03/docs/en.md:75
- residual identity: L03/docs/en.md:130
- RoIAlign 3 to 4 mask AP: L08/docs/en.md:58, 73
- anchors predict deltas: L06/docs/en.md:59
- pre-LN without warmup: L14/docs/en.md:94

## Tips (6)
- dataset-specific mean and std: L04/docs/en.md:394
- nearest for masks and labels: L01/docs/en.md:191, 197
- print pretrained-only and fine-tuned: L05/docs/en.md:111-116
- rebuild optimizer when trainable set changes: L05/docs/en.md:284
- IoU per class: L07/docs/en.md:128
- report the four detection numbers: L06/docs/en.md:135-140

## Dropped facts
- Lessons 12, 13 and 15 to 28 (video, 3D, edge, CLIP, OCR, tracking and others): not covered, kept out to fit two pages.
- Diffusion, GAN and Stable Diffusion lessons (L09 to L11, L23): left to the diffusion-models topic.
