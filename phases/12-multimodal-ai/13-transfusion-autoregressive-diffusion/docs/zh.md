# 13 · Transfusion：在一个 Transformer 中融合自回归文本与扩散图像

> Chameleon 和 Emu3 把全部赌注押在离散 token 上。它们确实有效，但量化瓶颈清晰可见——图像质量停滞在连续空间扩散模型之下。Transfusion（Meta，Zhou 等人，2024 年 8 月）押了反向的赌注：让图像保持连续，彻底丢掉 VQ-VAE，用两个损失训练一个 transformer。文本 token 使用「下一 token 预测（next-token-prediction）」。图像 patch 使用「流匹配（flow-matching）」/ 扩散损失。两个目标优化同一套权重。Stable Diffusion 3 底层的架构（MMDiT）是它的近亲。本课研读 Transfusion 的核心论点，构建一个玩具级双损失训练器，并梳理那张让单个 transformer 同时胜任两项工作的注意力掩码。

**类型：** 构建
**语言：** Python（标准库，在 MNIST 规模玩具数据上的双损失训练器）
**前置：** 第 12 阶段 · 11（Chameleon）、第 8 阶段（生成式 AI）
**时长：** 约 180 分钟

## 学习目标

- 搭建一个在同一主干上跑两个损失的 transformer（文本 token 上的 NTP，图像 patch 上的扩散 MSE）。
- 解释为什么「图像 patch 间双向注意力 + 文本 token 上因果注意力」是正确的掩码选择。
- 在算力、质量和代码复杂度三个维度上，比较 Transfusion 式（连续图像、扩散损失）与 Chameleon 式（离散图像、NTP）。
- 指出 MMDiT 的贡献：每个 block 内按模态划分的权重，以及在残差流上的联合注意力。

## 问题所在

离散与连续图像 token 之争比大语言模型还要古老。连续表示（原始像素、VAE 潜变量）保留细节。离散 token（VQ 索引）契合 transformer 原生的词表，但在量化这一步丢失细节。

Chameleon / Emu3 走了离散路线：一个损失、一套架构，但图像保真度被 tokenizer 质量封顶。

扩散模型走了连续路线：图像质量出众，但它是独立于大语言模型的另一个模型，需要复杂的噪声调度工程，且无法与文本生成干净地集成。

Transfusion 提出的问题是：能否兼得？让图像保持连续，仍然只训练一个模型，用两个缝合进同一个梯度步的损失。

## 核心概念

### 双损失架构

一个纯解码器（decoder-only）transformer 处理一个序列，序列中包含：

- 文本 token（离散，来自 BPE 词表）。
- 图像 patch（连续，16x16 像素块，通过线性嵌入投影到隐藏维度——与 ViT 编码器的输入相同）。
- `<image>` 和 `</image>` 标签，标记连续 patch 所在的位置。

前向传播只跑一次。损失为每个 token 选择两个 head 之一：

- 对文本 token：在词表 logits head 上的标准交叉熵。
- 对图像 patch：连续 patch 上的扩散损失——预测加到每个 patch 上的噪声。

梯度流经共享的 transformer 主体。两个损失同时改进共享权重。

### 注意力掩码：因果文本 + 双向图像

文本 token 必须是因果的——不能让某个文本 token 注意到未来的文本，否则 teacher forcing 就会失效。图像 patch 则不同，它们代表一张快照；在同一图像 block 内部，它们应当彼此双向地相互注意。

掩码：

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i_image_end)   # text attends to previous images
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

在训练和推理时实现为一张分块三角（block-triangular）掩码。

### transformer 内部的扩散损失

扩散损失是标准做法：给一个图像 patch 加噪声，让模型预测噪声（或等价地预测干净 patch）。Transfusion 的版本采用流匹配——预测从带噪到干净的速度场（velocity field）。

训练时：
1. 对每个图像 patch x0，采样一个随机时间步 t。
2. 采样噪声 ε，计算 xt = (1-t) * x0 + t * ε（流匹配的线性插值）。
3. transformer 预测 v_theta(xt, t)；loss = MSE(v_theta(xt, t), ε - x0)。
4. 与来自同一序列的文本 NTP 损失一起反向传播。

推理时，生成过程为：
- 文本 token：标准自回归采样。
- 图像 patch：以前面的文本 token 为条件的扩散采样循环（典型为 10-30 步）。

### MMDiT：Stable Diffusion 3 的变体

Stable Diffusion 3（Esser 等人，2024 年 3 月）发布的 MMDiT（多模态扩散 Transformer，Multimodal Diffusion Transformer）与 Transfusion 几乎同时问世。两者的架构是同胞。

MMDiT 的关键差异：

