# Vision Transformer 与 patch-token 原语

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 在做任何多模态之前，图像必须先变成 transformer 能吃下的 token 序列。2020 年的 ViT 论文给出的答案是：16x16 像素的 patch、一个线性投影、再加上位置 embedding（嵌入）。五年过去，到了 2026 年，每一个前沿模型（原生 2576px 的 Claude Opus 4.7、Gemini 3.1 Pro、Qwen3.5-Omni）依然从这里起步——encoder 从 ViT 换成 DINOv2 再换成 SigLIP 2，加入了 register token，位置编码也变成了 2D-RoPE，但这条原语没变。本课会从头到尾读完 patch-token 流水线，并用 stdlib Python 把它搭出来，让 Phase 12 后面的内容对「视觉 token」有一个具体的心理模型。

**Type:** Learn
**Languages:** Python (stdlib, patch tokenizer + geometry calculator)
**Prerequisites:** Phase 7 (Transformers), Phase 4 (Computer Vision)
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 把一张 HxWx3 的图像转成带正确位置编码的 patch token 序列。
- 给定 (patch size, 分辨率, hidden dim, 深度) 时，能算出一个 ViT 的序列长度、参数量和 FLOPs。
- 说出 ViT 从 2020 年的研究走到 2026 年生产环境所经历的三次升级：自监督预训练（DINO / MAE）、register token 以及原生分辨率打包（native-resolution packing）。
- 在 CLS pooling、mean pooling 与 register token 之间为下游任务做出选择。

## 问题（The Problem）

transformer 处理的是向量序列。文本本来就是序列（字节或 token）。但图像是 2D 像素网格，外加三个颜色通道——并不是序列。如果你把每个像素都拍平，一张 224x224 的 RGB 图就变成 150,528 个 token，self-attention 在这个长度上根本跑不动（序列长度的二次方复杂度）。

2020 年之前的做法是在前面挂一个 CNN 特征提取器：ResNet 输出一张 7x7 的特征图，每个位置是 2048 维向量，把这 49 个 token 喂给 transformer。能用，但继承了 CNN 的归纳偏置（平移等变、局部感受野），也丢掉了 transformer 对 scale（规模）的胃口。

Dosovitskiy 等人（2020）干脆地问了一句：那如果我们不要 CNN 呢？把图像切成固定大小的 patch（比如 16x16 像素），每个 patch 线性投影成一个向量，加上一个位置 embedding，把这条序列喂给一个原味 transformer。当时这是异端——视觉不要卷积。但只要数据够多（先是 JFT-300M，后来是 LAION），它在 ImageNet 上就能干掉 ResNet，而且越做越好。

到 2026 年，ViT 这个原语已是毫无争议的地基。所有开源权重 VLM 的视觉塔都是它的某个后裔（DINOv2、SigLIP 2、CLIP、EVA、InternViT）。问题不再是「我们要不要用 patch」，而是「patch 多大、分辨率怎么排、预训练目标是什么、位置编码怎么选」。

## 概念（The Concept）

### Patch 即 token

给定一张形状为 `(H, W, 3)` 的图像 `x` 和 patch 大小 `P`，把图像切成 `(H/P) x (W/P)` 的网格，patch 之间不重叠。每个 patch 是一个 `P x P x 3` 的像素立方体。把每个立方体拍平成一个 `3 P^2` 维的向量。再用一个共享的、形状为 `(3 P^2, D)` 的线性投影 `W_E`，把每个 patch 映射到模型的隐藏维度 `D`。

ViT-B/16 的标准配置如下：
- 分辨率 224，patch size 16 → 网格 14x14 → 196 个 patch token。
- 每个 patch 有 `16 x 16 x 3 = 768` 个像素值，投影到 `D = 768`。
- 加上一个可学习的 `[CLS]` token → 序列长度 197。

数学上，patch 投影等价于一个 kernel size `P`、stride `P`、输出通道为 `D` 的 2D 卷积。生产代码就是这么实现的——`nn.Conv2d(3, D, kernel_size=P, stride=P)`。「线性投影」是概念框架；卷积核框架更高效。

### 位置编码（Positional embeddings）

patch 本身没有先后顺序——transformer 看到的是一袋 patch。早期 ViT 加的是可学习的 1D 位置编码（每个位置一个 768 维向量，共 197 个）。能用，但模型被绑死在训练分辨率上：推理时一旦换了网格大小，就得对位置表做插值。

