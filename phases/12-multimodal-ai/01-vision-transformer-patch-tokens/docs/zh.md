# Vision Transformers 与 Patch-Token 原语

> 在任何多模态之前，图像必须变成 transformer 可以处理的 token 序列。2020 年的 ViT 论文用 16x16 像素 patch、线性投影和位置嵌入回答了这个问题。五年后，每个 2026 年的前沿模型（Claude Opus 4.7 原生 2576px、Gemini 3.1 Pro、Qwen3.5-Omni）仍然以这种方式开始——编码器从 ViT 变成了 DINOv2、SigLIP 2，添加了 register token，位置方案变成了 2D-RoPE，但原语保持不变。本课从头到尾阅读 patch-token 管道，并用 stdlib Python 构建它，以便 Phase 12 的其余部分对"视觉 token"有一个具体的心智模型。

**类型：** Learn
**语言：** Python（stdlib，patch tokenizer + 几何计算器）
**前置知识：** Phase 7（Transformers），Phase 4（Computer Vision）
**时间：** ~120 分钟

## 学习目标

- 将 HxWx3 图像转换为具有正确位置编码的 patch token 序列。
- 计算给定（patch size、分辨率、hidden dim、depth）的 ViT 的序列长度、参数量和 FLOPs。
- 说出将 ViT 从 2020 年研究带到 2026 年生产的三个升级：自监督预训练（DINO / MAE）、register token 和原生分辨率打包。
- 为下游任务在 CLS pooling、mean pooling 和 register token 之间做出选择。

## 问题所在

Transformers 操作向量序列。文本已经是序列（字节或 token）。图像是具有三个颜色通道的 2D 像素网格——不是序列。如果你展平每个像素，224x224 RGB 图像变成 150,528 个 token，在该长度上的自注意力是不可行的（序列长度的二次方）。

2020 年前的做法是在前面连接一个 CNN 特征提取器：ResNet 产生 49 个 2048 维向量的 7x7 特征图，将这 49 个 token 喂给 transformer。这有效但继承了 CNN 的偏差（平移等变性、局部感受野）并失去了 transformer 对规模的渴望。

Dosovitskiy 等人（2020）提出了一个直率的问题：如果我们跳过 CNN 呢？将图像分割成固定大小的 patch（比如 16x16 像素），将每个 patch 线性投影成向量，添加位置嵌入，然后将序列喂给 vanilla transformer。当时这是异端——没有卷积的视觉。有了足够的数据（JFT-300M，然后是 LAION），它在 ImageNet 上击败了 ResNet 并持续改进。

到 2026 年，ViT 原语是毫无疑问的基础。每个开源权重的 VLM 的视觉塔都是某种后代（DINOv2、SigLIP 2、CLIP、EVA、InternViT）。问题不再是"我们应该用 patch 吗？"而是"什么 patch size、什么分辨率计划、什么预训练目标、什么位置编码。"

## 核心概念

### Patch 作为 token

给定一个形状为 `(H, W, 3)` 的图像 `x` 和一个 patch size `P`，你将图像切成 `(H/P) x (W/P)` 个不重叠 patch 的网格。每个 patch 是一个 `P x P x 3` 的像素立方体。将每个立方体展平为 `3 P^2` 向量。应用共享线性投影 `W_E`，形状为 `(3 P^2, D)`，将每个 patch 映射到模型的 hidden dimension `D`。

对于 ViT-B/16 规范配置：
- 分辨率 224，patch size 16 → 网格 14x14 → 196 个 patch token。
- 每个 patch 是 `16 x 16 x 3 = 768` 像素值，投影到 `D = 768`。
- 添加可学习的 `[CLS]` token → 序列长度 197。

Patch 投影在数学上与 2D 卷积相同，kernel size 为 `P`，stride 为 `P`，输出通道为 `D`。这就是生产代码实际实现的方式——`nn.Conv2d(3, D, kernel_size=P, stride=P)`。"线性投影"框架是概念性的；kernel 框架是高效的。

