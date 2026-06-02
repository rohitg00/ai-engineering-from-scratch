# Emu3：用 Next-Token Prediction 做图像与视频生成

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> BAAI 的 Emu3（Wang et al., 2024 年 9 月）是 2024 年那个本应终结 diffusion vs autoregressive 之争的成果。一个 Llama 风格的纯 decoder transformer，只用 next-token prediction 这一个目标函数训练，词表统一为「文本 + VQ 图像 token + 3D VQ 视频 token」，在图像生成上击败 SDXL，在视觉感知上击败 LLaVA-1.6。没有 CLIP loss，没有 diffusion schedule。推理时为了画质会用 classifier-free guidance，但核心训练目标就是带 teacher forcing 的 next-token prediction。论文发在 Nature 上。本课会读 Emu3 的核心论点——更好的 tokenizer 加规模就够了——并与 diffusion 路线对比。

**Type:** Learn
**Languages:** Python (stdlib, 3D 视频 tokenizer 数学 + autoregressive 采样器骨架)
**Prerequisites:** Phase 12 · 11 (Chameleon)
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 解释为什么 Emu3 的单一 next-token loss 能跑通——尽管长期以来大家都假设图像质量必须靠 diffusion 才能拿到。
- 描述 3D 视频 tokenizer：时空 VQ codebook 长什么样，为什么 patch 要跨时间维。
- 在（训练算力、推理成本、质量上限）三个维度上对比 Emu3 与 Stable Diffusion XL。
- 说出同一个 Emu3 模型扮演的三种角色：Emu3-Gen（图像生成）、Emu3-Chat（感知）、Emu3-Stage2（视频生成）。

## 问题（The Problem）

到 2024 年为止的主流共识是：图像生成必须靠 diffusion。理由是：离散图像 token 损失的信息太多，没法重建出细节；而 autoregressive 采样会在几千个 token 之间把误差累积起来。Stable Diffusion、DALL-E 3、Imagen、Midjourney 都用某种形式的 diffusion。Chameleon（第 12.11 课）在小规模上部分推翻了这个说法，但画质没追上 SDXL。

Emu3 直接迎战这个论点。它的主张是：更好的视觉 tokenizer + 足够规模 + next-token loss = 在同一个模型里做出能打 diffusion 的图像生成，而且这个模型还顺带能做感知。

这个押注在发表当时是有争议的。两年过去，开源的统一生成模型家族（Emu3、Show-o、Janus-Pro、Transfusion）已经成为研究界的默认路径；前沿的生产模型看起来也用了某种变体。

## 概念（The Concept）

### Emu3 的 tokenizer

最关键的一块是视觉 tokenizer。Emu3 自己训了一个 IBQ 类（Inverse Bottleneck Quantizer，SBER-MoVQGAN 家族）的 tokenizer，每个 token 对应 8x8 的分辨率压缩比。一张 512x512 图变成 64x64 = 4096 个 token，codebook size 是 32768。

这比 Chameleon 在 K=8192 下每张 512x512 用 1024 个 token 要多，但单 token 更便宜（codebook 查表更小、codec 更简单）。关键指标是重建 PSNR 30.5 dB，跟 Stable Diffusion 那种连续 latent 空间的 32 dB 已经能打。

视频部分：用一个 3D VQ tokenizer 把一个时空 patch（4x4x4 像素）编成一个整数。一个 8 FPS 下 4 秒的片段是 32 帧；在 256x256 分辨率下，空间 4 倍下采、时间 4 倍下采，token 数 = (256/4) * (256/4) * (32/4) = 64 * 64 * 8 = 32,768 个 token。

Tokenizer 的质量决定了天花板。Emu3 的贡献里有一部分就是「我们训了一个非常好的 tokenizer」。

### 单一 loss 训练

Emu3 只有一个目标函数：在统一词表上做 next-token prediction，词表里同时包含文本 token、2D 图像 token 和 3D 视频 token。训练时不同模态的损失会乘以一个特定的权重系数来平衡贡献，但 loss 函数本身完全一样。

训练数据混合了：
- 图像生成：`<text caption> <image> image_tokens </image>`
- 图像感知：`<image> image_tokens </image> <question> text_tokens`
- 视频生成：`<text caption> <video> video_tokens </video>`
- 视频感知：类比上面。
- 纯文本：标准 NTP。

模型从数据分布里学会什么时候该输出图像 token、什么时候该输出文本 token。生成是一种涌现行为——模型在 `<image>` 标签后开始预测图像 token。

### Classifier-free guidance 和 temperature

Autoregressive 图像生成在推理时配上 classifier-free guidance（CFG）效果会好很多。Emu3 也用：生成两次，一次带完整 caption，一次带空 caption，再用一个 guidance weight（典型 3.0-7.0）把两组 logits 混起来。这就是 diffusion 用的那个 CFG 套路，被借到了 autoregressive 场景。

Temperature 也很关键：太高会出 artifact，太低会 mode collapse。Emu3 推荐感知任务用 1.0，图像生成用 0.8。

### 三种角色，一份权重

