# 视觉Transformer（Vision Transformers, ViT）

> 将图像切割成补丁，将每个补丁视为一个单词，运行标准Transformer。不要回头。

**类型：** 构建  
**语言：** Python  
**前置知识：** 阶段7 第02课（自注意力 Self-Attention），阶段4 第04课（图像分类 Image Classification）  
**时长：** ~45分钟

## 学习目标

- 从头实现补丁嵌入（Patch Embedding）、可学习位置编码、[CLS]令牌（Class Token）及Transformer编码器块，构建一个最小化ViT
- 解释为何ViT曾被认为需要海量预训练数据，直到DeiT和MAE证明并非如此
- 从架构先验方面比较ViT、Swin和ConvNeXt（无先验、局部窗口注意力、卷积骨干网络）
- 使用`timm`和标准的线性探测/微调方法，在小型数据集上微调预训练ViT

## 问题

十年来，卷积一直是计算机视觉的代名词。CNN具有强大的归纳偏置——局部性、平移等变性——人们认为这是无法替代的。然后Dosovitskiy等人（2020）证明，将普通Transformer直接应用于展开的图像补丁，完全不使用任何卷积机制，就能在大规模数据上匹敌甚至超越最好的CNN。

关键在于“大规模数据”。在ImageNet-1k上，ViT输给了ResNet。但在ImageNet-21k或JFT-300M上预训练，再在ImageNet-1k上微调后，ViT超越了ResNet。结论是Transformer缺乏有用的先验，但能从足够多的数据中学习到它们。后续工作（DeiT、MAE、DINO）表明，只要采用正确的训练配方——强数据增强、自监督预训练、蒸馏——ViT在小数据上也能训练得很好。

到了2026年，纯CNN在边缘设备上仍有竞争力（ConvNeXt是最强的），但Transformer主导了其他所有领域：分割（Mask2Former, SegFormer）、检测（DETR, RT-DETR）、多模态（CLIP, SigLIP）、视频（VideoMAE, VJEPA）。ViT的块结构是必须掌握的知识点。

## 概念

### 流程

```mermaid
flowchart LR
    IMG["图像<br/>(3, 224, 224)"] --> PATCH["补丁嵌入<br/>卷积 16x16 s=16<br/>-> (768, 14, 14)"]
    PATCH --> FLAT["展平为<br/>(196, 768) 个令牌"]
    FLAT --> CAT["前置<br/>[CLS] 令牌"]
    CAT --> POS["添加可学习<br/>位置编码"]
    POS --> ENC["N个Transformer<br/>编码器块"]
    ENC --> CLS["取 [CLS]<br/>令牌输出"]
    CLS --> HEAD["MLP分类器"]

    style PATCH fill:#dbeafe,stroke:#2563eb
    style ENC fill:#fef3c7,stroke:#d97706
    style HEAD fill:#dcfce7,stroke:#16a34a
```

七个步骤。补丁 -> 令牌 -> 注意力 -> 分类器。每个变体（DeiT, Swin, ConvNeXt, MAE预训练）只改变其中一两个步骤，其余保持不变。

### 补丁嵌入

第一个卷积是关键。卷积核大小16，步长16，因此224x224图像变成14x14的16x16补丁网格，每个补丁投影到768维嵌入。这一层卷积同时完成了补丁化和线性投影。

```
输入:  (3, 224, 224)
卷积 (3 -> 768, k=16, s=16, 无填充):
输出: (768, 14, 14)
展平空间维度: (196, 768)
```

196个补丁 = 196个令牌。每个令牌的特征维度为768（ViT-B）、1024（ViT-L）或1280（ViT-H）。

### [CLS]令牌

一个可学习的向量，前置到序列开头：

```
tokens = [CLS; patch_1; patch_2; ...; patch_196]   形状 (197, 768)
```

经过N个Transformer块后，`[CLS]`输出即为全局图像表示。分类头仅读取这一个向量。

### 位置编码

