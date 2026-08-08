# 11 · Chameleon 与纯 Token 的早期融合多模态模型

> 到目前为止我们见过的每一个视觉语言模型（VLM）都把图像和文本分开处理。视觉 token 来自视觉编码器，流入投影器（projector），然后在大语言模型（LLM）内部与文本相遇。视觉词表和文本词表从不重叠。Chameleon（Meta，2024 年 5 月）提出了一个问题：如果让它们重叠会怎样？训练一个 VQ-VAE，把图像转换为来自共享词表的离散 token 序列。如此一来，每一份多模态文档都成了一条序列——文本 token 与图像 token 交错排列，使用单一的自回归损失。一个附带效果是：模型可以生成混合模态的输出——在一次推理调用中交替产出文本和图像 token。本课将研读早期融合的核心论点，并端到端地构建一个玩具版本。

**类型：** 实践构建
**语言：** Python（标准库，VQ-VAE 分词器 + 交错解码器）
**前置：** 第 12 阶段 · 05，第 8 阶段（生成式 AI）
**时长：** 约 180 分钟

## 学习目标

- 解释为什么「共享词表 + 单一损失」会改变模型的能力边界。
- 描述 VQ-VAE 如何把一张图像分词为与 Transformer 下一 token 目标兼容的离散序列。
- 说出 Chameleon 的训练稳定性技巧：QK-Norm、dropout 放置位置、LayerNorm 排序。
- 比较 Chameleon 与 BLIP-2 的 Q-Former 方案，并说明各自适用的场景。

## 问题所在

基于适配器（adapter）的 VLM（LLaVA、BLIP-2、Qwen-VL）把文本和图像当作两种不同的东西。文本 token 经过 `embed(text_token)`；图像则经过 `visual_encoder(image) → projector → ... pseudo_tokens`。模型有两条输入路径，在中途某处合并。

由此带来三个后果：

1. LLM 只能消费图像，不能产出图像。输出只有文本。
2. 混合模态文档（如文章中段落与图片交替出现）处理起来很别扭——你要么在模型外部解析多模态输入，要么把多次生成串接起来。
3. 分布不匹配。视觉 token 和文本 token 位于隐空间的不同区域，造成微妙的对齐问题。

Chameleon 否定了这个前提：图像不过是来自共享词表的离散 token 序列。在交错文档上训练模型，一个损失、一个自回归解码器，你就能免费解锁混合模态生成能力。

## 核心概念

### VQ-VAE 作为图像分词器

这个分词器是一个向量量化变分自编码器（vector-quantized variational autoencoder，VQ-VAE）。其架构如下：

- 编码器：CNN + ViT，把图像映射为空间特征图，比如 32x32 个维度为 256 的特征。
- 码本（codebook）：一个学习得到的、包含 K 个向量的词表（Chameleon 用 8192 个），维度同样为 256。
- 量化：对每个空间特征，按 L2 距离查找最近的码本条目。用整数索引替换连续特征。
- 解码器：CNN，把量化后的特征还原为像素。

训练：VAE 重建损失 + 承诺损失（commitment loss）+ 码本损失（codebook loss）。码本索引构成了图像的离散字母表。

对 Chameleon 而言：一张图像变成 32*32 = 1024 个 token，取自大小为 8192 的词表。把它与文本 token（来自 LLM 的 BPE 词表，比如 32000）拼接起来。最终词表大小：40192。Transformer 看到的是一条序列、一个损失。

### 共享词表

Chameleon 的词表把文本 token、图像 token 和模态分隔符组合在一起。每个 token 有唯一的 ID。输入嵌入层把每个 ID 映射为一个 D 维的隐向量。输出投影把隐向量映回词表 logits。Softmax 挑出下一个 token，无论它属于哪种模态。

分隔符很重要：`<image>` 和 `</image>` 标签括起图像 token 序列。在生成时，如果模型产出了 `<image>`，下游软件就知道接下来的 1024 个 token 是要送给解码器渲染像素的 VQ 索引。

### 混合模态生成

推理就是在共享词表上做下一 token 预测。示例提示词："Draw a cat and describe it."（画一只猫并描述它。）Chameleon 产出：

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

模型自主决定顺序——它可能先图后文、先文后图，或交错穿插。同一个解码器，同一个损失。

对比之下，适配器式 VLM 的生成只能是纯文本的。Chameleon 重新打开了「模型输出模态」这个问题。

### 训练稳定性——QK-Norm、dropout、LayerNorm 排序

早期融合训练在大规模下并不稳定。Chameleon 的论文记录了三个技巧：

- QK-Norm。在注意力内部，对 query 和 key 投影施加 LayerNorm，在点积之前进行。可防止 logit 量级随深度增加而爆炸。被 2024 年之后的多个大模型采用。
- Dropout 放置位置。在每次残差相加之后都做 dropout，而不只是在注意力和 MLP 之后。当来自图像 token 的梯度可能占据主导时，需要更多正则化。
- LayerNorm 排序。残差分支上采用 Pre-LN（标准做法），外加在最后一个 block 的跳跃连接（skip connection）上额外加一个 LN。稳定最终层的梯度流动。

