# Chameleon 与早融合纯 token 多模态模型

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 我们前面看过的所有 VLM，都是把图像和文本分开处理。视觉 token 来自 vision encoder，经过一个 projector，再到 LLM 里跟文本汇合。视觉词表和文本词表从来不重叠。Chameleon（Meta，2024 年 5 月）抛出一个问题：要是它们重叠了呢？训一个 VQ-VAE，把图像变成来自共享词表的离散 token 序列。从此每份多模态文档都是同一条序列——文本 token 与图像 token 交错排列，一个 autoregressive loss 全包。副作用：模型在一次 inference（推理）调用里就能生成混合模态输出——文本和图像 token 交替出现。本课会读一遍这个早融合（early-fusion）的核心论点，并端到端搭一个 toy 版本。

**Type:** Build
**Languages:** Python (stdlib, VQ-VAE tokenizer + interleaved decoder)
**Prerequisites:** Phase 12 · 05, Phase 8 (Generative AI)
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 解释为什么共享词表 + 单一 loss 会改变模型能做的事情。
- 描述 VQ-VAE 如何把一张图像 tokenize 成与 transformer 的 next-token 目标兼容的离散序列。
- 说出 Chameleon 的训练稳定性技巧：QK-Norm、dropout 摆放位置、LayerNorm 顺序。
- 对比 Chameleon 与 BLIP-2 的 Q-Former 思路，说明各自适合什么场景。

## 问题（The Problem）

基于 adapter 的 VLM（LLaVA、BLIP-2、Qwen-VL）把文本和图像当成两种不同的东西。一个文本 token 走 `embed(text_token)`；一张图像走 `visual_encoder(image) → projector → ... pseudo_tokens`。模型有两条输入路径，中途才汇合。

后果有三：

1. LLM 只能消费图像，不能产出图像。输出只能是文本。
2. 混合模态文档（像文章里那样段落和图像交替）很别扭——你要么在模型外面解析多模态输入，要么把多次生成串起来。
3. 分布不匹配。视觉 token 和文本 token 落在隐空间的不同区域，造成微妙的对齐问题。

Chameleon 直接拒绝这个前提：图像就是来自共享词表的离散 token 序列。在交错文档上训练模型，一个 loss、一个 autoregressive decoder，混合模态生成就免费解锁了。

## 概念（The Concept）

### 用 VQ-VAE 当图像 tokenizer

这个 tokenizer 是一个向量量化变分自编码器（vector-quantized variational autoencoder, VQ-VAE）。架构如下：

- Encoder：CNN + ViT，把图像映射到一张空间特征图，比如 32x32 个维度为 256 的特征。
- Codebook：一个学到的、含 K 个向量的词表（Chameleon 用 8192），同样是 256 维。
- 量化（Quantization）：对每个空间特征，按 L2 距离查最近的 codebook 条目，把连续特征替换成那个整数索引。
- Decoder：CNN，把量化后的特征还原成像素。

训练目标：VAE 重建 loss + commitment loss + codebook loss。codebook 索引就构成了图像的离散字母表。

对 Chameleon 来说：一张图像变成 32*32 = 1024 个 token，从大小为 8192 的词表里抽。再把它们和文本 token（来自 LLM 的 BPE 词表，比如 32000 个）拼起来。最终词表大小：40192。transformer 看到的是一条序列，一个 loss。

### 共享词表

Chameleon 的词表把文本 token、图像 token 和模态分隔符合在一起。每个 token 有唯一 ID。输入 embedding 层把任何 ID 映射到一个 D 维隐向量。输出投影把隐向量映射回词表 logits。softmax 选下一个 token，不管是哪种模态。

分隔符很关键：`<image>` 和 `</image>` 标签把图像 token 序列括起来。生成时，模型一旦吐出 `<image>`，下游软件就知道接下来 1024 个 token 是 VQ 索引，要送进 decoder 渲染像素。

### 混合模态生成

inference 就是在共享词表上做 next-token 预测。比如一个 prompt：「画一只猫并描述它」。Chameleon 会吐出：

```
<image> 4821 1029 2891 ... (1024 image tokens) </image>
The cat is orange, sitting on a windowsill...
```

顺序由模型自主决定——可以先图后文、先文后图，也可以交错。同一个 decoder，同一个 loss。

对比 adapter 类 VLM 只能生成文本。Chameleon 重新打开了「模型输出可以是哪些模态」这个问题。

### 训练稳定性——QK-Norm、dropout、LayerNorm 顺序

早融合训练在大尺度上很不稳定。Chameleon 的论文记录了三个技巧：

- QK-Norm。在 attention 内部、点积之前对 query 和 key 投影应用 LayerNorm。防止 logit 在深层爆炸。2024 年之后多个大模型都在用。
- Dropout 摆放位置。每次残差相加之后都加 dropout，不只是 attention 和 MLP 之后。当来自图像 token 的梯度可能压过文本 token 时，需要更强的正则化。
- LayerNorm 顺序。残差分支上用 Pre-LN（标准做法），再在最后一层 block 的跳跃连接上额外加一个 LN。稳定最后一层的梯度流。

没有这些技巧，34B 参数的 Chameleon 在多个 checkpoint 上发散过。加上之后才收敛。这套训练 recipe（配方）和架构本身一样是论文的贡献。

### tokenizer 的重建上限

