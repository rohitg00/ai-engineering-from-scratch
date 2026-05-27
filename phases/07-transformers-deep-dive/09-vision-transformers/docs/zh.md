# 视觉变换器（Vision Transformers, ViT）

> 图像是补丁的网格。句子是令牌的网格。同一个变换器两者都能处理。

**类型：** 构建
**语言：** Python
**前置要求：** 阶段 7 · 05（完整变换器），阶段 4 · 03（卷积神经网络），阶段 4 · 14（视觉变换器简介）
**时间：** 约45分钟

## 问题

2020年之前，计算机视觉意味着卷积。ImageNet、COCO以及所有检测基准上的SOTA模型都使用CNN作为主干。变换器则是为语言设计的。

Dosovitskiy等人（2020）——"一张图像价值16x16个词"——展示了可以完全去掉卷积。将图像切片成固定大小的补丁，将每个补丁线性投影为嵌入向量，将序列送入标准变换器编码器。在足够的规模下（ImageNet-21k预训练或更大），ViT匹配或超越基于ResNet的模型。

ViT是2026年更广泛模式的开始：一种架构，多种模态。Whisper对音频进行分词。ViT对图像进行分词。机器人学的动作令牌，视频的像素令牌。变换器不在乎——给它一个序列，它就能学习。

到2026年，ViT及其后代（DeiT, Swin, DINOv2, ViT-22B, SAM 3）主导了大多数视觉领域。CNN仍然在边缘设备和延迟敏感任务上获胜。其他所有任务都在堆栈的某处使用了ViT。

## 概念

![图像 → 补丁 → 令牌 → 变换器](../assets/vit.svg)

### 第1步——分块化（Patchify）

将一张`H × W × C`的图像分割成`N × (P·P·C)`的扁平补丁序列。典型设置：`224 × 224`图像，`16 × 16`补丁 → 196个补丁，每个包含768个值。

```
image (224, 224, 3) → 14 × 14 网格的 16x16x3 补丁 → 196 个长度为 768 的向量
```

补丁大小是杠杆。更小的补丁 = 更多令牌，更好分辨率，二次注意力代价。更大的补丁 = 更粗糙，更廉价。

### 第2步——线性嵌入（Linear Embedding）

一个单一的学习矩阵将每个扁平补丁投影到`d_model`。等价于核大小为`P`、步长为`P`的卷积。在PyTorch中，这实际上就是`nn.Conv2d(C, d_model, kernel_size=P, stride=P)`——两行代码实现。

### 第3步——前置`[CLS]`令牌，添加位置嵌入

- 前置一个可学习的`[CLS]`令牌。其最终隐藏状态是用于分类的图像表示。
- 添加可学习的位置嵌入（原始ViT）或正弦2D（后续变体）。
- 在2024年及以后，位置编码扩展到2D的RoPE，有时不需要显式嵌入。

### 第4步——标准变换器编码器

堆叠L个块：`层归一化 → 自注意力 → + → 层归一化 → MLP → +`。与BERT相同。没有视觉专用层。这是论文的教学核心。

### 第5步——头部（Head）

对于分类：取`[CLS]`隐藏状态 → 线性层 → softmax。对于DINOv2或SAM，丢弃`[CLS]`，直接使用补丁嵌入。

### 重要的变体

| 模型 | 年份 | 变化 |
|-------|------|--------|
| ViT | 2020 | 原始版本。固定补丁大小，全局注意力。 |
| DeiT | 2021 | 蒸馏；仅能在ImageNet-1k上训练。 |
| Swin | 2021 | 分层结构，带移位窗口。固定次二次成本。 |
| DINOv2 | 2023 | 自监督（无标签）。最佳通用视觉特征。 |
| ViT-22B | 2023 | 22B参数；适用扩展法则。 |
| SigLIP | 2023 | ViT+语言对，sigmoid对比损失。 |
| SAM 3 | 2025 | 分割一切；ViT-Large + 可提示掩码解码器。 |

