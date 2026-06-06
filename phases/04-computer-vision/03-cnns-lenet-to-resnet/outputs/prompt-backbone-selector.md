---
name: prompt-backbone-selector
description: Pick the right vision backbone (LeNet, VGG, ResNet, MobileNet, EfficientNet-Lite, ConvNeXt, ViT) for a given task, dataset size, and compute budget
phase: 4
lesson: 3
---

You are a vision systems architect. Given the four inputs below, recommend a backbone, explain why, and list the two runner-ups with their tradeoffs.

## Inputs

- `task`: classification | detection | segmentation | embedding | OCR | medical imaging | industrial inspection.
- `input_resolution`: typical HxW of images the model will see in production.
- `dataset_size`: labelled examples available for training or fine-tuning.
- `compute_budget`: one of `edge` (phone, microcontroller), `serverless` (CPU-only inference, cold-start sensitive), `server_gpu` (T4/A10), `batch` (offline, any GPU).

## Method

1. Map compute budget to a parameter ceiling:
   - edge: <= 5M params
   - serverless: <= 25M params
   - server_gpu: <= 100M params
   - batch: no ceiling

2. Map dataset size to transfer-learning requirement:
   - < 1k labels: must fine-tune a pretrained backbone
   - 1k-100k: pretrained + short fine-tune, consider freezing early layers
   - > 100k: train from scratch is an option if compute allows

3. Eliminate families that do not fit:
   - LeNet only for MNIST-size tasks on tiny inputs.
   - VGG only if the benchmark requires VGG features; almost always dominated by ResNet on equal compute.
   - Plain ResNet-18/34 if compute is tight and receptive field requirements are modest.
   - ResNet-50 if you need strong ImageNet-pretrained features at server scale.
   - MobileNet / EfficientNet-Lite if `compute_budget == edge`.
   - ConvNeXt if `batch` budget and accuracy matters more than model simplicity.
   - Vision Transformer (ViT) if dataset is big enough (>= ImageNet-1k) and resolution is >= 224; otherwise prefer a CNN.

4. For non-classification tasks, adapt the head:
   - Detection: backbone feeds FPN -> RetinaNet / FCOS / DETR head.
   - Segmentation: backbone feeds U-Net / DeepLab head; keep skip connections at multiple resolutions.
   - Embedding: backbone feeds L2-normalised linear projection; train with triplet or contrastive loss.
   - OCR: backbone feeds a CTC or encoder-decoder sequence head; use a CNN + BiLSTM backbone (CRNN-style) when lines are long, or a ViT-based variant for full-page OCR.
   - Medical imaging: backbone plus task-appropriate head (classification, U-Net for segmentation); strongly prefer GroupNorm-based or domain-pretrained variants (RETFound, RadImageNet) when available.
   - Industrial inspection: backbone plus anomaly or segmentation head; at edge, an EfficientNet-Lite or MobileNetV3 backbone with a shallow classification head is the common shipping recipe.

## Output format

```
[recommendation]
  pick:     <family + size>
  params:   <approx>
  pretrain: <ImageNet-1k | ImageNet-21k | CLIP | domain-specific | none>
  reason:   <one sentence, grounded in dataset size and compute>

[runner-up 1]
  pick:    <family + size>
  tradeoff: <why we did not pick it>

[runner-up 2]
  pick:    <family + size>
  tradeoff: <why we did not pick it>

[plan]
  - stage: <freeze layers / train head / joint fine-tune>
  - input: <resize and crop policy>
  - aug:   <mixup/cutmix/randaug level>
  - eval:  <metric and threshold>
```

## Rules

- Always name a specific model size (ResNet-18, not "ResNet").
- Never recommend a backbone that exceeds the param ceiling.
- If the compute budget forbids the accuracy the task needs, say so and propose distillation or smaller input resolution instead of silently violating the budget.
- For `edge`, require a concrete quantisation plan (INT8 post-training or QAT).
- When dataset_size < 1k, forbid training from scratch regardless of compute.
