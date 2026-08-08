---
name: skill-image-tensor-inspector
description: 检查任何图像形状的张量或数组，报告数据类型、布局、范围以及它看起来是原始、归一化还是标准化
version: 1.0.0
phase: 4
lesson: 1
tags: [vision, preprocessing, tensors, debugging]
---

# 图像张量检查器

给定任何图像形状的张量或数组，检查并报告：

## 检查清单

1. **形状和布局**
   - 形状是(H, W, C)、(C, H, W)、(N, H, W, C)还是(N, C, H, W)？
   - 如果3D：是单张图像还是批次中的单张？
   - 如果4D：批次大小是多少？

2. **数据类型**
   - uint8、float16、float32、float64？
   - 量化模型可能使用int8

3. **值范围**
   - 最小值和最大值
   - 如果uint8且max<=255：可能是原始像素
   - 如果float且0<=max<=1：可能是归一化(/255)
   - 如果float且-1<=max<=1：可能是标准化(/127.5 - 1)
   - 如果float且mean≈0, std≈1：可能是ImageNet标准化

4. **通道顺序**
   - 检查前3个通道的均值：如果R>G>B可能是自然图像
   - 如果B>R可能是BGR（OpenCV默认）
   - 如果单通道：灰度

5. **可疑迹象**
   - 全零通道：可能预处理错误
   - 值>255的uint8：溢出
   - NaN或Inf：数值问题
   - 范围[0,1]的uint8：可能忘记转换类型

## 报告格式

```
Tensor Inspection Report
========================
Shape:        (N, C, H, W) = (batch=8, channels=3, height=224, width=224)
Layout:       NCHW (PyTorch convention)
Dtype:        float32
Value range:  [-2.12, 2.45]
Mean/std:     [0.02, 0.01, -0.01] / [1.01, 0.99, 1.00]
Assessment:   ImageNet standardized (mean≈0, std≈1)
Warnings:     None
```