### 为何花了些时间

ViT需要*大量*数据才能匹配CNN，因为它不具备CNN的归纳偏置（平移不变性、局部性）。在没有超过1亿张标注图像或强大的自监督预训练的情况下，CNN在同等计算量下仍然胜出。DeiT在2021年通过蒸馏技巧解决了这个问题；DINOv2在2023年通过自监督永久解决了这个问题。

## 构建它

参见 `code/main.py`。纯标准库实现的分块化 + 线性嵌入 + 合理性检查。无训练——任何实际规模的ViT都需要PyTorch和数小时的GPU时间。

### 第1步：假图像

一个24×24 RGB图像，表示为行的列表，每一行是`(R, G, B)`元组列表。我们使用6×6补丁 → 16个补丁，每个补丁108维嵌入向量。

### 第2步：分块化

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

光栅顺序：网格按行优先。所有ViT都使用此顺序。

### 第3步：线性嵌入

将每个扁平补丁乘以一个随机的`(patch_flat_size, d_model)`矩阵。在添加`[CLS]`后验证输出形状为`(N_patches + 1, d_model)`。

### 第4步：计算实际ViT的参数数量

打印ViT-Base的参数数量：12层，12头，d=768，补丁=16。与ResNet-50（约25M）比较。ViT-Base约为86M。ViT-Large约为307M。ViT-Huge约为632M。

## 使用它

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

**DINOv2嵌入是2026年图像特征的默认选择。** 冻结主干，训练一个小头部。适用于分类、检索、检测、字幕生成。Meta的DINOv2检查点在所有非文本视觉任务上优于CLIP。

**补丁大小选择。** 小模型使用16×16（ViT-B/16）。密集预测（分割）使用8×8或14×14（SAM, DINOv2）。非常大的模型使用14×14。

## 部署它

参见 `outputs/skill-vit-configurator.md`。技能选择一个ViT变体和补丁大小，用于给定数据集大小、分辨率和计算预算的新视觉任务。

## 练习

1. **简单。** 运行 `code/main.py`。验证补丁数量等于 `(H/P) * (W/P)`，且扁平补丁维度等于 `P*P*C`。
2. **中等。** 实现2D正弦位置嵌入——为每个补丁的`row`和`col`分别生成两个独立的正弦编码，然后拼接。将其送入一个微型PyTorch ViT，并在CIFAR-10上比较与可学习位置嵌入的准确率。
3. **困难。** 构建一个3层ViT（PyTorch），在1000张MNIST图像上使用4×4补丁进行训练。测量测试准确率。现在对同样的1000张图像添加DINOv2预训练（简化版：仅训练编码器从掩码补丁预测补丁嵌入）。准确率是否提升？

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------------|-----------------------|
| 补丁（Patch） | "视觉变换器的令牌" | 图像中一个`P × P × C`区域的像素值扁平向量。 |
| 分块化（Patchify） | "切碎+展平" | 将图像切片成不重叠的补丁，每个展平成向量。 |
| `[CLS]`令牌 | "图像摘要" | 前置可学习令牌；其最终嵌入是图像表示。 |
| 归纳偏置（Inductive bias） | "模型假定的先验" | ViT比CNN拥有更少的先验；需要更多数据来弥补差距。 |
| DINOv2 | "自监督ViT" | 使用图像增强+动量教师无标签训练。2026年最佳通用图像特征。 |
| SigLIP | "CLIP的继任者" | ViT + 文本编码器，使用sigmoid对比损失训练；在相同计算量下优于CLIP。 |
| Swin | "窗口化ViT" | 分层ViT，带局部注意力+移位窗口；次二次复杂度。 |
| 注册令牌（Register tokens） | "2023年技巧" | 少量额外可学习令牌，吸收注意力沉池；改善DINOv2特征。 |

## 进一步阅读

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929) — ViT论文。
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877) — DeiT。
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030) — Swin。
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193) — DINOv2。
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) — DINOv2的注册令牌修复。