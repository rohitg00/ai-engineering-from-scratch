# Vision Transformers（ViT）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 把图像切成 patch（小块），把每个 patch 当成一个词，跑一个标准的 transformer。别回头看。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 Lesson 02（Self-Attention）, Phase 4 Lesson 04（Image Classification）
**Time:** ~45 minutes

## 学习目标（Learning Objectives）

- 从零实现 patch embedding、可学习的位置编码、class token 以及 transformer encoder block，搭出一个最小可用的 ViT
- 解释为什么早期人们认为 ViT 必须依赖海量预训练数据，直到 DeiT 和 MAE 证明并非如此
- 从架构先验（先验为零、局部窗口 attention、卷积 backbone）的角度对比 ViT、Swin 与 ConvNeXt
- 用 `timm` 与标准的 linear-probe / fine-tune 配方，在小数据集上微调一个预训练 ViT

## 问题（The Problem）

整整十年，卷积几乎就是计算机视觉的代名词。CNN 拥有强大的归纳偏置——局部性、平移等变性——没人觉得这些能被替代。然后 Dosovitskiy 等人（2020）证明：把图像 patch 拍平后扔进一个普通的 transformer，完全不用任何卷积部件，在足够规模下也能追平甚至超过最好的 CNN。

代价就在「足够规模」这四个字。在 ImageNet-1k 上，ViT 输给了 ResNet。但在 ImageNet-21k 或 JFT-300M 上做 pretraining、再在 ImageNet-1k 上 fine-tune 之后，ViT 反超了。结论是：transformer 缺少有用的先验，但只要数据够多，它能自己学出来。后续工作（DeiT、MAE、DINO）则进一步证明：只要训练配方对路——强增强、自监督预训练、蒸馏——ViT 在小数据上也能训得不错。

到 2026 年，纯 CNN 在边缘设备上仍然有竞争力（ConvNeXt 是最强的代表），但 transformer 已经统治了几乎所有其他场景：分割（Mask2Former、SegFormer）、检测（DETR、RT-DETR）、多模态（CLIP、SigLIP）、视频（VideoMAE、VJEPA）。ViT 的 block 结构是必须掌握的那一种。

## 概念（The Concept）

### 流水线（The pipeline）

```mermaid
flowchart LR
    IMG["图像<br/>（3, 224, 224）"] --> PATCH["Patch embedding<br/>卷积 16x16 s=16<br/>-> （768, 14, 14）"]
    PATCH --> FLAT["展平为<br/>（196, 768） token"]
    FLAT --> CAT["前置<br/>[CLS] token"]
    CAT --> POS["加可学习<br/>位置 embed"]
    POS --> ENC["N 个 transformer<br/>编码器 block"]
    ENC --> CLS["取 [CLS]<br/>token 输出"]
    CLS --> HEAD["MLP 分类器"]

    style PATCH fill:#dbeafe,stroke:#2563eb
    style ENC fill:#fef3c7,stroke:#d97706
    style HEAD fill:#dcfce7,stroke:#16a34a
```

七步。Patch -> token -> attention -> 分类器。每一种变体（DeiT、Swin、ConvNeXt、MAE pretraining）都只改其中一两步，剩下的原样保留。

### Patch embedding

第一个卷积是关键。Kernel 大小 16，stride 16，于是一张 224x224 的图像变成 14x14 的网格，每个网格一个 16x16 的 patch，被线性投影到 768 维 embedding。这一个 conv 同时完成了切 patch 和线性投影两件事。

```
Input:  (3, 224, 224)
Conv (3 -> 768, k=16, s=16, no padding):
Output: (768, 14, 14)
Flatten spatial: (196, 768)
```

196 个 patch = 196 个 token。每个 token 的特征维度是 768（ViT-B）、1024（ViT-L）或 1280（ViT-H）。

### Class token

一个可学习的向量，拼接在序列最前面：

```
tokens = [CLS; patch_1; patch_2; ...; patch_196]   shape (197, 768)
```

经过 N 个 transformer block 之后，`[CLS]` 的输出就是整张图的全局表示。分类头只读这一个向量。

### 位置编码（Positional embedding）

Transformer 自身没有空间位置概念。给每个 token 加一个可学习的向量：

