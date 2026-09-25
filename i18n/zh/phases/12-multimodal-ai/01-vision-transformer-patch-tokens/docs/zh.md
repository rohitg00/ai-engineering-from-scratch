# 视觉Transformer与Patch-Token原语

> 在涉及任何多模态之前，图像必须先变成Transformer能消化的token序列。2020年的ViT论文给出了答案：16x16像素的patch、一个线性投影和一个位置嵌入。五年后，每一个2026年的前沿模型(Claude Opus 4.7 原生2576px、Gemini 3.1 Pro、Qwen3.5-Omni)依然以同样的方式开始——编码器从ViT换成了DINOv2再到SigLIP 2,加入了register token,位置编码方案变成了2D-RoPE,但这一原语从未改变。本课端到端地解析patch-token流水线，并用纯标准库Python实现它，为Phase 12的后续内容建立关于“视觉token”的具体心智模型。

**Type:** Learn
**Languages:** Python (stdlib, patch tokenizer + geometry calculator)
**Prerequisites:** Phase 7 (Transformers), Phase 4 (Computer Vision)
**Time:** ~120分钟

## 学习目标

- 将一张 HxWx3 的图像转换为具有正确位置编码的patch token序列。
- 给定 (patch size, 分辨率， 隐藏维度， 深度)，计算ViT的序列长度、参数量和FLOPs。
- 说出让ViT从2020年研究走向2026年生产的三大升级：自监督预训练(DINO / MAE)、register token、原生分辨率打包。
- 针对下游任务在CLS池化、平均池化和register token之间做出选择。

## 问题所在

Transformer处理的是向量序列。文本本身已是序列(字节或token)。图像则是一个带三个颜色通道的二维像素网格——不是序列。如果将每个像素展平，一张224x224的RGB图像会变成150,528个token,而自注意力在如此长度下完全不现实(计算量随序列长度呈二次增长)。

2020年以前的做法是在前端串接一个CNN特征提取器：ResNet输出7x7的特征图(2048维向量)，将这49个token喂给Transformer。这可行，但继承了CNN的归纳偏置(平移等变性、局部感受野)，并失去了Transformer对规模的胃口。

Dosovitskiy等人(2020)提出了一个直白的问题：如果跳过CNN会怎样？将图像切分为固定大小的patch(例如16x16像素)，对每个patch做线性投影得到向量，加上位置嵌入，再把序列喂给一个标准的Transformer。这在当时是异端——没有卷积的视觉。但有了足够的数据(JFT-300M,之后是LAION),它在ImageNet上超越了ResNet,并持续改进。

到2026年，ViT原语已是无可争议的基石。每个开源权重VLM的视觉塔都是某种后裔(DINOv2、SigLIP 2、CLIP、EVA、InternViT)。问题不再是“该不该用patch?”,而是“patch多大、分辨率调度如何、预训练目标是什么、位置编码怎么选”。

## 核心概念

### Patch即token

给定一张形状为 `(H, W, 3)` 的图像 `x` 和patch大小 `P`,可将图像切分为 `(H/P) x (W/P)` 个不重叠的patch网格。每个patch是一个 `P x P x 3` 的像素立方体。将每个立方体展平为 `3 P^2` 维向量。应用一个形状为 `(3 P^2, D)` 的共享线性投影 `W_E`,把每个patch映射到模型的隐藏维度 `D`。

以ViT-B/16的典型配置为例：
- 分辨率224,patch大小16 → 网格14x14 → 196个patch token。
- 每个patch是 `16 x 16 x 3 = 768` 个像素值，投影到 `D = 768`。
- 加上一个可学习的 `[CLS]` token → 序列长度197。

patch投影在数学上等价于一个kernel size为 `P`、stride为 `P`、输出通道为 `D` 的二维卷积。生产代码实际上就是这样实现的——`nn.Conv2d(3, D, kernel_size=P, stride=P)`。“线性投影”是概念层面的表述；“卷积核”的表述才是高效的。

### 位置嵌入

Patch本身没有内在顺序——Transformer看到的是一袋token。早期ViT添加了可学习的一维位置嵌入(每个位置一个768维向量，共197个)。这可行，但把模型绑定在训练分辨率上：推理时若改变网格，就必须对位置表做插值。

现代视觉骨干使用2D-RoPE(Qwen2-VL的M-RoPE、SigLIP 2的默认)或分解的二维位置。2D-RoPE根据patch的(行，列)索引旋转query和key向量，使模型从旋转角度推断相对二维位置。没有位置表。模型在推理时可处理任意网格大小。

### CLS token、池化输出与register token

图像级表示是什么？三种选择并存：

1. `[CLS]` token。在patch序列前附加一个可学习向量。经过所有Transformer块后，CLS token的隐状态即图像表示。继承自BERT。原始ViT、CLIP使用。
2. 平均池化。对patch token的输出隐状态取平均。SigLIP、DINOv2及大多数现代VLM使用。
3. Register token。Darcet等人(2023)观察到，没有显式sink token训练的ViT会产生高范数的“伪影”patch,劫持自注意力。加入4–16个可学习的register token可以吸收这部分负载，并提升密集预测质量(分割、深度)。DINOv2和SigLIP 2都内置了register。

这一选择对下游任务很重要。CLS用于分类没问题。对于将patch token喂给LLM的VLM,则完全跳过池化——每个patch都成为一个LLM输入token。Register在交接前被丢弃(它们是脚手架，不是内容)。

### 预训练：监督、对比、掩码、自蒸馏

2020年的ViT是用JFT-300M上的监督分类预训练的。很快被以下方法取代：

