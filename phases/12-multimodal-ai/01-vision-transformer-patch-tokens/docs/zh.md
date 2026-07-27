# Vision Transformer 与 Patch-Token 基元

> 在任何多模态处理开始之前，图像必须被转化为 Transformer 能够消费的 token 序列。2020 年的 ViT 论文以 16x16 像素的 patch、一个线性投影和位置嵌入回答了这个问题。五年后，每一个 2026 年的前沿模型（Claude Opus 4.7 原生 2576px、Gemini 3.1 Pro、Qwen3.5-Omni）仍然以这种方式起步——编码器从 ViT 变成了 DINOv2 再到 SigLIP 2，添加了 register token，位置编码方案变成了 2D-RoPE，但基元始终如一。本课程从头到尾解读 patch-token 流水线，并用纯标准库 Python 实现它，以便第 12 阶段的其余内容对"视觉 token"有一个具体的心理模型。

**类型：** 学习
**语言：** Python（标准库，patch tokenizer + 几何计算器）
**前置要求：** 第 7 阶段（Transformer）、第 4 阶段（计算机视觉）
**时间：** ~120 分钟

## 学习目标

- 将 HxWx3 图像转换为带有正确位置编码的 patch token 序列。
- 计算给定配置（patch 大小、分辨率、隐藏维度、深度）下 ViT 的序列长度、参数量和 FLOPs。
- 说出 ViT 从 2020 年研究到 2026 年产品化的三项升级：自监督预训练（DINO / MAE）、register token 和原生分辨率打包。
- 针对下游任务在 CLS 池化、均值池化和 register token 之间做出选择。

## 问题

Transformer 操作于向量序列之上。文本本身就是一个序列（字节或 token）。而图像是带有三个颜色通道的二维像素网格——并非序列。如果你将每个像素展平，一张 224x224 的 RGB 图像就变成了 150,528 个 token，而这样的长度下自注意力机制无法起步（序列长度的平方级复杂度）。

2020 年之前的做法是在前端嫁接一个 CNN 特征提取器：ResNet 产生一个 7x7 的 2048 维特征图，将这 49 个 token 送入 Transformer。这种方法虽然有效，但继承了 CNN 的偏置（平移等变性、局部感受野），并丧失了 Transformer 对规模扩展的渴望。

Dosovitskiy 等人（2020）提出了一个直白的问题：如果我们跳过 CNN 呢？将图像分割成固定大小的 patch（比如 16x16 像素），将每个 patch 线性投影为一个向量，加上位置嵌入，然后将整个序列送入一个 vanilla Transformer。在当时这简直是异端——没有卷积的视觉。但凭借足够的数据（JFT-300M，后来的 LAION），它在 ImageNet 上击败了 ResNet 并且持续进步。

到 2026 年，ViT 基元已是无可争议的基础。每个开源权重 VLM 的视觉塔都是它的某种后代（DINOv2、SigLIP 2、CLIP、EVA、InternViT）。问题不再是"我们应该用 patch 吗？"，而是"用什么 patch 大小、什么分辨率调度、什么预训练目标、什么位置编码"。

## 概念

### 作为 token 的 patch

给定一个形状为 `(H, W, 3)` 的图像 `x` 和 patch 大小 `P`，你将图像切割成一个 `(H/P) x (W/P)` 的非重叠 patch 网格。每个 patch 是一个 `P x P x 3` 的像素立方体。将每个立方体展平为一个 `3 P^2` 的向量。应用一个形状为 `(3 P^2, D)` 的共享线性投影 `W_E`，将每个 patch 映射到模型的隐藏维度 `D`。

对于 ViT-B/16 标准配置：
- 分辨率 224，patch 大小 16 → 网格 14x14 → 196 个 patch token。
- 每个 patch 是 `16 x 16 x 3 = 768` 个像素值，投影到 `D = 768`。
- 添加一个可学习的 `[CLS]` token → 序列长度为 197。

Patch 投影在数学上等价于一个 kernel 大小为 `P`、步长为 `P`、输出通道数为 `D` 的二维卷积。生产代码正是这样实现的——`nn.Conv2d(3, D, kernel_size=P, stride=P)`。"线性投影"是概念上的理解；卷积的实现是高效的。

### 位置嵌入

