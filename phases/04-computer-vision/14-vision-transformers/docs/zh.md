# Vision Transformers (ViT)

> 将图像切成小块，将每个小块视为一个单词，运行标准transformer。不要回头。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段7 第02课（自注意力），阶段4 第04课（图像分类）
**时间：** ~45分钟

## 学习目标

- 从零实现patch embedding、学习的位置嵌入、类别token和transformer编码器块，构建最小ViT
- 解释为什么ViT被认为需要大规模预训练数据，直到DeiT和MAE证明并非如此
- 比较ViT、Swin和ConvNeXt的架构先验（无、局部窗口注意力、conv backbone）
- 使用`timm`和标准的linear-probe/微调配方在小型数据集上微调预训练ViT

## 问题

十年来，卷积一直是计算机视觉的同义词。CNN具有强归纳偏置——局部性、平移等变性——没有人认为你可以替换它们。然后Dosovitskiy等人（2020）展示了一个应用于展平图像块的普通transformer，没有任何卷积机制，可以在规模上匹配或击败最好的CNN。

问题在于"在规模上"。在ImageNet-1k上的ViT输给了ResNet。在ImageNet-21k或JFT-300M上预训练然后在ImageNet-1k上微调的ViT击败了它。结论是transformer缺乏有用的先验知识，但可以从足够的数据中学习它们。后续工作（DeiT、MAE、DINO）表明，通过正确的训练配方——强数据增强、自监督预训练、蒸馏——ViT在小数据上也能良好训练。

到2026年，纯CNN在边缘设备上仍然有竞争力（ConvNeXt最强），但transformer主导了其他一切：分割（Mask2Former、SegFormer）、检测（DETR、RT-DETR）、多模态（CLIP、SigLIP）、视频（VideoMAE、VJEPA）。ViT块结构是需要了解的那个。

## 概念

### 管道

```mermaid
flowchart LR
    IMG["图像<br/>(3, 224, 224)"] --> PATCH["Patch embedding<br/>conv 16x16 s=16<br/>-> (768, 14, 14)"]
    PATCH --> FLAT["展平为<br/>(196, 768) tokens"]
    FLAT --> CAT["前置<br/>[CLS] token"]
    CAT --> POS["添加学习到的<br/>位置嵌入"]
    POS --> ENC["N个transformer<br/>编码器块"]
    ENC --> CLS["取[CLS]<br/>token输出"]
    CLS --> HEAD["MLP分类器"]

    style PATCH fill:#dbeafe,stroke:#2563eb
    style ENC fill:#fef3c7,stroke:#d97706
    style HEAD fill:#dcfce7,stroke:#16a34a
```

七个步骤。Patches -> tokens -> attention -> classifier。每个变体（DeiT、Swin、ConvNeXt、MAE预训练）改变七个步骤中的一两个，其余保持不变。

### Patch embedding

第一个conv是秘密所在。Kernel size 16，stride 16，所以224x224图像变成16x16块的14x14网格，每个块投影到768维嵌入。这一个conv同时完成了分块和线性投影。

```
输入:  (3, 224, 224)
Conv (3 -> 768, k=16, s=16, 无padding):
输出: (768, 14, 14)
展平空间: (196, 768)
```

196个块 = 196个tokens。每个token的特征维度为768（ViT-B）、1024（ViT-L）或1280（ViT-H）。

### 类别token

一个学习到的向量，前置到序列：

```
tokens = [CLS; patch_1; patch_2; ...; patch_196]   形状 (197, 768)
```

经过N个transformer块后，`[CLS]`输出是全局图像表示。分类头只读取这一个向量。

### 位置嵌入

Transformer没有内置的空间位置概念。向每个token添加一个学习到的向量：

```
tokens = tokens + learned_pos_embedding   （也是形状 (197, 768)）
```

该嵌入是模型的一个参数；基于梯度的训练使其适应2D图像结构。存在正弦2D替代方案，但在实践中很少使用。

### Transformer编码器块

标准。多头自注意力、MLP、残差连接、pre-LayerNorm。

```
x = x + MSA(LN(x))
x = x + MLP(LN(x))

MLP是带GELU的两层：Linear(d -> 4d) -> GELU -> Linear(4d -> d)
```

ViT-B/16堆叠12个这样的块，每个12个注意力头，总共8600万参数。

### 为什么用pre-LN

早期transformer使用post-LN（`x = LN(x + sublayer(x))`），在没有warmup的情况下难以训练超过6-8层。Pre-LN（`x = x + sublayer(LN(x))`）可以在没有warmup的情况下稳定训练更深的网络。每个ViT和每个现代LLM都使用pre-LN。

