# 视觉自回归建模（VAR）：下一尺度预测

> 扩散模型在时间上迭代采样（去噪步骤）。VAR 在尺度上迭代采样——它预测一个 1x1 token，然后是 2x2，然后是 4x4，直到最终分辨率，每个尺度都以之前的尺度为条件。2024 年的论文表明，VAR 在图像生成方面匹配 GPT 风格的缩放定律，并在相同计算预算下击败 DiT。本节课构建核心机制。

**类型：** 构建
**语言：** Python（使用 PyTorch）
**先修知识：** 第 7 阶段 · 03（多头注意力）、第 8 阶段 · 06（DDPM）
**时间：** ~90 分钟

## 问题

自回归生成在语言建模中占主导地位，因为它可预测地扩展：更多计算、更多参数、更低困惑度、更好的输出。2024 年之前，图像生成有两次主要的 AR 尝试：PixelRNN/PixelCNN（逐像素）和 DALL-E 1 / Parti / MuseGAN（在 VQ-VAE 码上逐 token）。

两者都存在生成顺序问题。像素和 token 排列在二维网格中，但 AR 模型必须以一维光栅顺序访问它们。早期角落的像素不知道图像最终会变成什么样子。生成质量的缩放比 GPT-on-text 更差，在匹配计算量下从未达到扩散模型的质量。

VAR 通过改变生成内容来解决生成顺序问题。不是在空间中逐个预测图像 token，VAR 以递增分辨率预测整个图像。步骤 1：预测一个 1x1 token（整体图像"摘要"）。步骤 2：预测一个 2x2 的 token 网格（较粗特征）。步骤 3：预测一个 4x4 网格。步骤 K：预测最终的 (H/8)x(W/8) 网格。

每个尺度关注所有先前尺度（在"尺度顺序"上因果），并在其自身尺度内并行。顺序问题消失了：尺度 k 的整个图像在一次 transformer pass 中生成。

## 概念

### VQ-VAE 多尺度 Tokenizer

VAR 需要一个**多尺度离散 tokenizer**。对于图像 x，它产生一系列逐步更高分辨率的 token 网格：

```
x -> encoder -> latent f
f -> 在 1x1 处 tokenize：形状为 (1, 1) 的 token 网格 z_1
f -> 在 2x2 处 tokenize：形状为 (2, 2) 的 token 网格 z_2
...
f -> 在 (H/p)x(W/p) 处 tokenize：形状为 (H/p, W/p) 的 token 网格 z_K
```

每个 z_k 使用相同的码本（典型大小 4096-16384）。每个尺度的 tokenization 不是独立的——它经过训练，使得在每个尺度上求和残差可以重建 f：

```
f ≈ upsample(embed(z_1), target_size) + ... + upsample(embed(z_K), target_size)
```

这是一个**残差 VQ** 变体。尺度 k 捕获尺度 1..k-1 遗漏的内容。解码器取所有尺度嵌入的总和并生成图像。

多尺度 VQ tokenizer 训练一次（如 VQGAN），然后冻结。所有生成工作都由顶部的自回归模型完成。

### 下一尺度预测

生成模型是一个 transformer，它看到所有先前尺度的 token 并预测下一尺度的 token。

输入序列结构：
```
[START, z_1 tokens, z_2 tokens, z_3 tokens, ..., z_K tokens]
```

位置嵌入编码尺度索引和尺度内的空间位置。注意力在尺度顺序上是因果的：尺度 k、位置 (i, j) 的 token 可以关注尺度 1..k 的所有 token，以及尺度 k 本身中在任何尺度内顺序中更早出现的 token（VAR 使用固定位置注意力，没有尺度内因果关系——尺度内的所有位置都是并行预测的）。

训练损失：在每个尺度 k，给定所有先前尺度的 token，预测 token z_k。离散 VQ 码上的交叉熵损失。结构与 GPT 相同，只是"序列"现在是尺度结构化的。

### 生成

推理时：
```
generate z_1 = sample from p(z_1)                    # 1 个 token
generate z_2 = sample from p(z_2 | z_1)              # 4 个 token 并行
generate z_3 = sample from p(z_3 | z_1, z_2)         # 16 个 token 并行
...
decode: f = sum of embed-and-upsample scales 1..K
image = VAE_decoder(f)
```

对于 K = 10 个尺度，生成为 10 次 transformer 前向传播。每次传播并行生成其整个尺度——尺度内没有逐 token 的自回归。对于 256x256 图像，这大约是 10 次传播，而 DiT 是 28-50 次。

### 为什么下一尺度胜过下一 token

三个结构性优势：
1. **从粗到细符合自然图像统计。** 人类视觉感知和图像数据集都表现出尺度相关的规律性：低频结构稳定且可预测；高频细节以低频内容为条件。下一尺度预测利用了这一点。
2. **尺度内并行生成。** 与 GPT 风格的 token AR 不同，VAR 在一步中生成一个尺度的所有 token。有效生成长度是对数尺度而不是线性。
3. **没有生成顺序偏差。** 尺度 k 的 token 看到尺度 k-1 的全部；没有"左边"或"上面"的偏差迫使早期 token 在后期上下文可用之前做出承诺。

### 缩放定律