Patch 没有固有的顺序——Transformer 将其视为一个集合。早期 ViT 添加了一个可学习的一维位置嵌入（每个位置一个 768 维向量，共 197 个）。这有效，但将模型绑定到了训练分辨率上：推理时如果改变网格大小，你必须对位置表进行插值。

现代视觉主干使用 2D-RoPE（Qwen2-VL 的 M-RoPE、SigLIP 2 的默认方案）或分解的二维位置。2D-RoPE 根据 patch 的（行，列）索引旋转 query 和 key 向量，因此模型从旋转角度推断出相对的二维位置。没有位置表。模型在推理时可以处理任意网格大小。

### CLS token、池化输出与 register token

什么是图像级别的表示？三种方案并存：

1. **`[CLS]` token**。在 patch 序列前添加一个可学习向量。经过所有 Transformer 块后，CLS token 的隐藏状态即为图像表示。继承自 BERT。由原始 ViT、CLIP 使用。
2. **均值池化**。对所有 patch token 输出的隐藏状态取平均。由 SigLIP、DINOv2 以及大多数现代 VLM 使用。
3. **Register token**。Darcet 等人（2023）观察到，没有显式 sink token 训练的 ViT 会发展出高范数的"伪影"patch，这些 patch 劫持了自注意力机制。添加 4-16 个可学习的 register token 吸收了这一负担，并提升了密集预测（分割、深度）的质量。DINOv2 和 SigLIP 2 都配备了 register。

这一选择对下游任务很重要。CLS 适用于分类。对于将 patch token 送入 LLM 的 VLM，你完全跳过池化——每个 patch 都成为 LLM 的输入 token。Register token 在交接前被丢弃（它们是脚手架，而非内容）。

### 预训练：监督式、对比式、掩码式、自蒸馏

2020 年的 ViT 是在 JFT-300M 上通过监督分类进行预训练的。很快被以下方法取代：

- **CLIP（2021）**：在 4 亿对图文数据上进行对比学习。见课程 12.02。
- **MAE（2021，He 等人）**：掩码 75% 的 patch，重建像素。自监督，适用于纯图像。
- **DINO（2021）/ DINOv2（2023）**：使用师生框架进行自蒸馏，无标签，无标题。2023 年的 DINOv2 ViT-g/14 是最强的纯视觉主干，也是"密集特征"用例的默认选择。
- **SigLIP / SigLIP 2（2023, 2025）**：使用 sigmoid 损失和 NaFlex 实现原生宽高比的 CLIP。2026 年开源 VLM（Qwen、Idefics2、LLaVA-OneVision）中占主导地位的视觉塔。

你对预训练的选择决定了主干的擅长领域：CLIP/SigLIP 适用于与文本的语义匹配，DINOv2 适用于密集视觉特征，MAE 适用于下游微调的起点。

### 缩放定律

ViT 的缩放（Zhai 等人，2022）确立了 ViT 的质量在模型大小、数据大小和计算量上遵循可预测的规律。在固定计算量下：
- 更大的模型 + 更多的数据 → 更好的质量。
- Patch 大小是序列长度与保真度之间的杠杆。Patch 14（DINOv2/SigLIP SO400m 的典型配置）比 patch 16 每张图像产生更多 token；对 OCR 和密集任务更好，速度更慢。
- 分辨率是另一个重要的杠杆。从 224 到 384 再到 512 几乎总是有益的，代价是 FLOPs 的平方增长。

ViT-g/14（1B 参数，patch 14，分辨率 224 → 256 个 token）和 SigLIP SO400m/14（400M 参数，patch 14）是 2026 年开源 VLM 的两个主力编码器。

### ViT 的参数量

完整计算见 `code/main.py`。对于分辨率 224 的 ViT-B/16：

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

在加载检查点之前，用这种方式估算每个 ViT。主干大小决定了你在任何下游 VLM 中的 VRAM 底线。

### 2026 年生产配置

2026 年大多数开源 VLM 搭载的编码器是原生分辨率（NaFlex）的 SigLIP 2 SO400m/14。它具有：
- 4 亿参数。
- Patch 大小 14，默认分辨率 384 → 每张图像 729 个 patch token。
- 图像级任务使用均值池化；所有 729 个 patch 流入 LLM 以进行 VQA。
- 4 个 register token，在 LLM 交接前丢弃。
- 2D-RoPE，带图像级缩放以支持原生宽高比。