```
tokens = tokens + learned_pos_embedding   (also shape (197, 768))
```

这个 embedding 是模型的参数，靠梯度训练让它适配 2D 图像结构。也存在正弦式 2D 位置编码的替代方案，但实践中很少用。

### Transformer encoder block

标准结构。Multi-head self-attention、MLP、残差连接、pre-LayerNorm。

```
x = x + MSA(LN(x))
x = x + MLP(LN(x))

MLP is two-layer with GELU: Linear(d -> 4d) -> GELU -> Linear(4d -> d)
```

ViT-B/16 堆叠 12 个这样的 block，每个 block 12 个 attention head，总共 86M 参数。

### 为什么用 pre-LN（Why pre-LN）

早期 transformer 用 post-LN（`x = LN(x + sublayer(x))`），不加 warmup 时层数过 6-8 层就训不动。Pre-LN（`x = x + sublayer(LN(x))`）不需要 warmup 也能稳定训练更深的网络。所有 ViT 和所有现代 LLM 都用 pre-LN。

### Patch 大小的取舍（Patch size trade-off）

- 16x16 patch -> 196 个 token，标准选择。
- 32x32 patch -> 49 个 token，更快但分辨率更低。
- 8x8 patch -> 784 个 token，更精细，但 attention 的 O(n^2) 代价扛不住。

Patch 越大 = token 越少 = 越快但空间细节越粗。SwinV2 用 4x4 patch 配合层级化窗口。

### DeiT 在 ImageNet-1k 上训练 ViT 的配方（DeiT's recipe for training ViT on ImageNet-1k）

原始 ViT 必须靠 JFT-300M 才能打过 CNN。DeiT（Touvron 等，2020）只靠 ImageNet-1k 就把 ViT-B 训到 81.8% top-1，靠的是四点改动：

1. 重度增强：RandAugment、Mixup、CutMix、Random Erasing。
2. Stochastic depth（训练时随机整块 drop 掉某些 block）。
3. Repeated augmentation（同一张图在一个 batch 内被采样 3 次）。
4. 从 CNN teacher 蒸馏（可选，会进一步抬高准确率）。

每一个现代 ViT 训练配方都源自 DeiT。

### Swin 与 ConvNeXt（Swin vs ConvNeXt）

- **Swin**（Liu 等，2021）——基于窗口的 attention。每个 block 只在局部窗口内做 attention；交替的 block 把窗口移位以便跨窗口混合信息。这相当于把 CNN 那种局部性先验请回来，同时保留 attention 算子。
- **ConvNeXt**（Liu 等，2022）——重新设计的 CNN，借鉴了 Swin 的架构选择（depthwise conv、LayerNorm、GELU、倒置瓶颈）。它说明真正的差距不在「attention vs 卷积」，而在「现代训练配方 + 架构」。

到 2026 年，ConvNeXt-V2 和 Swin-V2 都达到了生产级；具体怎么选取决于你的推理栈（ConvNeXt 在边缘端编译效果更好）和预训练语料。

### MAE pretraining

Masked Autoencoder（He 等，2022）：随机 mask 掉 75% 的 patch，让 encoder 只处理可见的那 25%，再用一个小 decoder 从 encoder 输出里重建被 mask 的 patch。预训练完成后丢掉 decoder，只 fine-tune encoder。

MAE 让 ViT 仅靠 ImageNet-1k 就能训出来，达到 SOTA，是当下默认的自监督配方。

## 动手实现（Build It）

### Step 1: Patch embedding

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

一个 conv、一个 flatten、一个 transpose。这就是把图像变成 token 的全部步骤。

### Step 2: Transformer block

Pre-LN、multi-head self-attention、带 GELU 的 MLP、残差连接。

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

`nn.MultiheadAttention` 帮你处理拆 head、scaled dot-product 以及输出投影。`batch_first=True` 让形状为 `(N, seq, dim)`。

### Step 3: ViT 本体（The ViT）

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

约 2.8M 参数——一个迷你 ViT，CPU 上也能跑。真正的 ViT-B 是 86M；同一个类定义，把参数改成 `dim=768, depth=12, num_heads=12` 就行。

### Step 4: Sanity check —— 单图推理