- CLIP(2021):4亿图文对上的对比学习。见第12.02课。
- MAE(2021,He等)：遮盖75%的patch,重建像素。自监督，可在纯图像上训练。
- DINO(2021)/ DINOv2(2023):师生自蒸馏，无标签、无caption。2023年的DINOv2 ViT-g/14是最强的纯视觉骨干，也是“密集特征”用例的默认选择。
- SigLIP / SigLIP 2(2023, 2025):带sigmoid损失的CLIP,配合NaFlex支持原生长宽比。2026年开源VLM(Qwen、Idefics2、LLaVA-OneVision)的主流视觉塔。

预训练的选择决定了骨干的用途：CLIP/SigLIP适合与文本的语义匹配，DINOv2适合密集视觉特征，MAE适合作为下游微调的起点。

### 缩放定律

ViT缩放(Zhai等，2022)确立了ViT的质量在模型大小、数据量和算力上遵循可预测的规律。在固定算力下：
- 更大的模型 + 更多数据 → 更好的质量。
- Patch大小是序列长度与保真度之间的杠杆。Patch 14(DINOv2/SigLIP SO400m的典型值)比patch 16每张图产生更多token;对OCR和密集任务更好，对速度更差。
- 分辨率是另一个大杠杆。从224到384再到512几乎总有帮助，但FLOPs以二次方代价增长。

ViT-g/14(1B参数，patch 14,分辨率224 → 256个token)和SigLIP SO400m/14(400M参数，patch 14)是2026年开源VLM的两个主力编码器。

### ViT的参数量

完整计算见 `code/main.py`。以224分辨率下的ViT-B/16为例：

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

在加载checkpoint之前，先这样粗估每个ViT。骨干大小决定了任何下游VLM的VRAM下限。

### 2026年生产配置

2026年大多数开源VLM配备的编码器是原生分辨率(NaFlex)下的SigLIP 2 SO400m/14。它具有：
- 400M参数。
- Patch大小14,默认分辨率384 → 每张图729个patch token。
- 图像级任务用平均池化；VQA时全部729个patch流入LLM。
- 4个register token,在LLM交接前丢弃。
- 带图像级缩放的2D-RoPE,支持原生长宽比。

这个配置中的每个决策都能追溯到一篇可阅读的论文。

```figure
image-patch-tokens
```

## 动手使用

`code/main.py` 是一个patch分词器和几何计算器。输入(图像H、W、patch P、隐藏维度D、深度L),输出：

- Patch化后的网格形状和序列长度。
- 一张8x8像素合成玩具图像的token序列(走一遍展平+投影路径)。
- 按patch embed、位置嵌入、Transformer块和头部细分的参数量。
- 目标分辨率下每次前向传播的FLOPs。
- 跨ViT-B/16 @ 224、ViT-L/14 @ 336、DINOv2 ViT-g/14 @ 224、SigLIP SO400m/14 @ 384的对比表。

运行它。将参数量与已发表的数字对照。调整patch大小和分辨率，感受token数量的代价。

## 交付

本课产出 `outputs/skill-patch-geometry-reader.md`。给定ViT配置(patch大小、分辨率、隐藏维度、深度)，它输出带依据的token数量、参数量和VRAM估算。在为VLM挑选视觉骨干时随时使用这项技能——它能避免“token爆了、我的LLM上下文被填满”的意外。

## 练习

1. 计算Qwen2.5-VL在原生1280x720输入、patch大小14下的patch token序列长度。与仅用CLS的表示相比如何？

2. 一帧1080p(1920x1080)在patch 14下产生多少token?30 FPS下5分钟视频共多少视觉token?哪种手段最能省成本：池化、抽帧，还是token合并？

3. 用纯Python实现patch token上的平均池化。验证对DINOv2输出的196个token做平均池化后，结果与模型 `forward` 请求池化嵌入时返回的一致。

4. 阅读《Vision Transformers Need Registers》(arXiv:2309.16588)第3节。用两句话描述register吸收了什么伪影，以及为什么这对下游密集预测很重要。

5. 修改 `code/main.py` 以支持patch-n'-pack:给定一组不同分辨率的图像，产生单个打包序列和块对角注意力掩码。学到第12.06课时进行对照验证。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|------------------------|------------------------|
| Patch | “16x16像素方块” | 输入图像中固定大小、不重叠的区域；变成一个token |
| Patch embedding | “线性投影” | 一个共享的可学习矩阵(或stride=P的Conv2d),将展平的patch像素映射到D维向量 |
| CLS token | “类别token” | 前置的可学习向量，其最终隐状态表示整张图像；2026年中已是可选 |
| Register token | “Sink token” | 额外的可学习token,吸收ViT在预训练中产生的高范数注意力伪影 |
| Position embedding | “位置信息” | 每个位置的向量或旋转，使序列具备顺序感知；2D-RoPE是现代默认 |
| Grid | “Patch网格” | 给定分辨率和patch大小下的 (H/P) x (W/P) 二维patch数组 |
| NaFlex | “原生灵活分辨率” | SigLIP 2特性：单个模型服务多种长宽比和分辨率而无需重新训练 |
| Backbone | “视觉塔” | 预训练的图像编码器，其patch token输出在VLM中喂给LLM |
| Pooling | “图像级摘要” | 将patch token转为单个向量的策略:CLS、平均、注意力池化或基于register |
| Patch 14 vs 16 | “更细 vs 更粗的网格” | Patch 14每张图产生更多token,对OCR保真度更高但更慢；patch 16是经典默认 |

## 延伸阅读

- [Dosovitskiy等 — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) — 原始ViT。
- [He等 — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) — MAE,自监督预训练。
- [Oquab等 — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) — 规模化自蒸馏，无标签。
- [Darcet等 — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) — register token与伪影分析。
- [Tschannen等 — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — 2026年的默认视觉塔。
- [Zhai等 — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) — 实证缩放定律。