VQ-VAE 是有损的。在 8192 个 codebook 条目、512x512 图像 1024 个 token 的设定下，重建 PSNR 大约卡在 26-28 dB。这个值已经够生成可识别的图像，但明显不如连续空间的 diffusion（Stable Diffusion 3 能到 32+ dB）。

tokenizer 是瓶颈。更好的 tokenizer（MAGVIT-v2、IBQ、SBER-MoVQGAN）能抬高这个上限。Emu3（第 12.12 课）只靠换更好的 tokenizer 就达到了 SDXL 级的生成质量。

### Chameleon vs BLIP-2 / LLaVA

Chameleon（早融合，共享词表）：
- 一个 loss，一个 decoder。
- 能生成混合模态输出。
- tokenizer 决定质量上限。
- 贵：inference 路径上每张生成图都要跑 VQ-VAE decoder。

BLIP-2 / LLaVA（晚融合，分塔）：
- 图像进，只能文本出。
- 复用预训练好的 LLM。
- 理解任务上没有 tokenizer 瓶颈。
- 便宜：单次 forward pass。

按任务挑。要图像生成，选 Chameleon 家族。只要理解，adapter 类 VLM 更简单，也更能复用预训练算力。

### Fuyu 和 AnyGPT

Fuyu（Adept，2023）是相关思路：完全跳过单独的 vision encoder，把原始图像 patch 当作 token 喂给 LLM 的输入投影，没有 tokenizer。比 Chameleon 更简单，但失去了共享词表的输出生成能力。

AnyGPT（Zhan 等，2024）把 Chameleon 扩展到四种模态：文本、图像、语音、音乐。每种都用同样的 VQ-VAE 套路，共享同一个 transformer。任意到任意（any-to-any）生成。第 12.16 课会更深入讲。

## 用起来（Use It）

`code/main.py` 端到端搭了一个 toy 早融合模型：

- 一个迷你 VQ-VAE 风格的 quantizer，把 8x8 patch 映射到 codebook 索引（K=16）。
- 一个共享词表，包含（text id 0..31）+（image id 32..47）+（分隔符 48、49）。
- 一个 toy autoregressive decoder（bigram 表），在合成 caption + 图像 token 序列上训练。
- 一个采样循环，给定 prompt 后吐出交替的文本 + 图像 token。

这份代码故意把 transformer 写得很小（bigram），让你可以端到端追踪信号流。

## 上线部署（Ship It）

本课产出 `outputs/skill-tokenizer-vs-adapter-picker.md`。给定产品需求（只理解 vs 理解 + 生成、所需图像质量、成本预算），它会在 Chameleon 家族（早融合）和 LLaVA 家族（晚融合）之间做选择，并用定量经验法则给出依据。

## 练习（Exercises）

1. Chameleon 用 K=8192 个 codebook 条目，512x512 图像 1024 个 token。估算它相对 24 位 RGB 图像的压缩比。是有损的吗？损得多狠？

2. 在同样的 VQ-VAE 密度下，一张 4K 图像（3840x2160）会产生多少图像 token？Chameleon 风格的模型能在一次 inference 调用里生成一张 4K 图像吗？最先崩的是哪一项——context、tokenizer 质量，还是 KV cache？

3. 用纯 Python 实现 QK-Norm。给定一个 64 维的 query 和 key，给出 LayerNorm 前后的点积。为什么深层里幅值控制重要？

4. 读 Chameleon 第 2.3 节关于训练稳定性的部分。描述论文在 34B 规模、不加 QK-Norm 时观察到的具体失败模式。所谓「norm explosion」（范数爆炸）的特征是什么？

5. 扩展那个 toy decoder：给定一个纯文本 prompt，让它生成混合模态响应。在训练数据分布 60% 先文本 / 40% 先图像的设定下，测一下模型选先图还是先文的频率。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际意思 |
|------|-----------------|------------------------|
| Early fusion（早融合） | 「统一 token」 | 图像从第一步就被转成离散 token，与 transformer 共享词表 |
| VQ-VAE | 「图像 tokenizer」 | CNN + ViT + codebook，把图像映射到 transformer 能预测的整数索引 |
| Shared vocabulary（共享词表） | 「一本字典」 | 一个统一的 token ID 空间，覆盖文本 + 图像 + 模态分隔符 |
| QK-Norm | 「attention 稳定器」 | 在 query 和 key 点积之前对它们做 LayerNorm，防止范数爆炸 |
| Mixed-modality generation（混合模态生成） | 「文本 + 图像输出」 | 模型在一次 inference 中自主产出交错的文本与图像 token |
| Codebook size（codebook 大小） | 「K 个条目」 | VQ-VAE 能量化到的离散向量数；在压缩与保真之间取舍 |
| Tokenizer ceiling（tokenizer 上限） | 「重建上限」 | 解码 VQ token 能达到的最佳 PSNR；约束模型的图像质量 |

## 延伸阅读（Further Reading）

- [Chameleon Team — Chameleon: Mixed-Modal Early-Fusion Foundation Models (arXiv:2405.09818)](https://arxiv.org/abs/2405.09818)
- [Aghajanyan et al. — CM3 (arXiv:2201.07520)](https://arxiv.org/abs/2201.07520)
- [Yu et al. — CM3Leon (arXiv:2309.02591)](https://arxiv.org/abs/2309.02591)
- [Zhan et al. — AnyGPT (arXiv:2402.12226)](https://arxiv.org/abs/2402.12226)
- [Adept — Fuyu-8B blog (adept.ai)](https://www.adept.ai/blog/fuyu-8b)