### Patch size权衡

- 16x16 patches -> 196 tokens，标准。
- 32x32 patches -> 49 tokens，更快但分辨率更低。
- 8x8 patches -> 784 tokens，更精细但O(n^2)注意力成本可怕地扩展。

更大的patch = 更少的token = 更快但空间细节更少。SwinV2在层次化窗口中使用4x4 patches。

### DeiT在ImageNet-1k上训练ViT的配方

原始ViT需要JFT-300M才能击败CNN。DeiT（Touvron等人，2020）仅使用ImageNet-1k就将ViT-B训练到81.8%的top-1准确率，通过四个更改：

1. 强数据增强：RandAugment、Mixup、CutMix、Random Erasing。
2. Stochastic depth（训练期间随机丢弃整个块）。
3. 重复增强（每batch对同一图像采样3次）。
4. 从CNN教师蒸馏（可选，进一步提升准确率）。

每个现代ViT训练配方都源自DeiT。

### Swin vs ConvNeXt

- **Swin**（Liu等人，2021）— 基于窗口的注意力。每个块在局部窗口内关注；交替的块移动窗口以在窗口间混合信息。在保留注意力操作的同时带回了类似CNN的局部性先验。
- **ConvNeXt**（Liu等人，2022）— 重新设计的CNN，匹配Swin的架构选择（depthwise convs、LayerNorm、GELU、倒瓶颈）。展示了差距不在于"注意力vs卷积"而在于"现代训练配方+架构"。

在2026年，ConvNeXt-V2和Swin-V2都是生产级选择；正确的选择取决于你的推理栈（ConvNeXt在边缘设备上编译更好）和预训练语料库。

### MAE预训练

掩码自编码器（He等人，2022）：随机掩码75%的块，训练编码器仅处理可见的25%，训练一个小解码器从编码器输出重建被掩码的块。预训练后，丢弃解码器并微调编码器。

MAE使ViT仅使用ImageNet-1k即可训练，达到SOTA，并且是当前默认的自监督配方。

## 构建

### 第1步：Patch embedding

```python
import torch
import torch.nn as nn

class PatchEmbedding(nn.Module):
    def __init__(self, in_channels=3, patch_size=16, dim=192, image_size=64):
        super().__init__()
        assert image_size % patch_size == 0
        self.proj = nn.Conv2d(in_channels, dim, kernel_size=patch_size, stride=patch_size)
        num_patches = (image_size // patch_size) ** 2
        self.num_patches = num_patches

    def forward(self, x):
        x = self.proj(x)
        return x.flatten(2).transpose(1, 2)
```

一个conv，一个flatten，一个transpose。这就是整个图像到tokens的步骤。

### 第2步：Transformer块

Pre-LN、多头自注意力、带GELU的MLP、残差连接。

```python
class Block(nn.Module):
    def __init__(self, dim, num_heads, mlp_ratio=4, dropout=0.0):
        super().__init__()
        self.ln1 = nn.LayerNorm(dim)
        self.attn = nn.MultiheadAttention(dim, num_heads, dropout=dropout, batch_first=True)
        self.ln2 = nn.LayerNorm(dim)
        self.mlp = nn.Sequential(
            nn.Linear(dim, dim * mlp_ratio),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(dim * mlp_ratio, dim),
            nn.Dropout(dropout),
        )

    def forward(self, x):
        a, _ = self.attn(self.ln1(x), self.ln1(x), self.ln1(x), need_weights=False)
        x = x + a
        x = x + self.mlp(self.ln2(x))
        return x
```

`nn.MultiheadAttention`处理拆分为多个头、缩放点积和输出投影。`batch_first=True`使形状为`(N, seq, dim)`。

### 第3步：ViT

```python
class ViT(nn.Module):
    def __init__(self, image_size=64, patch_size=16, in_channels=3,
                 num_classes=10, dim=192, depth=6, num_heads=3, mlp_ratio=4):
        super().__init__()
        self.patch = PatchEmbedding(in_channels, patch_size, dim, image_size)
        num_patches = self.patch.num_patches
        self.cls_token = nn.Parameter(torch.zeros(1, 1, dim))
        self.pos_embed = nn.Parameter(torch.zeros(1, num_patches + 1, dim))
        self.blocks = nn.ModuleList([
            Block(dim, num_heads, mlp_ratio) for _ in range(depth)
        ])
        self.ln = nn.LayerNorm(dim)
        self.head = nn.Linear(dim, num_classes)
        nn.init.trunc_normal_(self.pos_embed, std=0.02)
        nn.init.trunc_normal_(self.cls_token, std=0.02)

    def forward(self, x):
        x = self.patch(x)
        cls = self.cls_token.expand(x.size(0), -1, -1)
        x = torch.cat([cls, x], dim=1)
        x = x + self.pos_embed
        for blk in self.blocks:
            x = blk(x)
        x = self.ln(x[:, 0])
        return self.head(x)

vit = ViT(image_size=64, patch_size=16, num_classes=10, dim=192, depth=6, num_heads=3)
x = torch.randn(2, 3, 64, 64)
print(f"output: {vit(x).shape}")
print(f"params: {sum(p.numel() for p in vit.parameters()):,}")
```