### 位置嵌入

Patch 没有固有的顺序——transformer 将它们视为一个袋子。早期 ViT 添加了可学习的 1D 位置嵌入（每个位置一个 768 维向量，共 197 个）。有效，但将模型绑定到训练分辨率：在推理时，如果你改变网格，必须插值位置表。

现代视觉 backbone 使用 2D-RoPE（Qwen2-VL 的 M-RoPE，SigLIP 2 的默认）或分解的 2D 位置。2D-RoPE 根据 patch 的（行、列）索引旋转 query 和 key 向量，因此模型从旋转角度推断相对 2D 位置。没有位置表。模型在推理时处理任意网格大小。

### CLS token、池化输出和 register token

图像级表示是什么？三种选择共存：

1. `[CLS]` token。在 patch 序列前面添加一个可学习向量。在所有 transformer block 之后，CLS token 的 hidden state 就是图像表示。继承自 BERT。原始 ViT、CLIP 使用。
2. Mean pool。平均 patch token 的输出 hidden state。SigLIP、DINOv2、大多数现代 VLM 使用。
3. Register token。Darcet 等人（2023）观察到，没有显式 sink token 训练的 ViT 会发展出高范数的"伪影"patch，劫持自注意力。添加 4–16 个可学习 register token 吸收这种负载并改善密集预测质量（分割、深度）。DINOv2 和 SigLIP 2 都带 register 发货。

选择对下游任务很重要。CLS 对分类很好。对于将 patch token 喂给 LLM 的 VLM，你完全跳过池化——每个 patch 变成一个 LLM 输入 token。Register 在交接前被丢弃（它们是脚手架，不是内容）。

### 预训练：监督、对比、掩码、自蒸馏

2020 年的 ViT 用 JFT-300M 上的监督分类预训练。很快被取代：

- CLIP（2021）：4 亿对的对比图像-文本。第 12.02 课。
- MAE（2021，He 等人）：掩码 75% 的 patch，重建像素。自监督，在纯图像上有效。
- DINO（2021）/ DINOv2（2023）：学生-教师的自蒸馏，无标签，无标题。2023 年的 DINOv2 ViT-g/14 是最强的纯视觉 backbone，是"密集特征"用例的默认选择。
- SigLIP / SigLIP 2（2023、2025）：带 sigmoid 损失和 NaFlex 原生纵横比的 CLIP。2026 年开源 VLM（Qwen、Idefics2、LLaVA-OneVision）的主导视觉塔。

你的预训练选择决定了 backbone 擅长什么：CLIP/SigLIP 用于与文本的语义匹配，DINOv2 用于密集视觉特征，MAE 作为下游微调的起始点。

### 缩放定律

ViT 缩放（Zhai 等人，2022）建立了 ViT 的质量在模型大小、数据大小和计算上遵循可预测的定律。在固定计算下：
- 更大的模型 + 更多数据 → 更好的质量。
- Patch size 是序列长度与保真度的杠杆。Patch 14（DINOv2/SigLIP SO400m 的典型值）每张图像产生比 patch 16 更多的 token；对 OCR 和密集任务更好，速度更差。
- 分辨率是另一个大杠杆。从 224 到 384 到 512 几乎总是有帮助，FLOPs 呈二次方增长。

ViT-g/14（1B 参数，patch 14，分辨率 224 → 256 个 token）和 SigLIP SO400m/14（400M 参数，patch 14）是 2026 年开源 VLM 的两个主力编码器。

### ViT 的参数量

完整计算在 `code/main.py` 中。对于 ViT-B/16 @ 224：

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

在加载 checkpoint 之前，用这种方式估算每个 ViT。Backbone 大小设定了任何下游 VLM 的 VRAM 底线。

### 2026 年生产配置

