# 视觉自回归建模（VAR）：下一尺度预测

> 扩散模型在时间上迭代采样（去噪步）。VAR 在尺度上迭代采样——它预测 1x1 令牌，然后 2x2，然后 4x4，直到最终分辨率，每个尺度以前一个尺度为条件。2024 年的论文展示了 VAR 在图像生成上匹配了 GPT 风格的缩放定律，并在相同计算预算下击败了 DiT。本课构建核心机制。

**类型：** 构建
**语言：** Python（使用 PyTorch）
**前置知识：** 阶段 7 第 03 课（多头注意力）、阶段 8 第 06 课（DDPM）
**时间：** ~90 分钟

## 问题

自回归生成主导了语言建模，因为它可预测地缩放：更多计算、更多参数、更低困惑度、更好输出。图像生成在 2024 年之前有两个主要的 AR 尝试：PixelRNN/PixelCNN（逐像素）和 DALL-E 1 / Parti / MuseGAN（在 VQ-VAE 编码上逐令牌）。

两者都受到生成顺序问题的困扰。像素和令牌排列在 2D 网格中，但 AR 模型必须按 1D 光栅顺序访问它们。早期的角落像素不知道图像最终会变成什么。生成质量的缩放比 GPT-on-text 差，且从未在匹配计算下达到扩散模型的质量。

VAR 通过改变生成的内容来修复生成顺序问题。VAR 不是在空间中逐令牌预测图像，而是在递增分辨率下预测整个图像。步骤 1：预测 1x1 令牌（整体图像"摘要"）。步骤 2：预测 2x2 令牌网格（更粗糙的特征）。步骤 3：预测 4x4 网格。步骤 K：预测最终的 (H/8)x(W/8) 网格。

每个尺度关注所有先前尺度（在"尺度顺序"上因果地）并在其自身尺度内并行处理。顺序问题消失了：尺度 k 下的整个图像在一次 Transformer 传递中生成。

## 概念

### VQ-VAE 多尺度令牌化器

VAR 需要一个**多尺度离散令牌化器**。对于图像 x，它产生一系列逐渐更高分辨率的令牌网格：

```
x -> encoder -> latent f
f -> tokenize at 1x1: token grid z_1 of shape (1, 1)
f -> tokenize at 2x2: token grid z_2 of shape (2, 2)
...
f -> tokenize at (H/p)x(W/p): token grid z_K of shape (H/p, W/p)
```

每个 z_k 使用相同的码本（典型大小 4096-16384）。每个尺度的令牌化不是独立的——它的训练使得在每个尺度上对残差求和可以重建 f：

```
f ≈ upsample(embed(z_1), target_size) + ... + upsample(embed(z_K), target_size)
```

这是一个**残差 VQ** 变体。尺度 k 捕获了尺度 1..k-1 遗漏的内容。解码器接收所有尺度嵌入的和并产生图像。

多尺度 VQ 令牌化器训练一次（像 VQGAN），然后冻结。所有生成工作由顶部的自回归模型完成。

### 下一尺度预测

生成模型是一个 Transformer，它看到来自所有先前尺度的令牌并预测下一尺度的令牌。

输入序列结构：
```
[START, z_1 tokens, z_2 tokens, z_3 tokens, ..., z_K tokens]
```

位置编码同时编码尺度索引和尺度内的空间位置。注意力在尺度顺序上是因果的：尺度 k、位置 (i, j) 处的令牌可以关注尺度 1..k 的所有令牌以及尺度 k 自身中按某种尺度内顺序更早的令牌（VAR 使用固定的位置注意力，没有尺度内因果性——一个尺度内的所有位置并行预测）。

训练损失：在每个尺度 k，给定所有先前尺度的令牌预测令牌 z_k。离散 VQ 编码上的交叉熵损失。与 GPT 相同的结构，除了"序列"现在是尺度结构的。

### 生成

推理时：
```
generate z_1 = sample from p(z_1)                    # 1 token
generate z_2 = sample from p(z_2 | z_1)              # 4 tokens in parallel
generate z_3 = sample from p(z_3 | z_1, z_2)         # 16 tokens in parallel
...
decode: f = sum of embed-and-upsample scales 1..K
image = VAE_decoder(f)
```

对于 K = 10 个尺度，生成是 10 次 Transformer 前向传递。每次传递并行产生其整个尺度——尺度内没有逐令牌自回归。对于 256x256 图像，这大约是 10 次传递 vs DiT 的 28-50。

### 为什么下一尺度胜于下一令牌

三个结构性优势：
1. **从粗到细与自然图像统计一致。** 人类视觉感知和图像数据集都表现出尺度依赖的规律性：低频结构稳定且可预测；高频细节以低频内容为条件。下一尺度预测利用了这一点。
2. **尺度内并行生成。** 与 GPT 风格的令牌 AR 不同，VAR 在一步中产生一个尺度的所有令牌。有效生成长度是对数尺度而非线性。
3. **没有生成顺序偏差。** 尺度 k 的令牌看到尺度 k-1 的全部；没有"左"或"上"的偏差迫使早期令牌在后期上下文可用之前做出承诺。

### 缩放定律

