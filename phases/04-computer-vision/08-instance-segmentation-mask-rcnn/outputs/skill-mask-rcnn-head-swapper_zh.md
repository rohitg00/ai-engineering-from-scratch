---
name: skill-mask-rcnn-head-swapper
description: 为不同任务修改Mask R-CNN头部
version: 1.0.0
phase: 4
lesson: 8
tags: [instance-segmentation, mask-rcnn, architecture]
---

# Mask R-CNN头部修改指南

## 标准Mask R-CNN结构

1. **RPN**（区域提议网络）：生成候选框
2. **RoI Align**：提取特征
3. **分类头**：预测类别和边界框
4. **掩码头**：预测分割掩码

## 常见修改

### 修改类别数
```python
# 替换分类头和掩码头
model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)
model.roi_heads.mask_predictor = MaskRCNNPredictor(in_features_mask, dim_reduced, num_classes)
```

### 添加关键点检测
```python
# 在Mask R-CNN基础上添加关键点头
model.roi_heads.keypoint_predictor = KeypointRCNNPredictor(in_features, num_keypoints)
```

### 修改骨干网络
```python
# 使用不同的骨干
backbone = resnet_fpn_backbone('resnet101', pretrained=True)
model = MaskRCNN(backbone, num_classes=num_classes)
```

## 训练技巧

- 先训练检测部分，再训练掩码部分
- 使用更大的输入分辨率提高掩码质量
- 掩码分支使用较小的学习率
