# Chameleon 与 Early-Fusion 纯 Token 多模态模型

> 我们此前见过的每个 VLM 都将图像和文本分开处理。视觉 token 来自视觉编码器，流入投影器，然后在 LLM 内部与文本相遇。视觉和文本的词表从不重叠。Chameleon(Meta,2024 年 5 月)提出了一个问题：如果重叠会怎样？训练一个 VQ-VAE,将图像转换为来自共享词表的离散 token 序列。这样，每个多模态文档都是一条序列——文本 token 和图像 token 交错排列，使用单一的自回归损失。副作用是：模型可以生成混合模态的输出——在单次推理调用中交替生成文本和图像 token。本课将阅读 early-fusion 论文，并从零到一构建一个玩具版本。

**Type:** Build
**Languages:** Python(标准库，VQ-VAE 分词器 + 交错解码器)
**Prerequisites:** Phase 12 · 05, Phase 8(Generative AI)
**Time:** 约 180 分钟

## 学习目标

- 解释共享词表 + 单一损失如何改变模型的能力边界。
- 描述 VQ-VAE 如何将图像分词为离散序列，使其与 transformer 的 next-token 目标兼容。
- 说出 Chameleon 的训练稳定性技巧：QK-Norm、dropout 放置位置、LayerNorm 顺序。
- 比较 Chameleon 与 BLIP-2 的 Q-Former 方法，并说明各自何时是正确选择。

## 问题

基于适配器的 VLM(LLaVA、BLIP-2、Qwen-VL)将文本和图像视为两种不同的东西。文本 token 经过 `embed(text_token)`;图像则经过 `visual_encoder(image) → projector → ... pseudo_tokens`。模型有两条输入路径，在中途合并。

三个后果：

1. LLM 只能消费图像，不能生成图像。输出仅限于文本。
2. 混合模态文档(如文章中交替出现的段落和图像)处理起来很别扭——你要么在模型外部解析多模态输入，要么串联多次生成。
3. 分布不匹配。视觉 token 和文本 token 位于隐藏空间的不同区域，产生微妙的对齐问题。

Chameleon 拒绝了这一前提：图像只是来自共享词表的离散 token 序列。在交错文档上训练模型，使用一个损失、一个自回归解码器，就能免费解锁混合模态生成。

## 概念

### VQ-VAE 作为图像分词器

该分词器是一个向量量化变分自编码器。架构如下：

- 编码器：CNN + ViT,将图像映射为空间特征图，例如 32x32 个维度为 256 的特征。
- 码本：一个可学习的、包含 K 个向量的词表(Chameleon 使用 8192),维度同样为 256。
- 量化：对于每个空间特征，通过 L2 距离查找最近的码本条目。用整数索引替换连续特征。
- 解码器：CNN,将量化后的特征还原为像素。

训练：VAE 重建损失 + commitment 损失 + 码本损失。码本索引构成了图像的离散字母表。

对于 Chameleon:一张图像变成 32*32 = 1024 个 token,取自 8192 的词表。与文本 token(来自 LLM 的 BPE 词表，假设为 32000)拼接。最终词表：40192。transformer 处理一条序列，使用一个损失。

### 共享词表

Chameleon 的词表结合了文本 token、图像 token 和模态分隔符。每个 token 都有一个唯一的 ID。输入嵌入层将每个 ID 映射为 D 维隐藏向量。输出投影层将隐藏状态映射回词表 logits。Softmax 选取下一个 token,无论其模态为何。

分隔符很重要：`<image>` 和 `</image>` 标签括起图像 token 序列。在生成时，如果模型输出 `<image>`,下游软件就知道接下来的 1024 个 token 是需要发送给解码器进行像素渲染的 VQ 索引。

### 混合模态生成

推理是在共享词表中的 next-token 预测。例如提示词：“画一只猫并描述它。”Chameleon 输出：

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

模型自主选择顺序——它可能先产生图像再产生文本，先文本再图像，或者交错进行。相同的解码器，相同的损失。

与之相比，适配器 VLM 的生成仅限文本。Chameleon 重新打开了关于模型输出模态的问题。

### 训练稳定性 — QK-Norm、dropout、LayerNorm 顺序

Early-fusion 训练在规模扩大时是不稳定的。Chameleon 的论文记录了三个技巧：

- QK-Norm。在注意力内部的点积之前，对 query 和 key 投影应用 LayerNorm。防止深层中 logit 幅度爆炸。被 2024 年后的多个大型模型采用。
- Dropout 放置位置。在每次残差相加之后应用 dropout,而不仅仅是在注意力和 MLP 之后。当来自图像 token 的梯度可能占主导地位时，需要更强的正则化。
- LayerNorm 顺序。在残差分支上使用 Pre-LN(标准做法)，并在最后一个块的跳跃连接上增加一个额外的 LN。稳定最后几层的梯度流动。

如果没有这些技巧，34B 参数的 Chameleon 训练在多个检查点出现发散。有了它们，训练得以收敛。训练配方与架构本身同样重要。

