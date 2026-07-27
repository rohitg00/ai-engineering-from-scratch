---
name: skill-vit-patch-and-pos-embed-inspector
description: 验证 ViT 的补丁嵌入和位置嵌入的形状是否与模型期望的序列长度匹配
version: 1.0.0
phase: 4
lesson: 14
tags: [vision-transformer, debugging, pytorch]
---

# ViT 补丁和位置嵌入检查器

最常见的 ViT 移植错误：将在 224x224 上预训练的检查点加载到配置为 384x384 的模型中（反之亦然）。位置嵌入的序列长度错误，模型静默地产生垃圾输出。

## 使用时机

- 在非默认分辨率下微调预训练的 ViT。
- 审计 ViT-B/16 和 ViT-B/32 之间的权重移植为何失败；检查器会标记补丁大小不匹配，以便调用者知道应切换架构而非强制移植。
- 调试加载无误但训练效果差的 ViT。

## 输入

- `model`：实例化的 ViT `nn.Module`。
- `expected_image_size`：模型在生产中看到的 H x W。
- `patch_size`：期望的补丁大小。

## 步骤

1. 定位模型内的补丁嵌入卷积层。报告其 `kernel_size`、`stride`、`in_channels`、`out_channels`。
2. 计算期望的补丁数量。对于方形图像：`(image_size / patch_size)^2`。对于矩形：`(H / patch_size) * (W / patch_size)`。要求 `H % patch_size == 0` 且 `W % patch_size == 0`；否则标记并拒绝。
3. 定位学习到的位置嵌入。报告其形状 `(1, N, dim)`。
4. 比较 `N` 与 `num_patches + 1`（含 CLS）或 `num_patches`（不含 CLS）。不匹配意味着检查点是在不同分辨率或补丁大小下预训练的。
5. 检查补丁卷积的 `out_channels` 是否等于位置嵌入的 `dim`。
6. 如果模型应该为新分辨率插值位置嵌入，验证插值工具是否存在（大多数 `timm` ViT 通过 `resize_pos_embed` 自动实现）。

## 报告

```
[vit-inspector]
  image_size:         HxW
  patch_size:         <整数>
  num_patches (computed): <整数>
  patch_conv:         k=<整数>  s=<整数>  in=<整数>  out=<整数>
  pos_embed shape:    (1, N, dim)
  has CLS token:      yes | no
  pos_embed N:        <整数>    expected: <整数>
  verdict:            ok | mismatch（匹配 | 不匹配）

[if mismatch]
  action:  为新序列长度重新初始化位置嵌入
  tool:    timm.models.vision_transformer.resize_pos_embed
```

## 规则

- 绝不静默插值而不发出警告；公示操作以便用户知道预训练的位置结构可能已发生变化。
- 如果补丁大小不匹配，拒绝推荐插值——切换到正确的架构。
- 不要试图就地修复模型；报告并给出建议。