约280万个参数 — 一个可在CPU上处理的小型ViT。真正的ViT-B是8600万；使用`dim=768, depth=12, num_heads=12`的相同类定义。

### 第4步：验证——单张图像推理

```python
logits = vit(torch.randn(1, 3, 64, 64))
print(f"logits: {logits}")
print(f"probs:  {logits.softmax(-1)}")
```

应该可以无错误运行。概率之和为1。

## 使用

`timm` 提供每个ViT变体及其ImageNet预训练权重。一行代码：

```python
import timm

model = timm.create_model("vit_base_patch16_224", pretrained=True, num_classes=10)
```

`timm` 是2026年视觉transformers的生产级默认选择。在相同API下支持ViT、DeiT、Swin、Swin-V2、ConvNeXt、ConvNeXt-V2、MaxViT、MViT、EfficientFormer以及几十种其他模型。

对于多模态工作（图像+文本），`transformers` 提供CLIP、SigLIP、BLIP-2、LLaVA。所有这些都是ViT变体作为图像编码器。

## 交付物

本课产出：

- `outputs/prompt-vit-vs-cnn-picker.md` — 一个prompt，根据数据集大小、计算资源和推理栈在ViT、ConvNeXt或Swin之间选择。
- `outputs/skill-vit-patch-and-pos-embed-inspector.md` — 一个技能，验证ViT的patch embedding和位置嵌入形状与模型期望的序列长度匹配，捕获最常见的移植bug。

## 练习

1. **(简单)** 打印上述小型ViT前向传播中每个中间张量的形状。确认：输入`(N, 3, 64, 64)` -> patches `(N, 16, 192)` -> 带CLS `(N, 17, 192)` -> 分类器输入`(N, 192)` -> 输出`(N, num_classes)`。
2. **(中等)** 在第4课的合成CIFAR数据集上微调预训练的`timm` ViT-S/16。与在同一数据上的ResNet-18微调进行比较。报告训练时间和最终准确率。
3. **(困难)** 为小型ViT实现MAE预训练：掩码75%的块，训练编码器+一个小解码器重建被掩码的块。评估预训练前后在合成数据上的linear-probe准确率。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| Patch embedding | "第一个conv" | kernel size = stride = patch size的conv；将图像转换为token嵌入网格 |
| Class token | "[CLS]" | 一个学习到的向量，前置到token序列；其最终输出是全局图像表示 |
| Positional embedding | "学习到的位置" | 添加到每个token的学习向量，使transformer知道每个patch来自哪里 |
| Pre-LN | "子层之前的LayerNorm" | 稳定的transformer变体：`x + sublayer(LN(x))` 而不是 `LN(x + sublayer(x))` |
| Multi-head attention | "并行注意力" | 标准transformer注意力拆分为num_heads个独立子空间，之后拼接 |
| ViT-B/16 | "Base, patch 16" | 标准大小：dim=768, depth=12, heads=12, patch_size=16, image=224；约8600万参数 |
| DeiT | "数据高效的ViT" | 仅使用ImageNet-1k配合强数据增强训练的ViT；证明大预训练数据集并非严格必要 |
| MAE | "掩码自编码器" | 自监督预训练：掩码75%的块，重建；主导的ViT预训练配方 |

## 延伸阅读

- [An Image is Worth 16x16 Words (Dosovitskiy et al., 2020)](https://arxiv.org/abs/2010.11929) — ViT论文
- [DeiT: Data-efficient Image Transformers (Touvron et al., 2020)](https://arxiv.org/abs/2012.12877) — 如何仅使用ImageNet-1k训练ViT
- [Masked Autoencoders are Scalable Vision Learners (He et al., 2022)](https://arxiv.org/abs/2111.06377) — MAE预训练
- [timm documentation](https://huggingface.co/docs/timm) — 你在生产中会使用的每个视觉transformer的参考
