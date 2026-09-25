# 视觉自回归建模（VAR）：下一尺度预测

> 扩散模型在时间上迭代采样（去噪步骤）。VAR 在尺度上迭代采样——它先预测一个 1x1 的 token，然后是 2x2、4x4，直到最终分辨率，每个尺度都以前面的尺度为条件。2024 年的论文表明，VAR 在图像生成上符合 GPT 风格的缩放定律，并在相同计算预算下超越 DiT。本课构建其核心机制。

**Type:** Build
**Languages:** Python（使用 PyTorch）
**Prerequisites:** Phase 7 Lesson 03（Multi-Head Attention）、Phase 8 Lesson 06（DDPM）
**Time:** 约 90 分钟

## 问题所在

自回归生成之所以主导语言建模，是因为它具有可预测的扩展性：更多算力、更多参数、更低困惑度、更好输出。2024 年之前，图像生成主要有两次 AR 尝试：PixelRNN/PixelCNN（逐像素）和 DALL-E 1 / Parti / MuseGAN（基于 VQ-VAE 编码的逐 token）。

两者都存在生成顺序问题。像素和 token 排布在二维网格上，但 AR 模型必须按一维光栅顺序访问它们。一个较早的角落像素完全不知道图像最终会变成什么样。其生成质量的扩展性不如 GPT 在文本上的表现，在相同算力下也从未达到扩散模型的质量。

VAR 通过改变生成对象来解决生成顺序问题。VAR 不再在空间中逐个预测图像 token，而是以递增的分辨率预测整幅图像。第 1 步：预测一个 1x1 token（整体图像的“摘要”）。第 2 步：预测一个 2x2 的 token 网格（较粗的特征）。第 3 步：预测 4x4 网格。第 K 步：预测最终的 (H/8)x(W/8) 网格。

每个尺度都关注之前所有尺度（按“尺度顺序”因果地），并在自身尺度内并行。顺序问题就此消失：尺度 k 的整幅图像在一次 transformer 前向传播中生成。

## 核心概念

### VQ-VAE 多尺度分词器

VAR 需要一个**多尺度离散分词器**。对于图像 x，它生成一串分辨率逐步提高的 token 网格序列：

```
x -> encoder -> latent f
f -> tokenize at 1x1: token grid z_1 of shape (1, 1)
f -> tokenize at 2x2: token grid z_2 of shape (2, 2)
...
f -> tokenize at (H/p)x(W/p): token grid z_K of shape (H/p, W/p)
```

每个 z_k 使用同一个码本（典型大小为 4096-16384）。各尺度的分词并非相互独立——训练目标使得各尺度残差之和能重建 f：

```
f ≈ upsample(embed(z_1), target_size) + ... + upsample(embed(z_K), target_size)
```

这是**残差 VQ** 的一种变体。尺度 k 捕捉的是尺度 1..k-1 遗漏的部分。解码器取所有尺度嵌入之和并生成图像。

多尺度 VQ 分词器只训练一次（类似 VQGAN），然后冻结。所有生成工作都由其上的自回归模型完成。

### 下一尺度预测

生成模型是一个 transformer，它接收之前所有尺度的 token，并预测下一尺度的 token。

输入序列结构：
```
[START, z_1 tokens, z_2 tokens, z_3 tokens, ..., z_K tokens]
```

位置编码同时表示尺度索引和尺度内的空间位置。注意力在尺度顺序上是因果的：尺度 k 位置 (i, j) 的 token 可以关注尺度 1..k 的所有 token，以及尺度 k 自身中按所用尺度内顺序先出现的 token（VAR 使用固定的位置注意力，没有尺度内因果性——尺度内所有位置并行预测）。

训练损失：在每个尺度 k，给定之前所有尺度的 token 预测 z_k。对离散 VQ 编码计算交叉熵损失。结构与 GPT 相同，只是“序列”现在具有尺度结构。

### 生成过程

推理时：
```
generate z_1 = sample from p(z_1)                    # 1 token
generate z_2 = sample from p(z_2 | z_1)              # 4 tokens in parallel
generate z_3 = sample from p(z_3 | z_1, z_2)         # 16 tokens in parallel
...
decode: f = sum of embed-and-upsample scales 1..K
image = VAE_decoder(f)
```

对于 K = 10 个尺度，生成需要 10 次 transformer 前向传播。每次传播并行生成整个尺度——尺度内没有逐 token 的自回归。对于 256x256 的图像，这大约是 10 次传播，而 DiT 需要 28-50 次。

### 为什么下一尺度优于下一 token

三个结构性优势：
1. **由粗到细符合自然图像统计。** 人类视觉感知和图像数据集都表现出尺度依赖的规律：低频结构稳定且可预测；高频细节依赖于低频内容。下一尺度预测正是利用了这一点。
2. **尺度内并行生成。** 与 GPT 风格的 token AR 不同，VAR 一步生成一个尺度的所有 token。有效生成长度是尺度对数级而非线性级。
3. **没有生成顺序偏差。** 尺度 k 的 token 能看到整个尺度 k-1；不存在“左侧”或“上方”偏差，迫使早期 token 在后续上下文可用之前就做出承诺。

### 缩放定律