现代视觉骨干用的是 2D-RoPE（Qwen2-VL 的 M-RoPE、SigLIP 2 的默认方案）或者分解式 2D 位置编码。2D-RoPE 根据 patch 的 (行, 列) 索引旋转 query 和 key 向量，模型从旋转角度里推出相对 2D 位置。不需要位置表。模型在推理时能处理任意网格大小。

### CLS token、池化输出、register token

那图像级别的表征到底是什么？三种选择并存：

1. `[CLS]` token。在 patch 序列前面拼一个可学习向量。所有 transformer block 跑完后，CLS token 的隐藏状态就是图像表征。沿用自 BERT。原版 ViT 和 CLIP 用这个。
2. Mean pool。对所有 patch token 的输出隐藏状态求平均。SigLIP、DINOv2 以及大多数现代 VLM 用这个。
3. Register token。Darcet 等人（2023）发现，没有显式 sink token 的 ViT 在训练后会冒出一些高范数的「artifact（伪影）」patch，把 self-attention 劫持掉。加 4–16 个可学习的 register token 能吸收这部分负载，提升稠密预测（分割、深度估计）的质量。DINOv2 和 SigLIP 2 都默认带 register。

这个选择对下游任务很关键。CLS 做分类够用。把 patch token 喂进 LLM 的 VLM 干脆不池化——每个 patch 都是 LLM 的输入 token。Register 在交接给 LLM 之前会被丢掉（它们是脚手架，不是内容）。

### 预训练：监督、对比、掩码、自蒸馏

2020 年的 ViT 是在 JFT-300M 上做监督分类预训练。很快就被取代了：

- CLIP（2021）：4 亿对图文做对比学习。详见 Lesson 12.02。
- MAE（2021，He et al.）：mask 掉 75% 的 patch，再重建像素。自监督，纯图像就能做。
- DINO（2021）/ DINOv2（2023）：师生架构的自蒸馏，不需要标签也不需要 caption。2023 年的 DINOv2 ViT-g/14 是最强的纯视觉骨干，「稠密特征」类任务的默认选择。
- SigLIP / SigLIP 2（2023, 2025）：把 CLIP 的损失换成 sigmoid，再加 NaFlex 支持原生宽高比。2026 年开源 VLM（Qwen、Idefics2、LLaVA-OneVision）的主流视觉塔。

预训练目标决定骨干擅长什么：CLIP/SigLIP 适合和文本做语义匹配，DINOv2 适合稠密视觉特征，MAE 适合作为下游微调（fine-tune）的起点。

### 缩放定律（Scaling laws）

ViT 缩放定律（Zhai et al. 2022）确立了：在模型规模、数据规模、算力上，ViT 的质量遵循可预测的规律。固定算力下：
- 更大模型 + 更多数据 → 更好质量。
- patch size 是「序列长度 vs. 保真度」的杠杆。Patch 14（DINOv2/SigLIP SO400m 的常见选择）比 patch 16 每张图给出更多 token；OCR 和稠密任务更好，但更慢。
- 分辨率是另一根大杠杆。从 224 到 384 再到 512，几乎总是有提升，代价是 FLOPs 二次增长。

ViT-g/14（10 亿参数，patch 14，分辨率 224 → 256 个 token）和 SigLIP SO400m/14（4 亿参数，patch 14）是 2026 年开源 VLM 的两台主力 encoder。

### ViT 的参数量

完整计算见 `code/main.py`。以 224 分辨率的 ViT-B/16 为例：

```
patch_embed = 3 * 16 * 16 * 768 + 768  =  591k
cls + pos    = 768 + 197 * 768          =  152k
block        = 4 * 768^2 (QKVO) + 2 * 4 * 768^2 (MLP) + 2 * 2*768 (LN)
             = 12 * 768^2 + 3k          =  7.1M
12 blocks    = 85M
final LN    = 1.5k
total       ≈ 86M
```

加载 checkpoint 之前，先这样估算每一个 ViT 的参数量。骨干大小决定了下游 VLM 的 VRAM 下限。

### 2026 年的生产配置

2026 年大多数开源 VLM 用的 encoder 是原生分辨率（NaFlex）的 SigLIP 2 SO400m/14。它的配置是：
- 4 亿参数。
- patch size 14，默认分辨率 384 → 每张图 729 个 patch token。
- 图像级任务用 mean pool；做 VQA 时 729 个 patch 全部进 LLM。
- 4 个 register token，交接给 LLM 之前丢掉。
- 2D-RoPE 配图像级缩放，支持原生宽高比。

这个配置里的每一个决定，都能追溯到一篇你能读到的论文。

## 用起来（Use It）

