---
name: skill-image-tensor-inspector
description: 检查任何图像形状的张量或数组，报告数据类型、布局、数值范围，以及它是原始值、已归一化还是已标准化
version: 1.0.0
phase: 4
lesson: 1
tags: [computer-vision, debugging, preprocessing, tensors]
---

# 图像张量检查器（Image Tensor Inspector）

一个诊断技能，适用于视觉流水线中任何你持有一个图像形状数组并需要确切了解其状态的环节。

## 何时使用

- 预训练模型返回垃圾预测，你怀疑是预处理的问题。
- 在 OpenCV 和 torchvision 之间迁移流水线，通道顺序不明确。
- 从多个框架堆叠层，批次轴总是出现在错误的位置。
- 调试训练循环，损失卡在 `log(num_classes)`。

## 输入

- `x`：任何二维、三维或四维类数组（NumPy、PyTorch、JAX）。
- 可选 `expected`：一组要检查的不变性字典，例如 `{"layout": "CHW", "range": "standardized"}`。

## 步骤

1. **解析后端（Resolve backend）** — 检测 `x` 是 NumPy、Torch 还是 JAX。转换为 NumPy 进行检查，不改变原始数据。

2. **分类秩（Classify rank）**：
   - 秩 2 -> 单通道图像 (H, W)。
   - 秩 3 -> 如果最后一个轴为 1、3 或 4 且严格小于其他两个轴，则为 `HWC`；否则为 `CHW`。
   - 秩 4 -> 如果轴 1 属于 {1, 3, 4} **且**轴 2 或轴 3 大于 16，则优先选择 `NCHW`；否则优先选择 `NHWC`。纯轴 1 检查会错误分类小图像 NHWC 批次，如 `(3, 4, 224, 3)`。
   - 始终将模糊情况（例如 `(1, 3, 3, 3)`）标记为 `ambiguous`，而不是猜测；要求调用者提供 `expected`。

3. **分类数据类型和数值范围（Classify dtype and range）**：
   - `uint8` 在 [0, 255] 范围内 -> `raw`。
   - `float*` 且最小值 >= 0 且最大值 <= 1.01 -> `normalized`。
   - `float*` 且最小值 < 0 且 |mean| < 0.5 且 0.5 <= std <= 1.5 -> `standardized`。
   - 其他情况 -> `unusual`，打印直方图。

4. **每个通道的统计量（Per-channel stats）** — 报告每个通道的均值和标准差。如果数组看起来已标准化，则与 ImageNet 的均值/标准差进行比较并显示匹配置信度。

5. **报告（Report）**，格式如下：

```
[inspector]
  backend:   numpy | torch | jax
  rank:      2 | 3 | 4
  layout:    HW | HWC | CHW | NHWC | NCHW
  dtype:     <数据类型>
  shape:     <形状>
  range:     raw | normalized | standardized | unusual
  min/max:   <最小值> / <最大值>
  per-channel mean: [ ... ]
  per-channel std:  [ ... ]
  likely source:    camera | PIL | OpenCV | torchvision | random init
  likely target:    display | training | inference
```

6. **根据 `likely target` 推荐下一步操作**：
   - 对于 `display`：转置为 HWC，裁剪，转换为 uint8。
   - 对于 `training`：使用数据集统计量进行标准化，转置为 CHW，添加批次轴。
   - 对于 `inference`：匹配模型卡中的确切不变性。

## 规则

- 绝不修改输入。仅打印诊断信息。
- 如果提供了 `expected`，标记每个不匹配项，格式为 `[expected X got Y]`。
- 当布局或通道顺序不明确时，指出静默失败风险。
- 一次推荐一个操作，而不是一组选项。