Tian 等人证明，VAR 在 ImageNet 上的 FID 遵循幂律缩放曲线——就像 GPT 对困惑度一样。参数或计算量翻倍可靠地将误差减半。这是第一个像语言模型一样清晰地表现出这种缩放行为的图像生成模型。结果是 VAR 尺度预测变得可以从计算量预测，而不是每个架构的经验猜测。

### 与扩散的关系

VAR 和扩散共享相同的数据压缩故事：两者都将生成问题分解为一系列更容易的子问题。

- 扩散：逐渐添加噪声，学习撤销一步。
- VAR：逐渐添加分辨率，学习预测下一尺度。

它们是问题的不同轴。两者都产生易于处理的条件分布。根据经验，VAR 在推理时更快（更少的传播，尺度内全并行），并且在类条件 ImageNet 上匹配或击败 DiT。文本条件 VAR（VARclip、HART）是一个活跃的研究方向。

## 构建它

在 `code/main.py` 中，你将：
1. 在合成"图像"数据（二维高斯环）上构建一个小型**多尺度 VQ tokenizer**。
2. 训练一个**VAR 风格的 transformer** 来对 token 进行下一尺度预测。
3. 通过调用 transformer 4 次（4 个尺度）并解码来采样。
4. 验证尺度有序训练使尺度内生成并行。

这是一个玩具实现。重点是看到尺度结构化注意力掩码和尺度内并行生成实际工作。

## 交付它

本节课生成 `outputs/skill-var-tokenizer-designer.md` —— 一个用于设计多尺度 tokenizer 的技能：尺度数量、尺度比率、码本大小、残差共享、解码器架构。

## 练习

1. **尺度数量消融。** 使用 4、6、8、10 个尺度训练 VAR。测量重建质量与自回归传播次数。更多尺度 = 更精细的残差 = 更好的质量但更多传播。

2. **码本大小。** 使用码本大小 512、4096、16384 训练 tokenizer。更大的码本提供更好的重建但更难预测。找到拐点。

3. **尺度内并行检查。** 对于训练好的 VAR，显式测量注意力模式。在尺度 k 内，模型是否关注跨尺度位置而不是尺度内位置？验证掩码实现。

4. **VAR vs DiT 缩放。** 对于相同的 ImageNet 类条件任务，在匹配参数预算下训练 VAR 和 DiT（例如 33M、130M、458M）。绘制 FID vs 计算量。VAR 应该在每个尺寸上领先于 DiT——在小规模上重现论文结果。

5. **文本条件。** 通过 adaLN 将文本嵌入（CLIP pooled）作为额外条件输入扩展 VAR。这是 HART 方案。在文本对齐采样上 FID 有多大改善？

## 关键术语

| 术语 | 人们怎么说 | 它实际是什么意思 |
|------|----------------|----------------------|
| VAR | "Visual AutoRegressive" | 通过对 VQ token 网格金字塔进行下一尺度预测来生成图像 |
| Next-scale prediction | "先预测粗的，再预测细的" | 模型以递增分辨率尺度预测 token，以所有先前尺度为条件 |
| Multi-scale VQ tokenizer | "Residual VQ" | 产生 K 个递增分辨率 token 网格的 VQ-VAE，解码器求和所有尺度 |
| Scale k | "金字塔层级 k" | K 个分辨率级别之一，从 k=1 的 1x1 到 k=K 的 (H/p)x(W/p) |
| Parallel-within-scale | "每尺度一次前向传播" | 尺度 k 的所有 token 在一次 transformer pass 中预测，不是自回归 |
| Causal-across-scales | "尺度有序注意力" | 尺度 k 的 token 可以关注尺度 1..k 的全部，但不能关注尺度 k+1..K |
| Residual VQ | "加性 tokenization" | 每个尺度的 token 编码低尺度留下的残差；解码器求和所有尺度嵌入 |
| VAR scaling law | "图像 GPT 缩放" | FID 在计算量中遵循可预测的幂律，如语言模型的困惑度 |
| HART | "Hybrid VAR + text" | 文本条件 VAR 变体，结合 MaskGIT 风格迭代解码与 VAR 的尺度结构 |
| Scale position embedding | "(scale, row, col) triple" | 位置编码携带尺度索引和尺度内的空间坐标 |

## 延伸阅读

- [Tian et al., 2024 — "Visual Autoregressive Modeling: Scalable Image Generation via Next-Scale Prediction"](https://arxiv.org/abs/2404.02905) —— VAR 论文，标准参考文献
- [Peebles and Xie, 2022 — "Scalable Diffusion Models with Transformers"](https://arxiv.org/abs/2212.09748) —— DiT，扩散比较基线
- [Esser et al., 2021 — "Taming Transformers for High-Resolution Image Synthesis"](https://arxiv.org/abs/2012.09841) —— VQGAN，VAR 多尺度 tokenizer 扩展的 tokenizer 家族
- [van den Oord et al., 2017 — "Neural Discrete Representation Learning"](https://arxiv.org/abs/1711.00937) —— VQ-VAE，离散图像 tokenization 的基础
- [Tang et al., 2024 — "HART: Efficient Visual Generation with Hybrid Autoregressive Transformer"](https://arxiv.org/abs/2410.10812) —— 文本条件 VAR