`code/main.py` 是一个 patch tokenizer 加几何计算器。给它 (图像 H, W, patch P, hidden D, 深度 L)，它会输出：

- 切完 patch 后的网格形状和序列长度。
- 一张合成 8x8 像素玩具图的 token 序列（走一遍 flatten + 投影路径）。
- 按 patch embed、位置 embed、transformer block、head 拆分的参数量。
- 在目标分辨率下每次前向传播的 FLOPs。
- 一张对比表，覆盖 ViT-B/16 @ 224、ViT-L/14 @ 336、DINOv2 ViT-g/14 @ 224、SigLIP SO400m/14 @ 384。

跑一遍。把算出来的参数量和论文公布的对上号。改改 patch size 和分辨率，亲身感受 token 数的代价。

## 上线部署（Ship It）

本课产出 `outputs/skill-patch-geometry-reader.md`。给它一个 ViT 配置（patch size、分辨率、hidden dim、深度），它会算出 token 数、参数量和 VRAM 估计，并给出依据。每次为 VLM 挑视觉骨干时都用这个 skill——能避免「token 数爆了，LLM 上下文也满了」的惊喜。

## 练习（Exercises）

1. 算一下 Qwen2.5-VL 在原生 1280x720 输入、patch size 14 时的 patch-token 序列长度。和只用 CLS 的表征比起来差多少？

2. 一帧 1080p 画面（1920x1080）在 patch 14 下产生多少个 token？一段 5 分钟、30 FPS 的视频总共有多少个视觉 token？池化、抽帧、token merging 这三种省钱方案，哪个省得最多？

3. 用纯 Python 实现 patch token 上的 mean pooling。验证：对 DINOv2 输出的 196 个 token 做 mean-pool，结果应该和你向模型 `forward` 索要 pooled embedding 时拿到的一致。

4. 读一遍 “Vision Transformers Need Registers”（arXiv:2309.16588）的 Section 3。用两句话描述：register 吸收的是哪一种 artifact，以及为什么这对下游稠密预测很重要。

5. 改造 `code/main.py` 支持 patch-n'-pack：给一组分辨率不同的图像，输出一条打包后的序列以及块对角的 attention mask。等你做到 Lesson 12.06 时再回来对一下。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|------|----------------|------------------------|
| Patch | 「16x16 像素方块」 | 输入图像中固定大小、互不重叠的一块区域；变成一个 token |
| Patch embedding | 「线性投影」 | 一个共享的可学习矩阵（或 stride=P 的 Conv2d），把拍平的 patch 像素映射成 D 维向量 |
| CLS token | 「类别 token」 | 拼在序列前面的可学习向量，最终隐藏状态代表整张图像；2026 年可选 |
| Register token | 「sink token」 | 额外的可学习 token，吸收 ViT 在预训练中发展出的高范数 attention artifact |
| Position embedding | 「位置信息」 | 每个位置一个向量或一次旋转，让序列具备顺序感知；2D-RoPE 是当下默认 |
| Grid | 「patch 网格」 | 给定分辨率与 patch size 下，patch 排成的 (H/P) x (W/P) 2D 数组 |
| NaFlex | 「原生柔性分辨率」 | SigLIP 2 的特性：同一个模型不重训就能服务多种宽高比和分辨率 |
| Backbone | 「视觉塔」 | 预训练好的图像 encoder，其 patch token 输出在 VLM 中喂给 LLM |
| Pooling | 「图像级摘要」 | 把 patch token 收敛成一个向量的策略：CLS、mean、attention pool 或基于 register |
| Patch 14 vs 16 | 「更细 vs 更粗的网格」 | Patch 14 每张图 token 更多，OCR 保真度更好但更慢；patch 16 是经典默认 |

## 延伸阅读（Further Reading）

- [Dosovitskiy et al. — An Image is Worth 16x16 Words (arXiv:2010.11929)](https://arxiv.org/abs/2010.11929) — 原版 ViT。
- [He et al. — Masked Autoencoders Are Scalable Vision Learners (arXiv:2111.06377)](https://arxiv.org/abs/2111.06377) — MAE，自监督预训练。
- [Oquab et al. — DINOv2 (arXiv:2304.07193)](https://arxiv.org/abs/2304.07193) — 大规模自蒸馏，无标签。
- [Darcet et al. — Vision Transformers Need Registers (arXiv:2309.16588)](https://arxiv.org/abs/2309.16588) — register token 与 artifact 分析。
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) — 2026 年默认视觉塔。
- [Zhai et al. — Scaling Vision Transformers (arXiv:2106.04560)](https://arxiv.org/abs/2106.04560) — 实证缩放定律。
