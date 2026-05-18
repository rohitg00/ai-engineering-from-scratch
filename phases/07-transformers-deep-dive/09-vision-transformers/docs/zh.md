# 视觉变形金刚（ViT）

> 图像是补丁网格。句子是一个符号网格。同一个Transformer会吃掉两者。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 7 · 05期（全Transformer）、4 · 03期（CNN）、4 · 14期（Vision Transformers简介）
** 时间：** ~45分钟

## 问题

2020年之前，计算机视觉意味着复杂。ImageNet、COCO和检测基准上的每个SOTA都使用CNN主干网。变形金刚是为了语言。

Dosovitskiy等人（2020）--“一个图像值得16 x16言语”--表明你可以完全放弃复杂的事情。将图像切片成固定大小的补丁，将每个补丁线性投影到嵌入中，将序列馈送到vanilla Transformer编码器。在足够的规模下（ImageNet-21 k预训练或更大），ViT可以匹配或击败基于ResNet的模型。

ViT是2026年更广泛模式的开始：一个架构，多种模式。耳语标记音频。ViT标记图像。机器人的动作代币。视频的像素令牌。Transformer不在乎--给它一个序列，它就会学习。

到2026年，ViT及其后代（DeiT、Swin、DINOv 2、ViT-22 B、Sam 3）将拥有大部分愿景。CNN仍然在边缘设备和延迟敏感任务中获胜。其他内容在堆栈中的某个地方都有ViT。

## 概念

![Image → patches → tokens → transformer](../assets/vit.svg)

### 第1步-补丁

将“H * W * C”图像拆分为“N *（P·P·C）”平坦斑块序列。典型设置：“224 x 224”图像，“16 x 16”补丁-196个补丁，每个补丁有768个值。

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

补丁大小是杠杆。较小的补丁=更多的令牌、更好的分辨率、二次注意力成本。更大的补丁=更粗糙、更便宜。

### 第2步-线性嵌入

单个学习矩阵将每个平坦补丁投影到“d_模型”。相当于核大小“P”和跨度“P”的卷积。在PyTorch中，这实际上是' nn.Conv2d（C，d_mode，core_size=P，stride=P）'-一个2行实现。

### 第3步-前置“[LIS]'标记，添加位置嵌入

- 前置一个可学习的“[LIS]'令牌。其最终隐藏状态是用于分类的图像表示。
- 添加可学习的位置嵌入（ViT原始）或2D曲线（后来的变体）。
- 2024年+ RoPE扩展到2D位置，有时没有明确的嵌入。

### 步骤4 -标准Transformer编码器

堆栈L块' LayerNorm ' Self-Attention '+'。与BERT相同。没有特定于视觉的层。这是论文的教学妙语。

### 第5步-头

对于分类：取“[LIS]”隐藏状态→线性→ softmax。对于DINOv2或Sam，放弃“[LIS]”，直接使用补丁嵌入。

### 重要的变体

| 模型 | 年 | 变化 |
|-------|------|--------|
| ViT | 2020 | 原始.固定补丁大小，全球关注。 |
| 戴特 | 2021 | 蒸馏;仅可在ImageNet-1 k上训练。 |
| Swin | 2021 | 具有移位窗口的分层结构。固定次二次成本。 |
| DINOv2 | 2023 | 自我监督（无标签）。最佳一般视觉功能。 |
| ViT-22 B | 2023 | 22 B参数;适用缩放定律。 |
| SigLIP | 2023 | ViT +语言对，Sigmoid对比损失。 |
| Sam 3 | 2025 | 分段任何内容; ViT-Large +可扩展的屏蔽解码器。 |

### 为什么花了一段时间

ViT需要 * 大量 * 数据来匹配CNN，因为它没有CNN归纳偏差（翻译不变性、局部性）。如果没有超过100 M个标记图像或强大的自我监督预训练，CNN仍然在匹配计算中获胜。DeiT在2021年通过蒸馏技巧解决了这个问题; DINOv 2在2023年通过自我监督永久解决了这个问题。

## 建设党

