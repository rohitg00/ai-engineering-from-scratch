# Vision Transformers (ViT)

> 图像是补丁的网格，句子是词元的网格。同一个 Transformer 两者通吃。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 05（完整 Transformer）、Phase 4 · 03（CNN）、Phase 4 · 14（Vision Transformers 入门）
**Time:** 约 45 分钟

## 问题所在

2020 年之前，计算机视觉等同于卷积。ImageNet、COCO 以及各类检测基准上的所有 SOTA 都使用 CNN 骨干网络。Transformer 只属于语言领域。

Dosovitskiy 等人（2020）——"An Image is Worth 16x16 Words"——证明可以完全抛弃卷积。把图像切成固定大小的补丁，将每个补丁线性投影为嵌入，然后把序列输入一个原生的 transformer 编码器。在足够大的规模下（ImageNet-21k 预训练或更大），ViT 可以匹敌甚至超越基于 ResNet 的模型。

ViT 开启了 2026 年一个更广泛的模式：一种架构，多种模态。Whisper 将音频词元化，ViT 将图像词元化，机器人技术中有动作词元，视频中有像素词元。Transformer 并不在意——喂给它一个序列，它就能学习。

到 2026 年，ViT 及其衍生模型（DeiT、Swin、DINOv2、ViT-22B、SAM 3）主导了绝大多数视觉任务。CNN 在边缘设备和延迟敏感的任务上仍然占优。其他几乎所有系统的技术栈中都有 ViT 的身影。

## 核心概念

![Image → patches → tokens → transformer](../assets/vit.svg)

### 第 1 步 — patchify

将 `H × W × C` 的图像切分为扁平补丁的 `N × (P·P·C)` 序列。典型设置：`224 × 224` 图像、`16 × 16` 补丁 → 196 个补丁，每个 768 个值。

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

补丁大小是可调的杠杆。补丁越小 = 词元越多、分辨率越高、注意力代价呈二次增长。补丁越大 = 粒度越粗、成本越低。

### 第 2 步 — 线性嵌入

用一个可学习的矩阵把每个扁平补丁投影到 `d_model`。等价于卷积核大小为 `P`、步幅为 `P` 的卷积。在 PyTorch 中这实际上就是 `nn.Conv2d(C, d_model, kernel_size=P, stride=P)`——两行代码的实现。

### 第 3 步 — 前置 `[CLS]` 词元，加入位置嵌入

- 前置一个可学习的 `[CLS]` 词元。其最终隐藏状态就是用于分类的图像表示。
- 加入可学习的位置嵌入（原版 ViT）或二维正弦位置编码（后续变体）。
- 2024 年以后，RoPE 被扩展到二维位置，有时甚至完全不用显式嵌入。

### 第 4 步 — 标准 transformer 编码器

堆叠 L 层 `LayerNorm → Self-Attention → + → LayerNorm → MLP → +`。与 BERT 完全相同，没有任何视觉专用层。这正是这篇论文的教学核心。

### 第 5 步 — 输出头

分类任务：取 `[CLS]` 隐藏状态 → 线性层 → softmax。对于 DINOv2 或 SAM：丢弃 `[CLS]`，直接使用补丁嵌入。

### 产生影响的变体

| 模型 | 年份 | 变化 |
|-------|------|--------|
| ViT | 2020 | 原创版本。固定补丁大小，完整的全局注意力。 |
| DeiT | 2021 | 蒸馏；仅用 ImageNet-1k 即可训练。 |
| Swin | 2021 | 基于移位窗口的层级结构。固定次二次复杂度。 |
| DINOv2 | 2023 | 自监督（无标签）。最佳通用视觉特征。 |
| ViT-22B | 2023 | 220 亿参数；缩放定律依然适用。 |
| SigLIP | 2023 | ViT + 语言配对，sigmoid 对比损失。 |
| SAM 3 | 2025 | 分割一切；ViT-Large + 可提示掩码解码器。 |

### 为什么它姗姗来迟

ViT 需要大量数据才能匹敌 CNN，因为它不具备 CNN 的任何归纳偏置（平移不变性、局部性）。在超过 1 亿张标注图像或强大的自监督预训练缺失时，相同计算量下 CNN 仍然更强。DeiT 在 2021 年用蒸馏技巧部分解决了这一问题；DINOv2 在 2023 年用自监督彻底解决了它。

```figure
n5-patch-stream
```