- 每个 block 按模态划分的权重。每个 transformer block 对文本 token 与图像 patch 分别拥有独立的 Q、K、V 和 MLP 权重。注意力是联合的（跨模态）；其余一切都是按模态划分的。
- 修正流（rectified flow）训练。一种特定的流匹配变体，采样过程已知，数学比 DDPM 更简单。
- 规模。MMDiT 是 SD3 的主干（2B 和 8B 参数变体）。Transfusion 的论文扩展到了 7B。

两者都收敛到同一个核心思想：一个 transformer 在文本上跑 NTP，在连续图像表示上跑扩散。

### 为什么它胜过 Chameleon 式

在图像生成上，连续-扩散与离散-NTP 之间的质量差距是可量化的。Transfusion 论文报告：

- 在 7B 参数下，FID 比同等规模的 Chameleon 式模型高出（更好）3-5 分。
- 无需训练 tokenizer——图像编码器更简单（线性投影到隐藏维度，与 ViT 的输入层相同）。
- 推理可以并行化图像 patch 的去噪，这与自回归图像 token 不同。

缺点：Transfusion 是双损失模型，使训练动态更棘手。损失权重需要调优。NTP 与扩散之间的调度不匹配可能导致某个 head 占据主导。

### 下游是什么

Janus-Pro（第 12.15 课）改进了 Transfusion 的思路，把用于理解和用于生成的视觉编码器解耦——一个用 SigLIP，另一个用 VQ——同时共享 transformer 主体。Show-o（第 12.14 课）把扩散换成了离散扩散（掩码预测）。在 Transfusion 之后，统一生成（unified-generation）家族迅速分支。

2026 年能够生成图像的生产级视觉语言模型（VLM）——Gemini 3 Pro、GPT-5、Claude Opus 4.7 的图像生成路径——几乎可以肯定使用了这个家族的某个后代。具体细节属于专有信息。

## 动手用

`code/main.py` 在一个极小的类 MNIST 问题上构建了一个玩具级 Transfusion：

- 文本标题（caption）是描述某个数字（0-9）的短整数序列。
- 图像是 4x4 的字节网格。
- 一对共享权重的线性投影充当 transformer 的替身；文本上跑 NTP 损失，带噪 patch 上跑 MSE 损失。
- 训练循环交替两个损失，注意力掩码是显式的。
- 生成在一次前向传播中产出一段文本标题和一张 4x4 图像。

那个 transformer 只是玩具。真正的产出物是双损失的管道布置、注意力掩码的构造，以及推理循环。

## 交付物

本课产出 `outputs/skill-two-loss-trainer-designer.md`。给定一个新的多模态训练任务（文本 + 图像、文本 + 音频、文本 + 视频），它会设计双损失调度方案（损失权重、掩码形状、共享 block 与按模态划分 block 的取舍），并标出实现风险。

## 练习

1. 一个 Transfusion 式模型训练时有 70% 是文本 token、30% 是图像 patch。图像扩散损失的量级约为文本 NTP 损失的 10 倍。什么样的损失权重能让它们平衡？

2. 为序列 `[T, T, <image>, P, P, P, P, </image>, T]` 实现分块三角掩码。把每个条目标为 0 或 1。

3. MMDiT 拥有按模态划分的 QKV 权重。相比 Transfusion 完全共享的 transformer，这会增加多少参数量开销？在 7B 参数下，这值得吗？

4. 生成：给定一个文本提示，模型先跑 50 个 token 的 NTP，然后命中 `<image>`，接着在 256 个 patch 上跑 20 步去噪的扩散。一共需要多少次前向传播？

5. 阅读 SD3 论文第 3 节。描述修正流，以及为什么它能在比 DDPM 更少的推理步数内收敛。

## 关键术语

| 术语 | 人们怎么说 | 它实际意味着什么 |
|------|-----------------|------------------------|
| 双损失训练 | "NTP + 扩散" | 单个 transformer 在同一个梯度步中同时优化文本 token 上的交叉熵和连续图像 patch 上的 MSE |
| 流匹配 | "修正流" | 一种扩散变体，预测从噪声到干净数据的速度场；数学比 DDPM 更简单 |
| MMDiT | "多模态 DiT" | Stable Diffusion 3 的架构：联合注意力，按模态划分的 MLP 和 norm |
| 分块三角掩码 | "因果文本 + 双向图像" | 一种注意力掩码，跨文本是因果的，但在图像区域内部是双向的 |
| 连续图像表示 | "无 VQ" | 把图像 patch 表示为实数值向量，而非整数码本索引 |
| 速度预测 | "v-参数化" | 网络输出的是噪声与数据之间的速度场，而非噪声本身 |

## 延伸阅读

- [Zhou 等人 — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser 等人 — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao 等人 — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie 等人 — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