Transformer没有内置的空间位置概念。为每个令牌添加一个可学习向量：

```
tokens = tokens + learned_pos_embedding   (形状也是 (197, 768))
```

该嵌入是模型的一个参数；基于梯度的训练会使其适应2D图像结构。也存在正弦2D替代方案，但实际中很少使用。

### Transformer编码器块

标准结构。多头自注意力、MLP、残差连接、预层归一化（Pre-LayerNorm）。

```
x = x + MSA(LN(x))
x = x + MLP(LN(x))

MLP是两层结构，使用GELU激活：Linear(d -> 4d) -> GELU -> Linear(4d -> d)
```

ViT-B/16堆叠了12个这样的块，每个块有12个注意力头，总共8600万参数。

### 为什么用预层归一化

早期Transformer使用后层归一化（Post-LN `x = LN(x + sublayer(x))`），在超过6-8层时没有热身（warmup）就难以训练。预层归一化（Pre-LN `x = x + sublayer(LN(x))`）可以稳定地训练更深网络，无需热身。所有ViT和所有现代LLM都使用预层归一化。

### 补丁大小权衡

- 16x16补丁 -> 196个令牌，标准配置。
- 32x32补丁 -> 49个令牌，更快但分辨率更低。
- 8x8补丁 -> 784个令牌，更精细但注意力成本呈O(n^2)增长，扩展性差。

更大的补丁 = 更少的令牌 = 更快但空间细节更少。SwinV2在分层窗口中使用4x4补丁。

### DeiT在ImageNet-1k上训练ViT的配方

原始ViT需要JFT-300M才能击败CNN。DeiT（Touvron et al., 2020）仅用ImageNet-1k就将ViT-B训练到81.8% top-1准确率，其方法包括四个改变：

1. 强数据增强：RandAugment、Mixup、CutMix、Random Erasing。
2. 随机深度（训练时随机丢弃整个块）。
3. 重复增强（每个批次对同一图像采样3次）。
4. 从CNN教师模型中蒸馏（可选，可进一步提升准确率）。

所有现代ViT训练配方都源自DeiT。

### Swin vs ConvNeXt

- **Swin**（Liu et al., 2021）——基于窗口的注意力。每个块在局部窗口内进行注意力计算；交替的块会移动窗口，以在不同窗口间混合信息。在保留注意力算子的同时，重新引入了类似CNN的局部性先验。
- **ConvNeXt**（Liu et al., 2022）——重新设计的CNN，匹配Swin的架构选择（深度可分离卷积、LayerNorm、GELU、倒置瓶颈）。表明差距不是“注意力 vs 卷积”，而是“现代训练配方 + 架构”。

到了2026年，ConvNeXt-V2和Swin-V2都是生产级模型；如何选择取决于你的推理栈（ConvNeXt在边缘设备上编译效果更好）和预训练语料库。

### MAE预训练

掩码自编码器（Masked Autoencoder, He et al., 2022）：随机掩码75%的补丁，训练编码器仅处理可见的25%补丁，训练一个小型解码器从编码器输出重建被掩码的补丁。预训练完成后，丢弃解码器，对编码器进行微调。

MAE使得ViT可以仅在ImageNet-1k上训练，达到SOTA，并且是目前默认的自监督配方。

## 构建

### 步骤1：补丁嵌入

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

一层卷积，一次展平，一次转置。这就是完整的图像到令牌步骤。

### 步骤2：Transformer块

预层归一化、多头自注意力、带GELU的MLP、残差连接。

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

`nn.MultiheadAttention` 负责处理头的拆分、缩放点积和输出投影。`batch_first=True` 使得形状为 `(N, seq, dim)`。

### 步骤3：ViT

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

大约280万参数——一个可以在CPU上运行的小型ViT。真正的ViT-B有8600万参数；使用相同的类定义，只需设置 `dim=768, depth=12, num_heads=12`。

### 步骤4：合理性检查——单张图像推理