```python
logits = vit(torch.randn(1, 3, 64, 64))
print(f"logits: {logits}")
print(f"probs:  {logits.softmax(-1)}")
```

应当能无报错跑通。概率之和为 1。

## 用起来（Use It）

`timm` 提供了所有 ViT 变体，并附带 ImageNet 预训练权重。一行搞定：

```python
import timm

model = timm.create_model("vit_base_patch16_224", pretrained=True, num_classes=10)
```

到 2026 年，`timm` 是 vision transformer 在生产里的默认选择。它在同一套 API 下支持 ViT、DeiT、Swin、Swin-V2、ConvNeXt、ConvNeXt-V2、MaxViT、MViT、EfficientFormer，以及几十种其它模型。

如果你做多模态（图像 + 文本），`transformers` 提供了 CLIP、SigLIP、BLIP-2、LLaVA。这些里头的图像 encoder 全都是 ViT 变体。

## 上线部署（Ship It）

本课产出：

- `outputs/prompt-vit-vs-cnn-picker.md` —— 一个 prompt，根据数据集大小、算力、推理栈在 ViT、ConvNeXt 与 Swin 之间做选择。
- `outputs/skill-vit-patch-and-pos-embed-inspector.md` —— 一个 skill，用来检查一个 ViT 的 patch embedding 与位置编码形状是否与模型期望的序列长度一致，能抓住最常见的移植 bug。

## 练习（Exercises）

1. **（简单）** 打印迷你 ViT 一次前向中所有中间 tensor 的形状。确认：input `(N, 3, 64, 64)` -> patches `(N, 16, 192)` -> 加上 CLS 后 `(N, 17, 192)` -> 分类器输入 `(N, 192)` -> 输出 `(N, num_classes)`。
2. **（中等）** 用 `timm` 的预训练 ViT-S/16，在第 4 课的合成版 CIFAR 数据集上做 fine-tune。和同样在该数据上 fine-tune 的 ResNet-18 对比。报告训练时间和最终准确率。
3. **（困难）** 给迷你 ViT 实现 MAE pretraining：mask 75% 的 patch，训练 encoder + 一个小 decoder 重建被 mask 的 patch。在合成数据上分别测出 pretraining 前后的 linear-probe 准确率。

## 关键术语（Key Terms）

| Term | 大家通常怎么说 | 实际含义 |
|------|----------------|----------------------|
| Patch embedding | 「第一个 conv」 | 一个 kernel 大小 = stride = patch 大小的 conv；把图像变成一个 token embedding 网格 |
| Class token | "[CLS]" | 拼接到 token 序列最前面的一个可学习向量；它的最终输出就是整张图的全局表示 |
| Positional embedding | 「learned pos」 | 加到每个 token 上的可学习向量，让 transformer 知道每个 patch 来自哪里 |
| Pre-LN | 「LayerNorm 在 sublayer 之前」 | 稳定的 transformer 变体：`x + sublayer(LN(x))`，而不是 `LN(x + sublayer(x))` |
| Multi-head attention | 「并行 attention」 | 标准 transformer attention，被切分成 num_heads 个独立子空间，再拼回去 |
| ViT-B/16 | 「Base，patch 16」 | 标准规格：dim=768, depth=12, heads=12, patch_size=16, image=224；约 86M 参数 |
| DeiT | 「Data-efficient ViT」 | 仅用 ImageNet-1k + 强增强训练出来的 ViT；证明大规模预训练数据并非必需 |
| MAE | 「Masked autoencoder」 | 自监督预训练：mask 75% patch 再重建；当下主流的 ViT 预训练配方 |

## 延伸阅读（Further Reading）

- [An Image is Worth 16x16 Words (Dosovitskiy et al., 2020)](https://arxiv.org/abs/2010.11929) —— ViT 原始论文
- [DeiT: Data-efficient Image Transformers (Touvron et al., 2020)](https://arxiv.org/abs/2012.12877) —— 如何仅靠 ImageNet-1k 训练 ViT
- [Masked Autoencoders are Scalable Vision Learners (He et al., 2022)](https://arxiv.org/abs/2111.06377) —— MAE pretraining
- [timm documentation](https://huggingface.co/docs/timm) —— 生产中你将用到的所有 vision transformer 的参考手册