Tian 等人证明，VAR 在 ImageNet 上的 FID 遵循幂律缩放曲线——正如 GPT 在困惑度上的表现一样。参数或算力翻倍可稳定地将误差减半。这是第一个像语言模型一样清晰展现这种缩放行为的图像生成模型。其结果是，VAR 的缩放预测可以从算力推算出来，而无需针对每个架构做经验猜测。

### 与扩散模型的关系

VAR 和扩散模型有着相同的数据压缩思路：两者都将生成问题分解为一系列更容易的子问题。

- 扩散：逐步加噪，学习撤销一步。
- VAR：逐步提高分辨率，学习预测下一个尺度。

它们是穿过该问题的不同坐标轴。两者都产生可解的条件分布。实证上 VAR 推理更快（传播次数更少，且尺度内全部并行），并在类条件 ImageNet 上达到或超越 DiT。文本条件的 VAR（VARclip、HART）是活跃的研究方向。

```figure
gx-var-next-scale
```

## 动手实现

在 `code/main.py` 中你将：
1. 在合成“图像”数据（二维高斯环）上构建一个小型**多尺度 VQ 分词器**。
2. 训练一个 **VAR 风格的 transformer** 来进行下一尺度 token 预测。
3. 通过调用 transformer 4 次（4 个尺度）并解码来进行采样。
4. 验证按尺度排序的训练使尺度内生成可并行。

这是一个玩具实现。重点在于真正看到尺度结构的注意力掩码和尺度内并行的生成在运作。

## 发布成果

本课产出 `outputs/skill-var-tokenizer-designer.md` —— 一项设计多尺度分词器的技能：尺度数量、尺度比例、码本大小、残差共享、解码器架构。

## 练习

1. **尺度数量消融。** 用 4、6、8、10 个尺度训练 VAR。测量重建质量与自回归传播次数的关系。更多尺度 = 更精细的残差 = 更好的质量，但传播次数更多。

2. **码本大小。** 用码本大小 512、4096、16384 训练分词器。更大的码本带来更好的重建，但预测更难。找到拐点。

3. **尺度内并行检查。** 对于训练好的 VAR，显式测量注意力模式。在尺度 k 内，模型是关注跨尺度位置而不关注尺度内位置吗？验证掩码实现。

4. **VAR vs DiT 缩放。** 对于相同的 ImageNet 类条件任务，在匹配的参数预算下（例如 33M、130M、458M）训练 VAR 和 DiT。绘制 FID 与算力的关系。VAR 应在每个规模上都领先于 DiT——在小规模上复现论文结果。

5. **文本条件。** 扩展 VAR，通过 adaLN 接受文本嵌入（CLIP pooled）作为额外条件输入。这就是 HART 的配方。这对文本对齐采样的 FID 改善了多少？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| VAR | “Visual AutoRegressive” | 通过在 VQ token 金字塔网格上进行下一尺度预测来生成图像 |
| 下一尺度预测 | “先粗后细” | 模型在递增的分辨率尺度上预测 token，并以之前所有尺度为条件 |
| 多尺度 VQ 分词器 | “残差 VQ” | 生成 K 个分辨率递增的 token 网格的 VQ-VAE，解码器对所有尺度求和 |
| 尺度 k | “金字塔第 k 层” | K 个分辨率层级之一，从 k=1 时的 1x1 到 k=K 时的 (H/p)x(W/p) |
| 尺度内并行 | “每个尺度一次前向” | 尺度 k 的所有 token 在一次 transformer 前向传播中预测，而非自回归 |
| 尺度间因果 | “按尺度排序的注意力” | 尺度 k 的 token 可以关注尺度 1..k 的全部内容，但不能关注尺度 k+1..K |
| 残差 VQ | “加性分词” | 每个尺度的 token 编码较低尺度遗留的残差；解码器对所有尺度嵌入求和 |
| VAR 缩放定律 | “图像版 GPT 缩放” | FID 随算力遵循可预测的幂律，如同语言模型的困惑度 |
| HART | “混合 VAR + 文本” | 结合 MaskGIT 风格迭代解码与 VAR 尺度结构的文本条件 VAR 变体 |
| 尺度位置编码 | “(scale, row, col) 三元组” | 位置编码同时携带尺度索引和尺度内的空间坐标 |

## 延伸阅读

- [Tian et al., 2024 — "Visual Autoregressive Modeling: Scalable Image Generation via Next-Scale Prediction"](https://arxiv.org/abs/2404.02905) — VAR 论文，权威参考
- [Peebles and Xie, 2022 — "Scalable Diffusion Models with Transformers"](https://arxiv.org/abs/2212.09748) — DiT，扩散模型对比基线
- [Esser et al., 2021 — "Taming Transformers for High-Resolution Image Synthesis"](https://arxiv.org/abs/2012.09841) — VQGAN，VAR 的多尺度分词器所扩展的分词器家族
- [van den Oord et al., 2017 — "Neural Discrete Representation Learning"](https://arxiv.org/abs/1711.00937) — VQ-VAE，离散图像分词的基础
- [Tang et al., 2024 — "HART: Efficient Visual Generation with Hybrid Autoregressive Transformer"](https://arxiv.org/abs/2410.10812) — 文本条件 VAR