没有这些技巧，340 亿参数的 Chameleon 训练在多个检查点处都会发散。有了它们，训练才能收敛。训练配方与架构本身一样，都是本文的重要贡献。

### 分词器的重建天花板

VQ-VAE 是有损的。在 8192 个码本条目、每张 512x512 图像 1024 个 token 的设定下，重建的峰值信噪比（PSNR）大约封顶在 26-28 dB。这足以做出可辨识的图像生成，但明显逊于连续空间的扩散模型（Stable Diffusion 3 可达 32+ dB）。

分词器才是瓶颈。更好的分词器（MAGVIT-v2、IBQ、SBER-MoVQGAN）能抬高这个天花板。Emu3（第 12.12 课）仅凭一个更好的分词器就实现了 SDXL 级别的生成质量。

### Chameleon 对比 BLIP-2 / LLaVA

Chameleon（早期融合，共享词表）：
- 一个损失，一个解码器。
- 生成混合模态输出。
- 分词器即质量天花板。
- 昂贵：推理路径上每生成一张图像都要跑一次 VQ-VAE 解码器。

BLIP-2 / LLaVA（晚期融合，独立塔）：
- 视觉输入，仅文本输出。
- 复用预训练好的 LLM。
- 理解任务上没有分词器瓶颈。
- 便宜：单次前向传播。

按任务来选。如果你需要图像生成，选 Chameleon 系。如果你只需要理解能力，适配器式 VLM 更简单，也能复用更多预训练算力。

### Fuyu 与 AnyGPT

Fuyu（Adept，2023）是一种相关方案：完全跳过独立的视觉编码器，把原始图像 patch 当作 token 一样直接喂入 LLM 的输入投影，不需要分词器。比 Chameleon 更简单，但失去了共享词表带来的输出生成能力。

AnyGPT（Zhan 等，2024）把 Chameleon 扩展到四种模态：文本、图像、语音、音乐。对每种模态都用同样的 VQ-VAE 技巧，共享一个 Transformer。任意到任意（any-to-any）生成。第 12.16 课会更详细地讲解。

## 动手用起来

`code/main.py` 构建了一个端到端的玩具版早期融合模型：

- 一个微型 VQ-VAE 风格的量化器，把 8x8 patch 映射为码本索引（K=16）。
- 一个共享词表：（文本 id 0..31）+（图像 id 32..47）+（分隔符 48, 49）。
- 一个玩具自回归解码器（bigram 表），在合成的图说 + 图像 token 序列上训练。
- 一个采样循环，根据提示词交替产出文本 + 图像 token。

代码刻意把 Transformer 保持得极小（bigram），以便你能端到端地追踪信号流动。

## 交付产物

本课产出 `outputs/skill-tokenizer-vs-adapter-picker.md`。给定一份产品规格（仅理解 vs 理解 + 生成、所需图像质量、成本预算），它在 Chameleon 系（早期融合）和 LLaVA 系（晚期融合）之间做出选择，并用量化的经验法则给出理由。

## 练习

1. Chameleon 使用 K=8192 个码本条目，每张 512x512 图像用 1024 个 token。估算相对于 24 位 RGB 图像的压缩比。它是有损的吗？有多损？

2. 一张 4K 图像（3840x2160）在相同的 VQ-VAE 密度下会产生多少个图像 token？Chameleon 风格的模型能在一次推理调用中生成一张 4K 图像吗？最先崩溃的是什么——上下文、分词器质量，还是 KV 缓存？

3. 用纯 Python 实现 QK-Norm。给定一个 64 维的 query 和 key，展示 LayerNorm 前后的点积。为什么在深层网络中控制量级很重要？

4. 阅读 Chameleon 论文第 2.3 节关于训练稳定性的内容。描述论文在 34B 规模下不使用 QK-Norm 时观察到的确切失败模式。「范数爆炸（norm explosion）」的特征是什么？

5. 扩展玩具解码器，使其在仅有文本提示词的情况下产出混合模态响应。在训练数据分布为 60% 先文 / 40% 先图的设定下，测量模型选择先图与先文的频率各是多少。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|------------------------|
| 早期融合（Early fusion） | 「统一 token」 | 图像从第一步起就被转换为离散 token，共享 Transformer 的词表 |
| VQ-VAE | 「图像分词器」 | CNN + ViT + 码本，把图像映射为 Transformer 可预测的整数索引 |
| 共享词表（Shared vocabulary） | 「一本字典」 | 单一的 token ID 空间，涵盖文本 + 图像 + 模态分隔符 |
| QK-Norm | 「注意力稳定器」 | 在 query 和 key 点积之前对它们施加 LayerNorm，防止范数爆炸 |
| 混合模态生成（Mixed-modality generation） | 「文本 + 图像输出」 | 一次性自主产出交错文本和图像 token 的推理 |
| 码本大小（Codebook size） | 「K 个条目」 | VQ-VAE 可量化到的离散向量数量；在压缩与保真度之间权衡 |
| 分词器天花板（Tokenizer ceiling） | 「重建上限」 | 解码 VQ token 所能达到的最佳 PSNR；它界定了模型的图像质量上限 |

## 延伸阅读

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