Tian 等人证明了 VAR 在 ImageNet 上的 FID 遵循幂律缩放曲线——就像 GPT 的困惑度一样。参数或计算翻倍可靠地将错误减半。这是第一个像语言模型一样清晰地展示这种缩放行为的图像生成模型。结果是 VAR 尺度的预测变得可从计算中预测，而不是每个架构的经验猜测。

### 与扩散的关系

VAR 和扩散共享相同的数据压缩故事：两者都将生成问题分解为一系列更简单的子问题。

- 扩散：逐渐添加噪声，学会撤销一步。
- VAR：逐渐增加分辨率，学会预测下一尺度。

它们是通过问题的不同轴。两者都产生可处理的条件分布。经验上，VAR 在推理上更快（更少的传递，尺度内全部并行），并在类别条件 ImageNet 上匹配或击败 DiT。文本条件 VAR（VARclip、HART）是一个活跃的研究方向。

## 动手实现

在 `code/main.py` 中你将：
1. 在合成的"图像"数据（2D 高斯环）上构建一个微小的**多尺度 VQ 令牌化器**。
2. 训练一个 **VAR 风格 Transformer** 来下一尺度预测令牌。
3. 通过调用 Transformer 4 次（4 个尺度）并解码来采样。
4. 验证尺度有序训练使生成在尺度内并行。

这是一个玩具实现。重点是看到尺度结构的注意力遮罩和尺度内并行生成实际工作。

## 交付

本课产生 `outputs/skill-var-tokenizer-designer.md`——一个设计多尺度令牌化器的技能：尺度数量、尺度比例、码本大小、残差共享、解码器架构。

## 练习

1. **尺度数量消融。** 使用 4、6、8、10 个尺度训练 VAR。测量重建质量 vs 自回归传递次数。更多尺度 = 更精细的残差 = 更好的质量但更多传递。

2. **码本大小。** 使用码本大小 512、4096、16384 训练令牌化器。更大的码本提供更好的重建但更难的预测。找到拐点。

3. **尺度内并行检查。** 对于训练好的 VAR，显式测量注意力模式。在尺度 k 内，模型是否关注跨尺度位置但不关注尺度内位置？验证遮罩实现。

4. **VAR vs DiT 缩放。** 对于相同的 ImageNet 类别条件任务，在匹配的参数预算下（例如 33M、130M、458M）训练 VAR 和 DiT。绘制 FID vs 计算。VAR 应在每个大小上领先 DiT——在小规模上复现论文的结果。

5. **文本条件化。** 通过 adaLN 将 VAR 扩展为接受文本嵌入（CLIP 池化）作为额外条件输入。这是 HART 配方。在文本对齐采样上 FID 提高了多少？

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------------|----------------------|
| VAR | "Visual AutoRegressive" | 通过在 VQ 令牌网格金字塔上的下一尺度预测进行图像生成 |
| Next-scale prediction | "先预测粗的，再预测细的" | 模型在递增分辨率尺度下预测令牌，以所有先前尺度为条件 |
| Multi-scale VQ tokenizer | "残差 VQ" | 产生 K 个递增分辨率令牌网格的 VQ-VAE，解码器对所有尺度求和 |
| Scale k | "金字塔层级 k" | K 个分辨率级别之一，从 k=1 的 1x1 到 k=K 的 (H/p)x(W/p) |
| Parallel-within-scale | "每尺度一次前向" | 尺度 k 的所有令牌在一次 Transformer 传递中预测，而非自回归 |
| Causal-across-scales | "尺度有序注意力" | 尺度 k 的令牌可以关注尺度 1..k 的全部，但不能关注尺度 k+1..K |
| Residual VQ | "加性令牌化" | 每个尺度的令牌编码较低尺度留下的残差；解码器对所有尺度嵌入求和 |
| VAR scaling law | "图像 GPT 缩放" | FID 遵循计算上的可预测幂律，就像语言模型的困惑度 |
| HART | "混合 VAR + 文本" | 文本条件 VAR 变体，结合了 MaskGIT 风格的迭代解码和 VAR 的尺度结构 |
| Scale position embedding | "(scale, row, col) 三元组" | 位置编码同时携带尺度索引和尺度内的空间坐标 |

## 延伸阅读

- [Tian et al., 2024 — "Visual Autoregressive Modeling: Scalable Image Generation via Next-Scale Prediction"](https://arxiv.org/abs/2404.02905) — VAR 论文，权威参考
- [Peebles and Xie, 2022 — "Scalable Diffusion Models with Transformers"](https://arxiv.org/abs/2212.09748) — DiT，扩散比较基线
- [Esser et al., 2021 — "Taming Transformers for High-Resolution Image Synthesis"](https://arxiv.org/abs/2012.09841) — VQGAN，VAR 多尺度令牌化器扩展的令牌化器家族
- [van den Oord et al., 2017 — "Neural Discrete Representation Learning"](https://arxiv.org/abs/1711.00937) — VQ-VAE，离散图像令牌化的基础
- [Tang et al., 2024 — "HART: Efficient Visual Generation with Hybrid Autoregressive Transformer"](https://arxiv.org/abs/2410.10812) — 文本条件 VAR
