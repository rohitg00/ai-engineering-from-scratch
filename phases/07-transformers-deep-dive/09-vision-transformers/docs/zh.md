# 09 · 视觉 Transformer（ViT）

> 一张图像是一个由图块（patch）组成的网格。一个句子是一个由 token 组成的网格。同一个 transformer 两者通吃。

**类型：** 实战构建
**语言：** Python
**前置：** 阶段 7 · 05（完整 Transformer）、阶段 4 · 03（卷积神经网络）、阶段 4 · 14（视觉 Transformer 入门）
**时长：** 约 45 分钟

## 问题所在

在 2020 年之前，计算机视觉就意味着卷积。ImageNet、COCO 以及各类检测基准上的每一个 SOTA（state-of-the-art，最先进水平）模型都使用 CNN 主干网络。Transformer 是属于语言的。

Dosovitskiy 等人（2020）——「An Image is Worth 16x16 Words」（一张图像值 16x16 个词）——证明了你可以完全抛弃卷积。把一张图像切成固定大小的图块，对每个图块做线性投影得到一个嵌入向量，然后把这个序列喂给一个标准的 transformer 编码器。在足够大的规模下（ImageNet-21k 预训练或更大），ViT 能够匹敌甚至超越基于 ResNet 的模型。

ViT 拉开了 2026 年一个更宏大模式的序幕：一种架构，多种模态。Whisper 把音频 token 化。ViT 把图像 token 化。机器人领域有动作 token。视频有像素 token。transformer 并不在意——给它一个序列，它就去学。

到 2026 年，ViT 及其后代（DeiT、Swin、DINOv2、ViT-22B、SAM 3）占据了视觉领域的大部分江山。CNN 在边缘设备和延迟敏感任务上仍然胜出。除此之外，几乎所有场景的技术栈里都有 ViT 的身影。

## 核心概念

〔图：图像 → 图块 → token → transformer〕

### 第 1 步——图块化（patchify）

把一张 `H × W × C` 的图像切分成一个 `N × (P·P·C)` 的扁平图块序列。典型配置：`224 × 224` 图像，`16 × 16` 图块 → 196 个图块，每个 768 个值。

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

图块大小（patch size）是关键杠杆。图块越小 = token 越多、分辨率越高、注意力开销呈二次方增长。图块越大 = 越粗粒度、越省算力。

### 第 2 步——线性嵌入

一个单一的可学习矩阵把每个扁平图块投影到 `d_model` 维。这等价于一个核大小为 `P`、步长为 `P` 的卷积。在 PyTorch 中这就是字面意义上的 `nn.Conv2d(C, d_model, kernel_size=P, stride=P)`——2 行代码的实现。

### 第 3 步——前置 `[CLS]` token，加入位置嵌入

- 在序列前面加一个可学习的 `[CLS]` token。它最终的隐藏状态就是用于分类的图像表示。
- 加入可学习的位置嵌入（ViT 原版），或正弦 2D 位置编码（后续变体）。
- 在 2024 年及之后，RoPE（旋转位置编码）被扩展到 2D 来表示位置，有时甚至不需要显式的位置嵌入。

### 第 4 步——标准 transformer 编码器

堆叠 L 个 `LayerNorm → Self-Attention → + → LayerNorm → MLP → +` 的模块。与 BERT 完全相同。没有任何视觉专用的层。这正是这篇论文在教学上的精髓所在。

### 第 5 步——输出头

用于分类：取 `[CLS]` 隐藏状态 → 线性层 → softmax。对于 DINOv2 或 SAM，丢弃 `[CLS]`，直接使用图块嵌入。

### 重要的变体

| 模型 | 年份 | 改动 |
|-------|------|------|
| ViT | 2020 | 原始版本。固定图块大小，完整的全局注意力。 |
| DeiT | 2021 | 蒸馏；仅用 ImageNet-1k 即可训练。 |
| Swin | 2021 | 带移位窗口的层次化结构。把开销降到次二次方。 |
| DINOv2 | 2023 | 自监督（无标签）。最佳的通用视觉特征。 |
| ViT-22B | 2023 | 220 亿参数；缩放定律生效。 |
| SigLIP | 2023 | ViT + 语言配对，sigmoid 对比损失。 |
| SAM 3 | 2025 | 分割万物；ViT-Large + 可提示的掩码解码器。 |

### 为什么花了一段时间

ViT 需要*大量*数据才能匹敌 CNN，因为它完全没有 CNN 那些归纳偏置（inductive bias）——平移不变性、局部性。如果没有超过 1 亿张带标签图像或强力的自监督预训练，在算力相当的情况下 CNN 仍然胜出。DeiT 在 2021 年用蒸馏技巧解决了这个问题；DINOv2 在 2023 年用自监督彻底解决了它。