### 分词器的重建上限

VQ-VAE 是有损压缩。在 8192 个码本条目以及每张 512x512 图像 1024 个 token 的设定下，重建 PSNR 上限约为 26-28 dB。这足以生成可辨认的图像，但明显差于连续空间扩散模型(Stable Diffusion 3 达到 32+ dB)。

分词器是瓶颈。更好的分词器(MAGVIT-v2、IBQ、SBER-MoVQGAN)可以提升这一上限。Emu3(第 12.12 课)仅通过更好的分词器就实现了 SDXL 级别的生成质量。

### Chameleon 与 BLIP-2 / LLaVA 的对比

Chameleon(early fusion,共享词表)：
- 一个损失，一个解码器。
- 生成混合模态输出。
- 分词器是质量上限。
- 成本高昂：在推理路径上，每生成一张图像都需要经过一次 VQ-VAE 解码器。

BLIP-2 / LLaVA(late fusion,分离塔结构)：
- 视觉输入，仅文本输出。
- 复用预训练的 LLM。
- 在理解能力上没有分词器瓶颈。
- 成本低：单次前向传播。

根据任务进行选择。如果需要图像生成，选择 Chameleon 系列。如果只需要理解能力，适配器 VLM 更简单，并且能复用更多预训练算力。

### Fuyu 与 AnyGPT

Fuyu(Adept,2023 年)是一种相关的方法：完全跳过单独的视觉编码器，将原始图像块通过 LLM 的输入投影进行馈送，就像它们是 token 一样，不使用分词器。比 Chameleon 更简单，但失去了共享词表的输出生成能力。

AnyGPT(Zhan et al., 2024 年)将 Chameleon 扩展到四种模态：文本、图像、语音和音乐。对每种模态使用相同的 VQ-VAE 技巧，共享同一个 transformer。实现任意到任意的生成。在第 12.16 课中有更多介绍。

```figure
vq-codebook
```

## 动手实践

`code/main.py` 构建了一个端到端的 early-fusion 玩具模型：

- 一个微型 VQ-VAE 风格的量化器，将 8x8 的图像块映射为码本索引(K=16)。
- 一个共享词表，包含(文本 id 0..31)+(图像 id 32..47)+(分隔符 48, 49)。
- 一个玩具自回归解码器(二元语法表)，在合成的说明文字 + 图像 token 序列上进行训练。
- 一个采样循环，在给定提示词时输出交替的文本 + 图像 token。

代码刻意保持 transformer 极小(使用二元语法)，以便你可以端到端地追踪信号流动。

## 投入应用

本课产出了 `outputs/skill-tokenizer-vs-adapter-picker.md`。给定一份产品规格(仅理解 vs 理解 + 生成、要求的图像质量、成本预算)，它会在 Chameleon 系列(early fusion)和 LLaVA 系列(late fusion)之间进行选择，并用定量经验规则给出理由。

## 练习

1. Chameleon 使用 K=8192 的码本条目，每张 512x512 图像对应 1024 个 token。估算相对于 24 位 RGB 图像的压缩比。这是有损的吗？有损程度如何？

2. 一张 4K 图像(3840x2160)在相同的 VQ-VAE 密度下会产生多少个图像 token?Chameleon 风格的模型能在单次推理调用中生成一张 4K 图像吗？最先崩溃的是什么——上下文长度、分词器质量，还是 KV cache?

3. 用纯 Python 实现 QK-Norm。给定一个 64 维的 query 和 key,展示 LayerNorm 前后的点积。为什么在深层网络中幅度控制很重要？

4. 阅读 Chameleon 论文中关于训练稳定性的 2.3 节。描述该论文在 34B 模型且没有 QK-Norm 的情况下观察到的确切失败模式。什么是“范数爆炸”的标志？

5. 扩展玩具解码器，使其在给定仅文本提示词时输出混合模态响应。在训练数据分布为 60% 文本优先 / 40% 图像优先的情况下，测量模型选择图像优先与文本优先的频率。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| Early fusion | “统一 token” | 图像从第一步开始就被转换为共享 transformer 词表的离散 token |
| VQ-VAE | “图像分词器” | CNN + ViT + 码本，将图像映射为 transformer 可以预测的整数索引 |
| 共享词表 | “单一词典” | 覆盖文本 + 图像 + 模态分隔符的单一 token ID 空间 |
| QK-Norm | “注意力稳定器” | 在 query 和 key 进行点积之前对其应用 LayerNorm,防止范数爆炸 |
| 混合模态生成 | “文本 + 图像输出” | 在单次推理中自主生成交错的文本和图像 token |
| 码本大小 | “K 个条目” | VQ-VAE 可以量化到的离散向量数量；在压缩率与保真度之间进行权衡 |
| 分词器上限 | “重建极限” | 解码 VQ token 可达到的最佳 PSNR;限制了模型的图像质量 |

## 延伸阅读

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)