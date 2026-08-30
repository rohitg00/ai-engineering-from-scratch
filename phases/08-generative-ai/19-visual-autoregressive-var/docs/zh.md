# 19 · 视觉自回归建模（VAR）：下一尺度预测

> 扩散模型（Diffusion Model）在时间维度上迭代采样（去噪步骤）。VAR 则在尺度（scale）维度上迭代采样——它先预测一个 1x1 的 token，再预测 2x2，然后 4x4，直至最终分辨率，每个尺度都以前一个尺度为条件。2024 年的论文表明，VAR 在图像生成上能够匹配 GPT 风格的扩展律（scaling law），并且在相同算力预算下击败了 DiT。本课将构建其核心机制。

**类型：** 构建
**语言：** Python（搭配 PyTorch）
**前置：** 第 7 阶段第 03 课（多头注意力，Multi-Head Attention）、第 8 阶段第 06 课（DDPM）
**时长：** 约 90 分钟

## 问题所在

自回归（autoregressive）生成之所以主导语言建模，是因为它能可预测地扩展：更多算力、更多参数，带来更低的困惑度（perplexity）和更好的输出。在 2024 年之前，图像生成主要有两种自回归尝试：PixelRNN/PixelCNN（逐像素）和 DALL-E 1 / Parti / MuseGAN（在 VQ-VAE 编码上逐 token）。

两者都受困于一个生成顺序（generation-order）问题。像素和 token 排列在一个 2D 网格中，但自回归模型必须以 1D 光栅（raster）顺序去访问它们。一个靠前的角落像素根本不知道整张图像最终会变成什么样子。其生成质量的扩展性比 GPT-on-text 更差，在相同算力下也始终达不到扩散模型的质量。

VAR 通过改变所生成的对象来修复这个生成顺序问题。VAR 不是在空间上逐个预测图像 token，而是在不断升高的分辨率下预测整张图像。第 1 步：预测一个 1x1 的 token（整张图像的“概要”）。第 2 步：预测一个 2x2 的 token 网格（较粗的特征）。第 3 步：预测一个 4x4 的网格。第 K 步：预测最终的 (H/8)x(W/8) 网格。

每个尺度都关注（attend）此前所有尺度（在“尺度顺序”上是因果的），而在其自身尺度内则是并行的。顺序问题随之消失：尺度 k 下的整张图像在一次 transformer 前向传播中就被生成出来。

## 核心概念

### VQ-VAE 多尺度分词器

VAR 需要一个**多尺度离散分词器（multi-scale discrete tokenizer）**。对于一张图像 x，它会产生一个分辨率逐级升高的 token 网格序列：

```
x -> encoder -> latent f
f -> tokenize at 1x1: token grid z_1 of shape (1, 1)
f -> tokenize at 2x2: token grid z_2 of shape (2, 2)
...
f -> tokenize at (H/p)x(W/p): token grid z_K of shape (H/p, W/p)
```

每个 z_k 使用同一个码本（codebook，典型大小为 4096-16384）。各尺度上的分词并不独立——它经过训练，使得各尺度残差（residual）之和能够重建 f：

```
f ≈ upsample(embed(z_1), target_size) + ... + upsample(embed(z_K), target_size)
```

这是一种**残差 VQ（residual VQ）**变体。尺度 k 捕获尺度 1..k-1 所遗漏的内容。解码器接收所有尺度嵌入之和，并产出图像。

多尺度 VQ 分词器只训练一次（类似 VQGAN），随后被冻结。所有生成工作都由其上层的自回归模型完成。

### 下一尺度预测

生成模型是一个 transformer，它能看到所有先前尺度的 token，并预测下一尺度的 token。

输入序列结构：
```
[START, z_1 tokens, z_2 tokens, z_3 tokens, ..., z_K tokens]
```

位置嵌入（position embedding）同时编码尺度索引和该尺度内的空间位置。注意力在尺度顺序上是因果的：尺度 k、位置 (i, j) 处的 token 可以关注尺度 1..k 的所有 token，以及尺度 k 自身中在所用的某种尺度内顺序里更靠前的 token（VAR 使用固定的位置注意力，不带尺度内因果性——一个尺度内的所有位置都是并行预测的）。

训练损失：在每个尺度 k 上，给定所有先前尺度的 token，预测 token z_k。在离散 VQ 编码上使用交叉熵损失（cross-entropy loss）。其结构与 GPT 相同，区别仅在于现在的“序列”是按尺度结构化的。

### 生成

在推理时：
```
generate z_1 = sample from p(z_1)                    # 1 token
generate z_2 = sample from p(z_2 | z_1)              # 4 tokens in parallel
generate z_3 = sample from p(z_3 | z_1, z_2)         # 16 tokens in parallel
...
decode: f = sum of embed-and-upsample scales 1..K
image = VAE_decoder(f)
```

对于 K = 10 个尺度，生成需要 10 次 transformer 前向传播。每次传播并行产出其整个尺度——一个尺度内没有逐 token 的自回归。对于一张 256x256 图像，这大约是 10 次传播，而 DiT 需要 28-50 次。

### 为什么下一尺度优于下一 token

三个结构性优势：
1. **由粗到细与自然图像统计相契合。** 人类视觉感知和图像数据集都表现出尺度相关的规律性：低频结构稳定且可预测；高频细节则以低频内容为条件。下一尺度预测利用了这一点。
2. **尺度内并行生成。** 与 GPT 风格的逐 token 自回归不同，VAR 在一步内产出一个尺度的所有 token。有效生成长度是对数级而非线性级。
3. **没有生成顺序偏置。** 尺度 k 的 token 能看到整个尺度 k-1；不存在“左侧”或“上方”的偏置去迫使靠前的 token 在后续上下文可用之前就做出决定。