## 动手构建

参见 `code/main.py`。纯标准库实现的图块化 + 线性嵌入 + 合理性检查。不做训练——任何现实规模的 ViT 都需要 PyTorch 和数小时的 GPU 时间。

### 第 1 步：伪造图像

一张 24 × 24 的 RGB 图像，表示为一个由若干行 `(R, G, B)` 元组组成的列表。我们使用 6×6 的图块 → 16 个图块，每个嵌入向量 108 维。

### 第 2 步：图块化

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

光栅顺序：在网格上按行优先（row-major）遍历。每个 ViT 都使用这个顺序。

### 第 3 步：线性嵌入

把每个扁平图块乘以一个随机的 `(patch_flat_size, d_model)` 矩阵。验证在前置 `[CLS]` 后输出形状为 `(N_patches + 1, d_model)`。

### 第 4 步：为一个现实的 ViT 计算参数量

打印 ViT-Base 的参数量：12 层，12 个注意力头，d=768，patch=16。对比 ResNet-50（约 25M）。ViT-Base 落在约 86M。ViT-Large 约 307M。ViT-Huge 约 632M。

## 实际使用

```python
from transformers import ViTImageProcessor, ViTModel
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained("google/vit-base-patch16-224-in21k")
model = ViTModel.from_pretrained("google/vit-base-patch16-224-in21k")

img = Image.open("cat.jpg")
inputs = processor(img, return_tensors="pt")
out = model(**inputs).last_hidden_state   # (1, 197, 768): [CLS] + 196 个图块
cls_emb = out[:, 0]                       # 图像表示
```

**DINOv2 嵌入是 2026 年图像特征的默认选择。** 冻结主干网络，训练一个微小的输出头即可。适用于分类、检索、检测、图像描述。Meta 的 DINOv2 检查点在每一项非文本视觉任务上都优于 CLIP。

**图块大小的选择。** 小模型用 16×16（ViT-B/16）。密集预测（分割）用 8×8 或 14×14（SAM、DINOv2）。超大模型用 14×14。

## 交付上线

参见 `outputs/skill-vit-configurator.md`。这个技能会根据数据集大小、分辨率和算力预算，为一个新的视觉任务挑选 ViT 变体和图块大小。

## 练习

1. **简单。** 运行 `code/main.py`。验证图块数量等于 `(H/P) * (W/P)`，且扁平图块维度等于 `P*P*C`。
2. **中等。** 实现 2D 正弦位置嵌入——为每个图块的 `row` 和 `col` 各生成一个独立的正弦编码，然后拼接起来。把它们喂给一个微型的 PyTorch ViT，在 CIFAR-10 上对比可学习位置嵌入的准确率。
3. **困难。** 构建一个 3 层的 ViT（PyTorch），用 4×4 图块在 1000 张 MNIST 图像上训练。测量测试准确率。现在在同样这 1000 张图像上加入 DINOv2 预训练（简化版：只训练编码器从被掩码的图块中预测图块嵌入）。准确率提升了吗？

## 关键术语

| 术语 | 人们口中的说法 | 它的实际含义 |
|------|-----------------|-----------------------|
| Patch（图块） | 「视觉 transformer 的 token」 | 图像中一个 `P × P × C` 区域的像素值的扁平向量。 |
| Patchify（图块化） | 「切块 + 展平」 | 把图像切成互不重叠的图块，把每个展平成一个向量。 |
| `[CLS]` token | 「图像摘要」 | 前置的可学习 token；其最终嵌入就是图像表示。 |
| Inductive bias（归纳偏置） | 「模型的先验假设」 | ViT 的先验比 CNN 少；需要更多数据来弥补这个差距。 |
| DINOv2 | 「自监督 ViT」 | 用图像增强 + 动量教师（momentum teacher）在无标签下训练。2026 年最佳的通用图像特征。 |
| SigLIP | 「CLIP 的继任者」 | ViT + 文本编码器，用 sigmoid 对比损失训练；在算力相当时优于 CLIP。 |
| Swin | 「窗口化 ViT」 | 带局部注意力 + 移位窗口的层次化 ViT；次二次方复杂度。 |
| Register tokens（寄存器 token） | 「2023 年的技巧」 | 几个额外的可学习 token，用来吸收注意力沉降（attention sink）；改善 DINOv2 特征。 |

## 延伸阅读

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929) —— ViT 论文。
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) —— DeiT。
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030) —— Swin。
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193) —— DINOv2。
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) —— 针对 DINOv2 的寄存器 token 修正方案。
