---
name: skill-vit-patch-and-pos-embed-inspector
description: 检查ViT的patch和位置嵌入
version: 1.0.0
phase: 4
lesson: 14
tags: [vit, transformers, embeddings]
---

# ViT Patch和位置嵌入检查器

## Patch嵌入

```python
# 图像分块
# 输入: (B, C, H, W)
# 输出: (B, N, D)
# N = (H/P) * (W/P), P = patch_size

patch_size = 16
num_patches = (224 // 16) ** 2  # 196
embed_dim = 768
```

## 位置嵌入类型

| 类型 | 公式 | 特点 |
|------|------|------|
| 可学习 | nn.Parameter | 最常用，需训练 |
| 正弦 | sin/cos | 无需训练，可外推 |
| 相对 | 相对位置 | 更好的平移不变性 |
| 旋转（RoPE） | 旋转矩阵 | 长序列友好 |

## 检查清单

- [ ] Patch大小是否合适？（16x16标准）
- [ ] 位置嵌入维度是否匹配？
- [ ] 是否添加CLS token？
- [ ] 分辨率变化时位置嵌入是否插值？

## 分辨率调整

```python
# 高分辨率微调时插值位置嵌入
pos_embed = model.pos_embed
new_pos_embed = interpolate_pos_encoding(pos_embed, new_height, new_width)
model.pos_embed = nn.Parameter(new_pos_embed)
```