### 扩展律

Tian 等人证明，VAR 在 ImageNet 上的 FID 遵循幂律扩展曲线——正如 GPT 在困惑度上所表现的那样。参数或算力翻倍能够可靠地将误差减半。这是首个能像语言模型一样清晰地展现出这类扩展行为的图像生成模型。其结果是，VAR 规模下的预测可以从算力推算出来，而不再是每种架构靠经验去猜测。

### 与扩散模型的关系

VAR 和扩散模型共享同一个数据压缩故事：两者都将生成问题分解为一系列更易解决的子问题。

- 扩散：逐步加入噪声，学会撤销其中一步。
- VAR：逐步增加分辨率，学会预测下一个尺度。

它们是穿过该问题的不同轴线。两者都产生易处理的条件分布。经验上 VAR 在推理时更快（传播次数更少，且尺度内全部并行），并且在类别条件的 ImageNet 上匹配或击败了 DiT。文本条件的 VAR（VARclip、HART）是一个活跃的研究方向。

## 动手构建

在 `code/main.py` 中你将：
1. 在合成的“图像”数据（2D 高斯环）上构建一个微型**多尺度 VQ 分词器**。
2. 训练一个 **VAR 风格的 transformer** 来对 token 进行下一尺度预测。
3. 通过调用 transformer 4 次（4 个尺度）并解码来采样。
4. 验证按尺度顺序的训练能让生成在尺度内并行。

这是一个玩具级实现。重点是看到尺度结构化的注意力掩码（mask）以及尺度内并行生成真正运转起来。

## 交付成果

本课产出 `outputs/skill-var-tokenizer-designer.md`——一项用于设计多尺度分词器的技能：尺度数量、尺度比率、码本大小、残差共享、解码器架构。

## 练习

1. **尺度数量消融。** 用 4、6、8、10 个尺度训练 VAR。衡量重建质量与自回归传播次数的关系。尺度越多 = 残差越精细 = 质量越好但传播次数越多。

2. **码本大小。** 用 512、4096、16384 的码本大小训练分词器。更大的码本带来更好的重建，但预测更困难。找到那个拐点。

3. **尺度内并行检查。** 对一个已训练的 VAR，显式地测量其注意力模式。在尺度 k 内，模型是否关注跨尺度位置而不关注尺度内位置？验证掩码实现。

4. **VAR 对比 DiT 的扩展。** 在相同的 ImageNet 类别条件任务上，在匹配的参数预算（例如 33M、130M、458M）下训练 VAR 和 DiT。绘制 FID 与算力的关系图。VAR 应在每个规模上都领先于 DiT——在小规模上复现论文的结果。

5. **文本条件化。** 扩展 VAR，使其通过 adaLN 接收一个文本嵌入（CLIP 池化）作为额外的条件输入。这就是 HART 的配方。它在文本对齐采样上能让 FID 提升多少？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|----------------------|
| VAR | “视觉自回归（Visual AutoRegressive）” | 通过在 VQ token 网格金字塔上进行下一尺度预测来生成图像 |
| 下一尺度预测 | “先预测较粗，再预测较细” | 模型在不断升高的分辨率尺度上预测 token，并以所有先前尺度为条件 |
| 多尺度 VQ 分词器 | “残差 VQ” | 一种产出 K 个分辨率递增 token 网格的 VQ-VAE，解码器对所有尺度求和 |
| 尺度 k | “金字塔层级 k” | K 个分辨率层级之一，从 k=1 的 1x1 到 k=K 的 (H/p)x(W/p) |
| 尺度内并行 | “每尺度一次前向” | 尺度 k 的所有 token 在一次 transformer 传播中预测，而非自回归地预测 |
| 尺度间因果 | “尺度顺序注意力” | 尺度 k 的 token 可以关注尺度 1..k 的全部，但不能关注尺度 k+1..K |
| 残差 VQ | “加性分词” | 每个尺度的 token 编码较低尺度所遗留的残差；解码器对所有尺度嵌入求和 |
| VAR 扩展律 | “图像版 GPT 扩展” | FID 在算力上遵循可预测的幂律，就像语言模型的困惑度一样 |
| HART | “混合 VAR + 文本” | 文本条件的 VAR 变体，将 MaskGIT 风格的迭代解码与 VAR 的尺度结构相结合 |
| 尺度位置嵌入 | “(scale, row, col) 三元组” | 位置编码同时携带尺度索引和该尺度内的空间坐标 |

## 延伸阅读

- [Tian 等人，2024 —— “Visual Autoregressive Modeling: Scalable Image Generation via Next-Scale Prediction”](https://arxiv.org/abs/2404.02905) —— VAR 论文，权威参考
- [Peebles 与 Xie，2022 —— “Scalable Diffusion Models with Transformers”](https://arxiv.org/abs/2212.09748) —— DiT，作为扩散模型对比的基线
- [Esser 等人，2021 —— “Taming Transformers for High-Resolution Image Synthesis”](https://arxiv.org/abs/2012.09841) —— VQGAN，VAR 多尺度分词器所扩展的分词器家族
- [van den Oord 等人，2017 —— “Neural Discrete Representation Learning”](https://arxiv.org/abs/1711.00937) —— VQ-VAE，离散图像分词的基础
- [Tang 等人，2024 —— “HART: Efficient Visual Generation with Hybrid Autoregressive Transformer”](https://arxiv.org/abs/2410.10812) —— 文本条件的 VAR
