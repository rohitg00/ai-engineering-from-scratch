# 视觉自回归建模（VAR）：next-scale prediction

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> diffusion 模型在时间维度上迭代采样（去噪步），而 VAR 在尺度维度上迭代采样——先预测一个 1x1 的 token，然后是 2x2、4x4，一路推到最终分辨率，每一个尺度都以前一个尺度为条件。2024 年的论文证明 VAR 在图像生成上能匹配 GPT 风格的 scaling law，并在同等算力下击败 DiT。本课就来实现这个核心机制。

**Type:** Build
**Languages:** Python (with PyTorch)
**Prerequisites:** Phase 7 Lesson 03 (Multi-Head Attention), Phase 8 Lesson 06 (DDPM)
**Time:** ~90 minutes

## 问题（Problem）

autoregressive（自回归）生成之所以统治了语言建模，是因为它能可预测地 scale：算力越多、参数越大，perplexity 越低、输出越好。在 2024 年之前，图像生成领域有两条主要的 AR 路线：PixelRNN/PixelCNN（逐像素）和 DALL-E 1 / Parti / MuseGAN（在 VQ-VAE codes 上逐 token）。

两者都受困于一个生成顺序问题。像素和 token 是排在二维网格上的，但 AR 模型必须按一维 raster 顺序去访问它们。一个早期的角落像素根本不知道整张图最终会变成什么。生成质量的 scaling 比 GPT-on-text 差得多，在同等算力下也始终摸不到 diffusion 模型的水平。

VAR 通过改变「生成的对象」来修复这个生成顺序问题。它不再在空间上逐个预测图像 token，而是以递增分辨率预测整张图。第 1 步：预测一个 1x1 的 token（整张图的「摘要」）。第 2 步：预测一个 2x2 的 token 网格（更粗的特征）。第 3 步：预测一个 4x4 的网格。第 K 步：预测最终的 (H/8)x(W/8) 网格。

每个尺度都对所有之前的尺度做 attention（在「尺度顺序」上是 causal 的），而在自己尺度内部并行。顺序问题消失了：尺度 k 上的整张图在一次 transformer forward 里就生成出来。

## 概念（Concept）

### 多尺度 VQ-VAE tokenizer（VQ-VAE Multi-Scale Tokenizer）

VAR 需要一个**多尺度离散 tokenizer**。对一张图像 x，它会产出一串分辨率逐级提升的 token 网格：

```
x -> encoder -> latent f
f -> tokenize at 1x1: token grid z_1 of shape (1, 1)
f -> tokenize at 2x2: token grid z_2 of shape (2, 2)
...
f -> tokenize at (H/p)x(W/p): token grid z_K of shape (H/p, W/p)
```

每个 z_k 都用同一份 codebook（典型大小 4096–16384）。各尺度的 tokenization 不是相互独立的——训练目标是让各尺度残差相加后能重建 f：

```
f ≈ upsample(embed(z_1), target_size) + ... + upsample(embed(z_K), target_size)
```

这是一种 **residual VQ** 变体。尺度 k 捕捉的是尺度 1..k-1 没拿到的部分。decoder 把所有尺度的 embedding 加起来，再生成图像。

多尺度 VQ tokenizer 训练一次（类似 VQGAN）然后冻结。所有生成工作都由其上的 autoregressive 模型来完成。

### Next-Scale Prediction

生成模型是一个 transformer，它能看到所有之前尺度的 token，并预测下一尺度的 token。

输入序列结构：
```
[START, z_1 tokens, z_2 tokens, z_3 tokens, ..., z_K tokens]
```

位置编码同时编码尺度索引和该尺度内的空间位置。Attention 在尺度顺序上是 causal 的：尺度 k、位置 (i, j) 的 token 可以 attend 到尺度 1..k 内的所有 token，以及尺度 k 自身按某种 intra-scale 顺序排在它之前的 token（VAR 用的是固定的位置 attention，不做 intra-scale causality——一个尺度内所有位置都是并行预测的）。

训练损失：在每个尺度 k 上，根据所有更早尺度的 token 预测 z_k。在离散 VQ codes 上做 cross-entropy loss。和 GPT 结构一样，只不过现在的「序列」是按尺度组织的。

### 生成（Generation）

推理时：
```
generate z_1 = sample from p(z_1)                    # 1 token
generate z_2 = sample from p(z_2 | z_1)              # 4 tokens in parallel
generate z_3 = sample from p(z_3 | z_1, z_2)         # 16 tokens in parallel
...
decode: f = sum of embed-and-upsample scales 1..K
image = VAE_decoder(f)
```

K = 10 个尺度时，生成只需 10 次 transformer forward。每次 forward 都并行产出整个尺度——尺度内部没有逐 token 的 autoregression。256x256 图像大约是 10 次 forward，而 DiT 要 28–50 次。

### 为什么 next-scale 比 next-token 更香（Why Next-Scale Wins Over Next-Token）

三个结构性优势：
1. **由粗到细契合自然图像统计。** 人类视觉感知和图像数据集都呈现出尺度相关的规律性：低频结构稳定可预测；高频细节以低频内容为条件。Next-scale prediction 利用了这一点。
2. **尺度内部并行生成。** 不像 GPT 风格的 token AR，VAR 在一个尺度上一次性产出所有 token。有效生成长度从线性变成对数级。
3. **没有生成顺序偏置。** 尺度 k 的 token 能看到整个尺度 k-1；不存在「在左」「在上」这种偏置去强迫早期 token 在后续上下文还没出现时就拍板。

### scaling law（Scaling Law）

