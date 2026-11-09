# 视力转换器 (ViT)

> 一个图像是一个补丁格,一个句子是一个代币格,一个变压器吃了两者.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 4 · 03 (CNNs), Phase 4 · 14 (Vision Transformers intro)
**Time:** ~45 minutes

## 问题

在2020年前,计算机视觉意味着曲.每一个图像网上的SOTA,COCO和检测基准都使用了CNN的脊柱.变体是语言.

东索维茨基及其他 (2020) "一个图像值16x16字" 显示你可以完全放下曲.切片图像成固定尺寸的补丁,线性投影每个补丁成嵌入,将序列输送到尼拉变压器编码器.在足够的规模 (ImageNet-21k预训或更大),ViT匹配或超过ResNet基于的模型.

维特是2026年开始的更广泛模式:一个架构,许多模式. 语标记音频.维特标记图像. 机器人的行动代币. 视频的像素代币. 变压器不关心给它一个序列,它学习.

到2026年,ViT及其后代 (DeiT,Swin,DINOv2,ViT-22B,SAM3) 拥有大部分视觉.CNN仍然在边缘设备和延迟敏感任务上获胜.其他所有东西都在堆中有ViT.

## 概念

![Image → patches → tokens → transformer](../assets/vit.svg)

### 步骤 1  补丁

分开一个`H × W × C`图像成一个`N × (P·P·C)`片的序列. 典型的设置: `224 × 224`图像`16 × 16`补丁 → 196个补丁,每个值为 768 个.

```
image (224, 224, 3) → 14 × 14 grid of 16x16x3 patches → 196 vectors of length 768
```

补丁尺寸是杆. 较小的补丁 = 更多的代币,更好的分辨率,方形注意力成本.较大的补丁 = 粗,更便宜.

### 步骤 2 线性嵌入

一个学习的矩阵将每个平面补丁投射到`d_model`相当于一个核子大小的卷积`P`走进步`P`在PyTorch中,这字面上是`nn.Conv2d(C, d_model, kernel_size=P, stride=P)`两行实施.

### 步骤 3 预备`[CLS]`代码,添加位置嵌入

- 准备一个可学习的东西`[CLS]`它们的最后隐藏状态是用于分类的图像表示.
- 添加可学习的位置嵌入式 (ViT原始) 或双向二维 (后代变体).
- 在2024+ RoPE 扩展到2D位置,有时没有明确的嵌入.

### 步骤 4 标准变压器编码器

堆积 L 块`LayerNorm → Self-Attention → + → LayerNorm → MLP → +`没有视觉特定层次.这是论文的教学性突破.

### 步骤 5 头

为了分类: 取`[CLS]`隐藏状态 →线性 →软max.对于DINOv2或SAM,丢弃`[CLS]`直接使用嵌件.

### 重要的是哪些变体

| Model | Year | Change |
|-------|------|--------|
| ViT | 2020 | The original. Fixed patch size, full global attention. |
| DeiT | 2021 | Distillation; trainable on ImageNet-1k only. |
| Swin | 2021 | Hierarchical with shifted windows. Fixed sub-quadratic cost. |
| DINOv2 | 2023 | Self-supervised (no labels). Best general vision features. |
| ViT-22B | 2023 | 22B params; scaling laws apply. |
| SigLIP | 2023 | ViT + language pair, sigmoid contrastive loss. |
| SAM 3 | 2025 | Segment anything; ViT-Large + promptable mask decoder. |

### 为什么这需要一段时间

由于没有任何 CNN 诱导偏见 (翻译不变,本地).没有100万以上标记图像或强大的自我监督预训练,CNN 仍然在匹配计算中获胜. DeiT 在2021年通过蒸技巧解决了这一问题; DINOv2在2023年通过自我监督永久解决了这一问题.

```figure
n5-patch-stream
```

## 建立它

看到`code/main.py`没有实在规模的 ViT 需要 PyTorch 和数小时的 GPU 时间.

### 步骤1:假图像

作为列列的24 × 24 RGB图像`(R, G, B)`我们使用6×6补丁 →16补丁,每一个108D嵌入向量.

### 步骤 2: 补丁

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

拉斯特序列:在网格上排列大.每个VIT都使用这种序列.

### 步骤3:线性嵌入

乘以随机的每一个平面块`(patch_flat_size, d_model)`检查输出形状是`(N_patches + 1, d_model)`在预定后`[CLS]`现在,我们要去.

### 步骤4:对现实 ViT 计算参数

打印VIT-Base的参数数量:12层,12头,d=768,补丁=16.比较ResNet-50 (~25M).VIT-Base降落在~86M.VIT-Large~307M.VIT-Huge~632M.

## 用它

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

**DINOv2 embeddings are the 2026 default for image features.**结脊椎,训练一个小头. 工作于分类,检索,检测,字幕. 测试点DINOv2超越Clip在任何非文字视觉任务.

**Patch-size picking.**小型模型使用16×16 (ViT-B/16).密集预测 (细分) 使用8×8或14×14 (SAM,DINOv2).非常大的模型使用14×14.

## 运送它

看到`outputs/skill-vit-configurator.md`技能选择了 ViT 变体和补丁大小,以应对新的视觉任务,因为数据集的尺寸,分辨率和计算预算.

## 运动

1. **Easy.**跑步`code/main.py`检查补丁数量是相同的`(H/P) * (W/P)`并且平面补丁的尺寸等于`P*P*C`现在,我们要去.
2. **Medium.**实现2D突形位置嵌入 两个独立的突形代码`row`其他`col`它们被入一个小的 PyTorch ViT 中,并将CIFAR-10的位置嵌入式与可学习的位置嵌入式进行比较.
3. **Hard.**建立一个3层的ViT (PyTorch),训练1000个MNIST图像,使用4×4补丁.测试精度.现在添加DINOv2预训练在相同的1000个图像上 (简单化:只需训练编码器预测从掩盖补丁的补丁).是否提高精度?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Patch | "The vision-transformer token" | Flat vector of pixel values for a `P × P × C` region of the image. |
| Patchify | "Chop + flatten" | Slice image into non-overlapping patches, flatten each to a vector. |
| `[CLS]` token | "The image summary" | Prepended learnable token; its final embedding is the image representation. |
| Inductive bias | "What the model assumes" | ViT has fewer priors than CNNs; needs more data to make up the gap. |
| DINOv2 | "Self-supervised ViT" | Trained without labels using image augmentation + momentum teacher. Best general image features in 2026. |
| SigLIP | "CLIP's successor" | ViT + text encoder trained with sigmoid contrastive loss; better than CLIP on matched compute. |
| Swin | "Windowed ViT" | Hierarchical ViT with local attention + shifted windows; sub-quadratic. |
| Register tokens | "2023 trick" | A few extra learnable tokens that soak up attention sinks; improves DINOv2 features. |

## 进一步阅读

- [Dosovitskiy et al. (2020). An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale](https://arxiv.org/abs/2010.11929)VIT的论文.
- [Touvron et al. (2021). Training data-efficient image transformers & distillation through attention](https://arxiv.org/abs/2012.12877)  
- [Liu et al. (2021). Swin Transformer: Hierarchical Vision Transformer using Shifted Windows](https://arxiv.org/abs/2103.14030) 
- [Oquab et al. (2023). DINOv2: Learning Robust Visual Features without Supervision](https://arxiv.org/abs/2304.07193)   
- [Darcet et al. (2023). Vision Transformers Need Registers](https://arxiv.org/abs/2309.16588) DINOv2 的注册代码固定.