2026 年大多数开源 VLM 发货的编码器是原生分辨率（NaFlex）的 SigLIP 2 SO400m/14。它具有：
- 400M 参数。
- Patch size 14，默认分辨率 384 → 每张图像 729 个 patch token。
- 图像级任务用 mean pool；所有 729 个 patch 流入 LLM 用于 VQA。
- 4 个 register token，在 LLM 交接前丢弃。
- 2D-RoPE，带图像级缩放用于原生纵横比。

该配置中的每个决定都可以追溯到你可读的论文。

## 使用它

`code/main.py` 是一个 patch tokenizer 和几何计算器。它接受（image H、W、patch P、hidden D、depth L）并报告：

- Patch 后的网格形状和序列长度。
- 合成 8x8 像素 toy 图像的 token 序列（走过 flatten + project 路径）。
- 按 patch embed、position embed、transformer block 和 head 分解的参数量。
- 目标分辨率下每次前向传播的 FLOPs。
- ViT-B/16 @ 224、ViT-L/14 @ 336、DINOv2 ViT-g/14 @ 224、SigLIP SO400m/14 @ 384 的比较表。

运行它。将参数量与已发布数字匹配。玩 patch size 和分辨率以感受 token 数量的成本。

## 交付它

本课产出 `outputs/skill-patch-geometry-reader.md`。给定 ViT 配置（patch size、分辨率、hidden dim、depth），它产生 token 数量、参数量和 VRAM 估计及理由。每当你为 VLM 选择视觉 backbone 时使用此技能——它防止"token 爆炸且我的 LLM 上下文填满"的惊喜。

## 练习

1. 计算 Qwen2.5-VL 在原生 1280x720 输入、patch size 14 时的 patch-token 序列长度。与仅 CLS 表示相比如何？

2. 1080p 帧（1920x1080）在 patch 14 时产生多少 token？在 30 FPS 下 5 分钟视频，总共多少视觉 token？哪种节省成本最多：池化、帧采样还是 token 合并？

3. 用纯 Python 实现 patch token 上的 mean pooling。验证对 DINOv2 输出的 196 个 token 的 mean-pool 与模型 `forward` 在请求 pooled embedding 时返回的匹配。

4. 阅读 "Vision Transformers Need Registers"（arXiv:2309.16588）的第 3 节。用两句话描述 register 吸收什么伪影以及为什么对下游密集预测很重要。

5. 修改 `code/main.py` 以支持 patch-n'-pack：给定不同分辨率的图像列表，产生单个打包序列和块对角注意力掩码。到达第 12.06 课时与之验证。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Patch | "16x16 像素方块" | 输入图像的固定大小不重叠区域；变成一个 token |
| Patch embedding | "线性投影" | 共享学习矩阵（或 stride=P 的 Conv2d）将展平的 patch 像素映射到 D 维向量 |
| CLS token | "Class token" | 前置的可学习向量，其最终 hidden state 代表整个图像；2026 年可选 |
| Register token | "Sink token" | 额外的可学习 token，吸收 ViT 在预训练期间发展出的高范数注意力伪影 |
| Position embedding | "位置信息" | 使序列顺序感知的每位置向量或旋转；2D-RoPE 是现代默认 |
| Grid | "Patch grid" | 给定分辨率和 patch size 的 (H/P) x (W/P) 2D patch 数组 |
| NaFlex | "原生灵活分辨率" | SigLIP 2 特性：单个模型服务多种纵横比和分辨率，无需重新训练 |
| Backbone | "Vision tower" | 预训练图像编码器，其 patch-token 输出在 VLM 中喂给 LLM |
| Pooling | "图像级摘要" | 将 patch token 变成单个向量的策略：CLS、mean、attention pool 或基于 register |
| Patch 14 vs 16 | "更细 vs 更粗网格" | Patch 14 每张图像产生更多 token，OCR 保真度更好，更慢；patch 16 是经典默认 |

## 延伸阅读

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929)——原始 ViT。
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377)——MAE，自监督预训练。
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193)——大规模自蒸馏，无标签。
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588)——register token 和伪影分析。
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)——2026 年默认视觉塔。
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560)——经验缩放定律。