Emu3 对外是三个功能上完全不同的 API，但底下是同一份权重：

- Emu3-Gen。图像生成。输入文本，输出图像 token。
- Emu3-Chat。VQA 与 captioning。输入图像（token），输出文本。
- Emu3-Stage2。视频生成与视频 VQA。输入文本或视频，输出文本或视频。

没有任务相关的 head。只是 prompt 模板不同。同一个 checkpoint。

### 基准（Benchmarks）

Emu3 论文（2024 年 9 月）的数字：

- 图像生成：在 MJHQ-30K FID 上击败 SDXL（5.4 vs 5.6），GenEval overall 持平（0.54 vs 0.55——统计上打平），Deep-Eval 综合分大致同档。
- 图像感知：在 VQAv2 上击败 LLaVA-1.6（75.1 vs 72.4），MMMU 上大致持平。
- 视频生成：4 秒片段质量在 FVD 上能跟 Sora 时代公开 benchmark 的模型对打。

数字并不总是赢——Emu3 这里让一分、那里赢一分——但「next-token prediction is all you need」这个论断在多模态上是站得住脚的。

### 算力成本

Emu3 用 7B 参数模型在大约 3000 亿多模态 token 上训练。GPU 小时数大致跟 Llama-2-7B 的 pretraining 一个量级（A100 级别硅片上 2000-4000 GPU-年）。像 Stable Diffusion 3 这样的 diffusion 模型预算差不多，但需要单独的文本 encoder 和更复杂的流水线。

推理上 Emu3 比 SDXL 慢得多：4096 个图像 token 按 30 tok/s 算，一张 512x512 大概要 2 分钟，而 SDXL 只要 2-5 秒。Speculative decoding 和 KV cache 优化能缩小差距，但消不掉。Autoregressive 图像生成本来就是算力密集型；这是当前要承受的取舍。

### 为什么这件事重要

Emu3 真正的贡献是概念层面的。如果 next-token prediction 在图像生成上能 scale 到追平 diffusion，那么统一模型路线（一个 loss、一个 backbone、任意模态）就是可行的。未来的模型不需要单独的文本 encoder、单独的 diffusion scheduler、单独的 VAE。一个 transformer、每个模态一个 tokenizer，往大里 scale。

Show-o、Janus-Pro 和 InternVL-U 要么沿着这条思路走，要么挑战它。中国的 lab（BAAI、DeepSeek）在 2025 年之前在这个方向上比美国 lab 发得更猛。

## 用起来（Use It）

`code/main.py` 搭了两个玩具件：

- 一个 2D vs 3D VQ tokenizer 计数器：给定（分辨率、patch 尺寸、clip 长度、FPS），计算图像与视频的 token 数。
- 一个带 classifier-free guidance 和 temperature 的 autoregressive 图像 token 采样器。

CFG 的实现跟 Emu3 的配方一致——把 conditional 和 unconditional logits 用一个 guidance weight 混起来。

## 上线部署（Ship It）

本课产出 `outputs/skill-token-gen-cost-analyzer.md`。给定一份生成类产品的 spec（图像或视频、目标分辨率、质量档位、延迟预算），它会算出 token 数、推理成本，并在 Emu3 家族 vs diffusion 之间做选型。

## 练习（Exercises）

1. Emu3 在 8x8 压缩比下，对 512x512 图像产出 4096 个 token。算一下 1024x1024 和 2048x2048 各对应多少 token。推理延迟会怎样？

2. 读 Emu3 论文 3.3 节的视频 tokenizer 部分。描述 3D VQ 的 patch 形状，并解释为什么是 4x4x4 而不是 8x8x1。

3. Classifier-free guidance weight 5.0 vs 3.0：视觉上有什么差异？跟着 `code/main.py` 把数学过一遍。

4. 算一下 Emu3-7B 在 300B token 上的训练 FLOPs，并与 Stable Diffusion 3 对比。哪个训练更贵？

5. Emu3 在 FID 上赢 SDXL，但在 VQAv2 上输给专门的 VLM。解释为什么统一 loss 路线在不同 benchmark 上展现出来的强项跟专家模型不一样。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|------|-----------------|------------------------|
| Next-token prediction | "NTP" | 标准 autoregressive 损失：给定 token[0..i] 预测 token[i+1]；任何模态只要 tokenize 了都适用 |
| IBQ tokenizer | "Inverse bottleneck quantizer" | 一类 VQ-VAE，codebook 更大（32768+），重建质量比 Chameleon 那一套更好 |
| 3D VQ | "时空 quantizer" | codebook 由（时间、行、列）索引；一个 token 覆盖一个 4x4x4 像素立方 |
| Classifier-free guidance | "CFG" | 用一个权重 gamma 把 conditional 与 unconditional logits 混合；推理时提升画质 |
| Unified vocabulary | "共享 token" | 文本 + 图像 + 视频共用一个整数空间；模型预测下一个 token 时不区分模态 |
| MJHQ-30K | "图像生成 benchmark" | Midjourney 质量级别的 benchmark，含 3 万个 prompt；Emu3 在上面报 FID |

## 延伸阅读（Further Reading）

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