## 动手构建

参见 `code/main.py`。纯标准库实现 patchify + 线性嵌入 + 合理性检查。不涉及训练——任何现实规模的 ViT 都需要 PyTorch 和数小时的 GPU 时间。

### 第 1 步：伪造图像

一张 24 × 24 的 RGB 图像，表示为 `(R, G, B)` 元组的行列表。我们使用 6×6 补丁 → 16 个补丁，每个补丁 108 维嵌入向量。

### 第 2 步：patchify

```python
def patchify(image, P):
    H = len(image)
    W = len(image[0])
    patches = []
    for i in range(0, H, P):
        for j in range(0, W, P):
            patch = []
            for di in range(P):
                for dj in range(P):
                    patch.extend(image[i + di][j + dj])
            patches.append(patch)
    return patches
```

光栅顺序：按行优先遍历网格。所有 ViT 都使用这种顺序。

### 第 3 步：线性嵌入

将每个扁平补丁乘以随机的 `(patch_flat_size, d_model)` 矩阵。验证前置 `[CLS]` 后的输出形状为 `(N_patches + 1, d_model)`。

### 第 4 步：计算真实 ViT 的参数量

打印 ViT-Base 的参数量：12 层、12 个头、d=768、patch=16。与 ResNet-50（约 25M）对比。ViT-Base 约 86M，ViT-Large 约 307M，ViT-Huge 约 632M。

## 实际应用

```python
from transformers import ViTImageProcessor, ViTModel
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224-in21k")
model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

img = Image.open("cat.jpg")
inputs = processor(img, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, 197, 768): [CLS] + 196 patches
cls_emb = out[:, 0]                       # image representation
```

**DINOv2 嵌入是 2026 年图像特征的默认选择。** 冻结骨干网络，训练一个小型头部。适用于分类、检索、检测、图像描述。Meta 的 DINOv2 检查点在所有非文本视觉任务上都优于 CLIP。

**补丁大小的选择。** 小型模型使用 16×16（ViT-B/16）。密集预测任务（分割）使用 8×8 或 14×14（SAM、DINOv2）。超大型模型使用 14×14。

## 上线部署

参见 `outputs/skill-vit-configurator.md`。该技能根据数据集大小、分辨率和计算预算，为新视觉任务选择 ViT 变体和补丁大小。

## 练习

1. **简单。** 运行 `code/main.py`。验证补丁数量等于 `(H/P) * (W/P)`，且扁平补丁的维度等于 `P*P*C`。
2. **中等。** 实现二维正弦位置嵌入——为每个补丁的 `row` 和 `col` 分别使用两组独立的正弦编码，然后拼接。将其输入一个小型 PyTorch ViT，在 CIFAR-10 上与可学习位置嵌入比较准确率。
3. **困难。** 构建一个 3 层 ViT（PyTorch），使用 4×4 补丁在 1,000 张 MNIST 图像上训练。测量测试准确率。然后在这同一千张图像上加入 DINOv2 预训练（简化版：仅训练编码器从被掩码的补丁预测补丁嵌入）。准确率是否提升？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 补丁 (Patch) | “视觉 Transformer 的词元” | 图像中一个 `P × P × C` 区域的像素值扁平向量。 |
| Patchify | “切块 + 展平” | 将图像切分为不重叠的补丁，并将每个补丁展平为向量。 |
| `[CLS]` 词元 | “图像摘要” | 前置的可学习词元；其最终嵌入即为图像表示。 |
| 归纳偏置 (Inductive bias) | “模型的先验假设” | ViT 的先验假设比 CNN 少；需要更多数据来弥补差距。 |
| DINOv2 | “自监督 ViT” | 使用图像增广 + 动量教师进行无标签训练。2026 年最佳的通用图像特征。 |
| SigLIP | “CLIP 的继任者” | 使用 sigmoid 对比损失训练的 ViT + 文本编码器；在相同计算量下优于 CLIP。 |
| Swin | “窗口化 ViT” | 局部注意力 + 移位窗口的层级 ViT；次二次复杂度。 |
| Register 词元 | “2023 年的技巧” | 少量额外的可学习词元，用于吸收注意力汇聚点；改进了 DINOv2 特征。 |

## 延伸阅读

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929) — ViT 论文。
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) — DeiT。
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030) — Swin。
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193) — DINOv2。
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) — DINOv2 的 register 词元修复方案。