请参阅' code/main.py '。纯stdlib补丁+线性嵌入+健全检查。无需培训-任何现实规模的ViT都需要PyTorch和数小时的图形处理时间。

### 第1步：伪造图像

24 x 24的RB图像，作为“（R，G，B）”组行列表。我们使用6 x 6个补丁-16个补丁，每个补丁108-d嵌入载体。

### 第2步：补丁

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

网格顺序：网格中的行主要。每个ViT都使用此顺序。

### 第3步：线性嵌入

将每个平坦补丁乘以随机的“（patch_flat_size，d_型号）”矩阵。验证输出形状在前置“[LIS]”后是否为“（N_patches + 1，d_型号）”。

### 第4步：计算真实ViT的参数

打印ViT-Base的参数计数：12层，12个头，d=768，贴片=16。与ResNet-50（~ 25 M）相比。ViT-Base的浓度为~ 86 M。ViT-Large ~ 307 M。ViT-Huge ~ 632 M。

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

** DINOv 2嵌入是2026年图像功能的默认值。**冻结脊柱，训练小脑袋。用于分类、检索、检测、字幕。Meta的DINOv2检查点在每个非文本视觉任务上都优于CLIP。

** 贴片大小的挑选。**小型号使用16 x 16（ViT-B/16）。密集预测（分段）使用8 x 8或14 x 14（Sam，DINOv 2）。非常大的型号使用14 x 14。

## 把它运

请参阅“输出/skill-vit-configurator.md”。根据数据集大小、分辨率和计算预算，该技能为新的视觉任务选择ViT变体和补丁大小。

## 演习

1. ** 简单。**运行'代码/main.py '。验证贴片数量等于“（H/P）*（W/P）”并且平坦贴片尺寸等于“P*P*C”。
2. ** 中等。**实现2D sin位置嵌入-每个补丁的“行”和“col”的两个独立的sin代码，级联。将它们输入到一个小型的PyTorch ViT中，并比较准确性与CIFAR-10上的可学习位置嵌入。
3. ** 很难。**构建3层ViT（PyTorch），在1，000张MNIST图像上训练，带有4 x 4补丁。衡量测试准确性。现在在相同的1，000张图像上添加DINOv2预训练（简化：只需训练编码器从掩蔽补丁预测补丁嵌入）。准确性是否提高？

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 贴片 | “愿景转换者代币” | 图像“P * P * C”区域的像素值的平坦载体。 |
| 补丁 | “砍+压平” | 将图像切片为不重叠的块，将每个块压平为一个载体。 |
| '[LIS]'令牌 | “图像摘要” | 前置可学习令牌;其最终嵌入是图像表示。 |
| 归纳偏置 | “模型假设什么” | ViT的先验比CNN少;需要更多数据来弥补差距。 |
| DINOv2 | “自我监督ViT” | 使用图像增强+动量老师进行无标签培训。2026年最佳综合图像专题。 |
| SigLIP | “CLIP的继任者” | ViT +文本编码器使用Sigmoid对比损失进行训练;在匹配计算上优于CLIP。 |
| Swin | “窗口ViT” | 具有局部注意力+移动窗口的分层ViT;次二次。 |
| 注册代币 | “2023年伎俩” | 一些额外的可学习代币可以吸收注意力;改进了DINOv 2功能。 |

## 进一步阅读

- [Dosovitskiy等人（2020）。图像值得16 x 16字：大规模图像识别变形金刚]（https：//arxiv.org/ab/2010.11929）-ViT论文。
- [Touvron等人（2021）。通过注意力培训数据高效的图像转换器和提炼]（https：//arxiv.org/ab/2012.12877）- DeiT。
- [Liu等人（2021）。Swin Transformer：使用Shifted Windows的分层视觉转换器]（https：//arxiv.org/ab/2103.14030）- Swin。
- [Oquab等人（2023）。DINOv 2：无需监督即可学习稳健的视觉功能]（https：//arxiv.org/ab/2304.07193）-DINOv 2。
- [Darcet等人（2023）。Vision Transformers需要寄存器]（https：//arxiv.org/abs/2309.16588）-DINOv 2的寄存器令牌修复。
