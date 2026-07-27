---
name: skill-segmentation-mask-inspector
description: 报告类别分布、预测掩码统计量以及最容易被预测不足或边界模糊的类别
version: 1.0.0
phase: 4
lesson: 7
tags: [computer-vision, segmentation, debugging, evaluation]
---

# 分割掩码检查器（Segmentation Mask Inspector）

一种诊断"损失下降了"与"掩码看起来正确"之间差距的工具。

## 何时使用

- 训练运行之后，mIoU 看起来不错但目视检查显示情况并非如此时。
- 部署之前：检查预测结果与真实标签之间的类别平衡。
- 当大物体的每类 IoU 很高但小物体的 IoU 很低时。
- 调试边界伪影——这些伪影因像素数量少而不在 IoU 中显现。

## 输入

- `preds`：(N, H, W) 的张量，预测的类别 ID。
- `targets`：(N, H, W) 的张量，真实的类别 ID。
- `num_classes`：整数。
- 可选 `class_names`：C 个字符串的列表。

## 步骤

1. **类别像素直方图。** 计算 `preds` 和 `targets` 中每个类别的像素百分比。标记任何 `|pred% - gt%| / max(gt%, 1e-6) > 0.30`（相对偏差超过 30%）的类别。对于真实标签中不存在的类别（`gt% == 0`），直接标记任何预测占比超过 `0.3` 的类别。

2. **每类 IoU** 和**每类边界 F1（boundary F1）**。边界 F1 通过将每个掩码扩张 3 个像素、取交集并评分来计算。IoU > 0.7 但边界 F1 < 0.5 的类别存在边缘模糊问题。

3. **小目标召回率。** 将每个真实标签连通分量按尺寸分桶（tiny < 100 px，small < 1000 px，medium < 10000 px，large >= 10000 px）。报告每个类别每个桶的召回率。小目标召回率低于 0.3 而大目标召回率高于 0.9 表明存在分辨率/感受野问题。

4. **混淆对。** 对于每个类别，找出它最常与之混淆的类别（在其真实掩码内最常见的错误预测类别）。报告前三对。

5. **饱和检查（需要 `probs` 或 `logits`，而非仅 `preds`）。** 如果调用者传入原始逐像素概率分布 `probs: (N, C, H, W)`，计算每个类别中 `probs.max(dim=1) > 0.99` 的像素比例。高饱和度（>0.9 类别的像素）表明过度自信——适合进行标签平滑或校准。当只有 argmax 后的 `preds` 可用时，跳过此步骤并在报告中注明。

## 报告格式

```
[mask-inspector]
  classes: C

[class distribution]
  name       gt %    pred %   delta
  ...

[metrics]
  class       IoU     bF1    recall_tiny  recall_small  recall_medium  recall_large
  ...

[confusion pairs]
  class A confused with class B: <N> pixels (最常见)
  class B confused with class A: <N> pixels
  ...

[verdict]
  most impactful issue: <一句话>
```

## 规则

- 按真实像素占比降序排列类别行，使最常见的类别排在前面。
- 标记 IoU < 0.4 或边界 F1 < 0.3 的类别为 `critical`。
- 当小目标召回率是主要失败原因时，建议：更高分辨率训练、最后一个编码器阶段使用更小步长、或特征金字塔解码器。
- 当边界 F1 是主要失败原因时，建议：边界感知损失（Lovasz 或 BoundaryLoss）、水平翻转的 TTA 以及无步长解码器。
- 绝不将类别索引作为唯一标识符输出；如果提供了 `class_names`，在每一行中使用它。