Tian 等人证明，VAR 在 ImageNet 上的 FID 服从幂律 scaling 曲线——就像 GPT 在 perplexity 上一样。参数或算力翻倍，误差稳稳地减半。这是第一个能像语言模型那样干净展现 scaling 行为的图像生成模型。结果是 VAR 规模上的预测可以从算力推导出来，而不再是各个架构各自的经验估计。

### 与 diffusion 的关系（Relationship to Diffusion）

VAR 和 diffusion 共享同一套数据压缩故事：都把生成问题拆成一串更简单的子问题。

- Diffusion：逐步加噪声，学着撤销其中一步。
- VAR：逐步加分辨率，学着预测下一个尺度。

两者是穿过同一问题的不同坐标轴。都给出了可处理的条件分布。经验上 VAR 在推理上更快（forward 次数少，且尺度内全部并行），在 class-conditional ImageNet 上能匹配甚至打败 DiT。Text-conditional 的 VAR（VARclip、HART）是当前活跃的研究方向。

## 动手实现（Build It）

在 `code/main.py` 中你将：
1. 在合成的「图像」数据（2D 高斯环）上构建一个微型**多尺度 VQ tokenizer**。
2. 训练一个 **VAR 风格的 transformer**，让它对 token 做 next-scale-predict。
3. 通过调用 transformer 4 次（4 个尺度）然后 decode 来采样。
4. 验证按尺度组织的训练确实能让生成在尺度内并行。

这是一个玩具实现。重点是真正看到带尺度结构的 attention mask 以及尺度内并行生成跑起来。

## 上线部署（Ship It）

本课产出 `outputs/skill-var-tokenizer-designer.md`——一个用于设计多尺度 tokenizer 的 skill：尺度数、尺度比例、codebook 大小、残差共享方式、decoder 架构。

## 练习（Exercises）

1. **尺度数消融实验（ablation）。** 用 4、6、8、10 个尺度分别训练 VAR。测量重建质量与 autoregressive forward 次数的关系。尺度越多 = 残差越细 = 质量越好但 forward 越多。

2. **Codebook 大小。** 用 codebook 大小 512、4096、16384 分别训练 tokenizer。codebook 越大重建越好，但预测越难。找出拐点。

3. **尺度内并行性检查。** 对一个训练好的 VAR，显式测量其 attention pattern。在尺度 k 内，模型是不是只 attend 到跨尺度位置而不 attend 到 intra-scale？验证 mask 实现是否正确。

4. **VAR vs DiT 的 scaling。** 在同样的 ImageNet class-conditional 任务上，在匹配的参数预算下（比如 33M、130M、458M）训练 VAR 和 DiT。把 FID-vs-算力 画出来。VAR 应该在每个规模上都领先 DiT——在小规模上复现论文的结果。

5. **文本条件化。** 把 VAR 扩展到接受一个文本 embedding（CLIP pooled）作为额外条件输入，通过 adaLN 注入。这就是 HART 的 recipe（配方）。在 text-aligned 采样上 FID 能改善多少？

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|----------------------|
| VAR | "Visual AutoRegressive" | 通过在 VQ token 网格金字塔上做 next-scale prediction 来生成图像 |
| Next-scale prediction | "Predict coarser, then finer" | 模型在递增分辨率尺度上预测 token，每一步都以所有之前尺度为条件 |
| Multi-scale VQ tokenizer | "Residual VQ" | 产出 K 个分辨率递增 token 网格的 VQ-VAE，decoder 把所有尺度相加 |
| Scale k | "Pyramid level k" | K 个分辨率级别之一，从 k=1 时的 1x1 到 k=K 时的 (H/p)x(W/p) |
| Parallel-within-scale | "One forward per scale" | 尺度 k 的所有 token 都在一次 transformer forward 里预测，而非 autoregressively |
| Causal-across-scales | "Scale-ordered attention" | 尺度 k 的 token 可以 attend 到尺度 1..k 的全部，但 attend 不到 k+1..K |
| Residual VQ | "Additive tokenization" | 每个尺度的 token 编码低尺度残留下的残差；decoder 把所有尺度 embedding 相加 |
| VAR scaling law | "Image GPT scaling" | FID 在算力上服从可预测的幂律，就像语言模型的 perplexity 一样 |
| HART | "Hybrid VAR + text" | text-conditional 的 VAR 变体，把 MaskGIT 风格的迭代解码和 VAR 的尺度结构结合起来 |
| Scale position embedding | "(scale, row, col) triple" | 位置编码同时携带尺度索引和该尺度内的空间坐标 |

## 延伸阅读（Further Reading）

- [Tian et al., 2024 — "Visual Autoregressive Modeling: Scalable Image Generation via Next-Scale Prediction"](https://arxiv.org/abs/2404.02905) — VAR 论文，权威参考
- [Peebles and Xie, 2022 — "Scalable Diffusion Models with Transformers"](https://arxiv.org/abs/2212.09748) — DiT，对照用的 diffusion 基线（baseline）
- [Esser et al., 2021 — "Taming Transformers for High-Resolution Image Synthesis"](https://arxiv.org/abs/2012.09841) — VQGAN，VAR 多尺度 tokenizer 所基于的 tokenizer 家族
- [van den Oord et al., 2017 — "Neural Discrete Representation Learning"](https://arxiv.org/abs/1711.00937) — VQ-VAE，离散图像 tokenization 的基石
- [Tang et al., 2024 — "HART: Efficient Visual Generation with Hybrid Autoregressive Transformer"](https://arxiv.org/abs/2410.10812) — text-conditional 的 VAR