```python
logits = vit(torch.randn(1, 3, 64, 64))
print(f"logits: {logits}")
print(f"probs:  {logits.softmax(-1)}")
```

应该能无错误运行。概率之和为1。

## 使用

`timm` 提供了所有ViT变体，并带有ImageNet预训练权重。一行代码即可：

```python
import timm

model = timm.create_model("vit_base_patch16_224", pretrained=True, num_classes=10)
```

`timm` 是2026年视觉Transformer的生产级默认选择。支持ViT、DeiT、Swin、Swin-V2、ConvNeXt、ConvNeXt-V2、MaxViT、MViT、EfficientFormer等数十种变体，均采用相同API。

对于多模态任务（图像+文本），`transformers` 提供了CLIP、SigLIP、BLIP-2、LLaVA。这些模型中的图像编码器都是ViT变体。

## 交付

本课程产出：

- `outputs/prompt-vit-vs-cnn-picker.md` — 一个提示词，用于根据数据集大小、计算资源和推理栈，在ViT、ConvNeXt或Swin之间做出选择。
- `outputs/skill-vit-patch-and-pos-embed-inspector.md` — 一项技能，用于验证ViT的补丁嵌入和位置编码形状是否匹配模型预期的序列长度，捕获最常见的移植错误。

## 练习

1. **（简单）** 在上述小型ViT的前向传播过程中，打印每个中间张量的形状。确认：输入 `(N, 3, 64, 64)` -> 补丁 `(N, 16, 192)` -> 加上[CLS]后 `(N, 17, 192)` -> 分类器输入 `(N, 192)` -> 输出 `(N, num_classes)`。
2. **（中等）** 在第4课的合成CIFAR数据集上，微调一个预训练的 `timm` ViT-S/16。与在同一数据上微调ResNet-18进行比较。报告训练时间和最终准确率。
3. **（困难）** 为小型ViT实现MAE预训练：掩码75%的补丁，训练编码器加上一个小型解码器重建被掩码的补丁。在预训练前后，评估在合成数据上的线性探测准确率。

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|------------|----------|
| 补丁嵌入（Patch embedding） | “第一个卷积” | 一个卷积核大小等于步长等于补丁大小的卷积；将图像转化为令牌嵌入的网格 |
| [CLS]令牌（Class token） | “[CLS]” | 一个可学习向量，前置到令牌序列前；其最终输出是全局图像表示 |
| 位置编码（Positional embedding） | “可学习位置” | 一个可学习向量，加到每个令牌上，使Transformer知道每个补丁来自何处 |
| 预层归一化（Pre-LN） | “子层之前的LayerNorm” | 稳定的Transformer变体：`x + sublayer(LN(x))`，代替 `LN(x + sublayer(x))` |
| 多头注意力（Multi-head attention） | “并行注意力” | 标准Transformer注意力拆分为num_heads个独立子空间，之后拼接起来 |
| ViT-B/16 | “Base，补丁16” | 标准规模：dim=768、depth=12、heads=12、patch_size=16、image=224；约8600万参数 |
| DeiT | “数据高效ViT” | 仅使用ImageNet-1k并通过强数据增强训练的ViT；证明大规模预训练数据集并非严格必需 |
| MAE | “掩码自编码器” | 自监督预训练：掩码75%的补丁，重建；主导性的ViT预训练配方 |

## 延伸阅读

- [An Image is Worth 16x16 Words (Dosovitskiy et al., 2020)](https://arxiv.org/abs/2010.11929) — ViT论文
- [DeiT: Data-efficient Image Transformers (Touvron et al., 2020)](https://arxiv.org/abs/2012.12877) — 如何在仅使用ImageNet-1k的情况下训练ViT
- [Masked Autoencoders are Scalable Vision Learners (He et al., 2022)](https://arxiv.org/abs/2111.06377) — MAE预训练
- [timm documentation](https://huggingface.co/docs/timm) — 你将在生产环境中使用的所有视觉Transformer的参考文档