该配置中的每一个决策都源自你能够阅读的论文。

```figure
image-patch-tokens
```

## 使用它

`code/main.py` 是一个 patch tokenizer 和几何计算器。它接收（图像 H、W、patch P、隐藏维度 D、深度 L）并输出：

- 切分后的网格形状和序列长度。
- 一个合成 8x8 像素玩具图像的 token 序列（走通展平 + 投影路径）。
- 按 patch 嵌入、位置嵌入、Transformer 块和输出头分解的参数量。
- 目标分辨率下每前向传播的 FLOPs。
- ViT-B/16 @ 224、ViT-L/14 @ 336、DINOv2 ViT-g/14 @ 224、SigLIP SO400m/14 @ 384 的对比表。

运行它。将参数量与已发表的数字进行匹配。调整 patch 大小和分辨率，感受 token 数量的变化代价。

## 交付它

本课程产出一个 `outputs/skill-patch-geometry-reader.md` 文件。给定一个 ViT 配置（patch 大小、分辨率、隐藏维度、深度），它生成 token 数量、参数量和 VRAM 估算，并附有理由说明。每当你为 VLM 选择视觉主干时使用此技能——它可以防止"token 爆炸了，我的 LLM 上下文塞满了"这样的意外。

## 练习

1. 计算 Qwen2.5-VL 在原生 1280x720 输入、patch 大小 14 下的 patch-token 序列长度。与仅使用 CLS 的表示相比如何？

2. 一帧 1080p 画面（1920x1080）在 patch 14 下产生多少个 token？在 30 FPS 下对一段 5 分钟的视频，总共产生多少个视觉 token？哪种方法节省最多：池化、帧采样还是 token 合并？

3. 用纯 Python 实现 patch token 上的均值池化。验证 DINOv2 输出的 196 个 token 的均值池化结果与模型在请求池化嵌入时 `forward` 返回的结果是否一致。

4. 阅读《Vision Transformers Need Registers》（arXiv:2309.16588）第 3 节。用两句话描述 register 吸收了什么伪影，以及为什么它对下游密集预测任务很重要。

5. 修改 `code/main.py` 以支持 patch-n'-pack：给定一个不同分辨率的图像列表，生成一个打包后的序列和块对角注意力掩码。当学习到课程 12.06 时进行验证。

## 关键术语

| 术语 | 人们常说的意思 | 实际含义 |
|------|----------------|------------------------|
| Patch | "16x16 像素方块" | 输入图像中固定大小的非重叠区域；成为一个 token |
| Patch 嵌入 | "线性投影" | 一个共享的学习矩阵（或步长为 P 的 Conv2d），将展平的 patch 像素映射到 D 维向量 |
| CLS token | "类别 token" | 预置的可学习向量，其最终隐藏状态代表整张图像；2026 年为可选项 |
| Register token | "Sink token" | 额外的可学习 token，吸收 ViT 在预训练期间产生的高范数注意力伪影 |
| 位置嵌入 | "位置信息" | 每个位置的向量或旋转，使序列感知顺序；2D-RoPE 是现代默认方案 |
| 网格 | "Patch 网格" | 给定分辨率和 patch 大小下的 (H/P) x (W/P) 二维 patch 数组 |
| NaFlex | "原生灵活分辨率" | SigLIP 2 特性：单一模型无需重新训练即可服务多种宽高比和分辨率 |
| 主干 | "视觉塔" | 预训练的图像编码器，其 patch-token 输出在 VLM 中馈送给 LLM |
| 池化 | "图像级摘要" | 将 patch token 转换为一个向量的策略：CLS、均值、注意力池化或基于 register 的方式 |
| Patch 14 vs 16 | "更细 vs 更粗的网格" | Patch 14 每张图像产生更多 token，对 OCR 保真度更好，速度较慢；patch 16 是经典默认值 |

## 延伸阅读

- [Dosovitskiy 等人 — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) — 原始 ViT。
- [He 等人 — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) — MAE，自监督预训练。
- [Oquab 等人 — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) — 大规模自蒸馏，无需标签。
- [Darcet 等人 — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) — Register token 与伪影分析。
- [Tschannen 等人 — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — 2026 年默认视觉塔。
- [Zhai 等人 — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) — 经验缩放定律。
