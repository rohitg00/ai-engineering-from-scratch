# Emu3：用下一词预测实现图像与视频生成

> BAAI 的 Emu3(Wang et al.,2024 年 9 月)是本应终结扩散模型与自回归模型之争的 2024 年成果。它是一个单一的 Llama 风格 decoder-only Transformer,仅在下一词预测目标上训练，在文本 + VQ 图像 token + 3D VQ 视频 token 的统一词表上进行，在图像生成上击败了 SDXL,在感知上击败了 LLaVA-1.6。没有 CLIP 损失，没有扩散调度。推理时使用 classifier-free guidance 提升质量，但核心训练目标是带 teacher forcing 的下一词预测。发表于 Nature。本课解读 Emu3 的核心论点——更好的分词器加规模就是你所需要的一切——并与扩散方法进行对比。

**Type:** Learn
**Languages:** Python(stdlib,3D 视频分词器数学 + 自回归采样器骨架)
**Prerequisites:** Phase 12 · 11(Chameleon)
**Time:** ~120 分钟

## 学习目标

- 解释为什么尽管长期假设图像质量必须依赖扩散模型，Emu3 的单损失下一词目标仍然有效。
- 描述 3D 视频分词器：时空 VQ 码本是什么样的，为什么 patch 要跨越时间维度。
- 比较 Emu3 与 Stable Diffusion XL(训练算力、推理成本、质量上限)。
- 说出同一个 Emu3 模型扮演的三种角色：Emu3-Gen(图像生成)、Emu3-Chat(感知)、Emu3-Stage2(视频生成)。

## 问题所在

截至 2024 年的传统观念是：图像生成需要扩散模型。论据是：离散图像 token 会丢失太多信息以致无法重建细节，且自回归采样会在数千个 token 上累积误差。Stable Diffusion、DALL-E 3、Imagen、Midjourney 都使用某种形式的扩散。Chameleon(第 12.11 课)在小规模上部分否定了这一观点，但在质量上未能匹敌 SDXL。

Emu3 正面攻击了这一论点。其主张是：更好的视觉分词器 + 足够的规模 + 下一词损失 = 在同一个模型中击败扩散的图像生成，同时还能做感知。

这一赌注在发表时颇具争议。两年后，开源的统一生成家族(Emu3、Show-o、Janus-Pro、Transfusion)已成为研究界的默认路径；生产级前沿模型似乎也在使用其某种变体。

## 核心概念

### Emu3 分词器

关键要素是视觉分词器。Emu3 训练了一个自定义的 IBQ 类分词器(Inverse Bottleneck Quantizer,属 SBER-MoVQGAN 家族)，每个 token 降低 8x8 分辨率。一张 512x512 图像变成 64x64 = 4096 个 token,码本大小为 32768。

这比 Chameleon 在 K=8192 下对 512x512 图像的 1024 个 token 更大，但每个 token 的成本更低(码本查找更小，编解码器更简单)。关键指标：重建 PSNR 达 30.5 dB,与 Stable Diffusion 在 32 dB 的连续潜空间相当。

对于视频：3D VQ 分词器将一个时空 patch(4x4x4 像素)编码为一个整数。一段 8 FPS 的 4 秒剪辑有 32 帧；在 256x256 分辨率下，空间上缩小 4 倍、时间上缩小 4 倍，token 数量为 (256/4) * (256/4) * (32/4) = 64 * 64 * 8 = 32,768 个 token。

分词器质量就是上限。Emu3 的贡献部分在于“我们训练了一个非常好的分词器”。

### 单损失训练

Emu3 只用一个目标：在跨越文本 token、2D 图像 token 和 3D 视频 token 的共享词表上进行下一词预测。训练时权重会乘以模态特定的系数以平衡各模态的贡献，但损失函数完全相同。

训练数据混合包括：
- 图像生成： `<text caption> <image> image_tokens </image>`
- 图像感知： `<image> image_tokens </image> <question> text_tokens`
- 视频生成： `<text caption> <video> video_tokens </video>`
- 视频感知： 类似。
- 纯文本： 标准的 NTP。

模型从数据分布中学习何时输出图像 token 而非文本 token。生成能力源于模型在 `<image>` 标签之后预测图像 token。

### Classifier-free guidance 与温度

自回归图像生成在推理时使用 classifier-free guidance(CFG)会显著提升质量。Emu3 就是这样做的：生成两次，一次用完整描述，一次用空描述，以引导权重(典型为 3.0-7.0)混合 logits。这与扩散模型使用的 CFG 技巧相同，只是被借鉴到了自回归场景。

温度很重要：太高会有伪影；太低会模式坍缩。Emu3 推荐的温度是感知用 1.0,图像生成用 0.8。

### 一个模型，三种角色

Emu3 以三个功能不同的 API 形式发布，但底层是同一套权重：

- Emu3-Gen。图像生成。输入文本，输出图像 token。
- Emu3-Chat。VQA 与图像描述。输入图像(token),输出文本。
- Emu3-Stage2。视频生成与视频 VQA。输入文本或视频，输出文本或视频。

没有任务特定的头。只有不同的提示模板。同一个 checkpoint。

### 基准测试

来自 Emu3 论文(2024 年 9 月)：

- 图像生成：在 MJHQ-30K FID 上击败 SDXL(5.4 vs 5.6),在 GenEval 总分上(0.54 vs 0.55——统计上打平)，在 Deep-Eval 的综合评分上大致持平。
- 图像感知：在 VQAv2 上击败 LLaVA-1.6(75.1 vs 72.4),在 MMMU 上大致持平。
- 视频生成：4 秒剪辑的质量在 FVD 上与 Sora 时代公开评测的模型具有竞争力。

这些数字并非处处领先——Emu3 在这里赢一点，在那里输一点——但“下一词预测就是你所需要的一切”这一主张在各模态上是站得住脚的。

### 算力成本

Emu3 使用 7B 参数模型在约 3000 亿多模态 token 上训练。GPU 时数大致相当于 Llama-2-7B 预训练(A100 级硬件上 2k-4k GPU 年)。Stable Diffusion 3 等扩散模型在类似预算下训练，但需要单独的文本编码器和更复杂的流水线。

推理时，Emu3 每张图像比 SDXL 慢：4096 个图像 token 以 30 tok/s 计算约为每张 512x512 图像 2 分钟，而 SDXL 只需 2-5 秒。投机解码和 KV-cache 优化能缩小差距但无法消除。自回归图像生成是算力密集型的；这是一个长期的权衡。

### 为什么重要

Emu3 的深层贡献是概念性的。如果下一词预测能扩展到在图像生成上匹敌扩散模型，那么统一模型路径(一个损失、一个骨干、任意模态)就是可行的。未来的模型不需要单独的文本编码器、单独的扩散调度器、单独的 VAE。一个 Transformer,每种模态一个分词器，再加上规模。

Show-o、Janus-Pro 和 InternVL-U 都基于或挑战这一论点。到 2025 年，中国的实验室(BAAI、DeepSeek)在这个方向上的发表比美国实验室更为积极。

```figure
l5-emu3-next-token
```

## 动手使用

`code/main.py` 构建了两个玩具组件：

- 一个 2D 与 3D VQ 分词器 token 数计算器：给定(分辨率、patch、clip_length、FPS),计算图像与视频的 token 数。
- 一个带 classifier-free guidance 的温度控制自回归图像 token 采样器。

CFG 实现遵循 Emu3 的配方——以引导权重混合条件与无条件 logits。

## 交付

本课产出 `outputs/skill-token-gen-cost-analyzer.md`。给定一份生成产品规格(图像或视频、目标分辨率、质量层级、延迟预算)，它会计算 token 数量、推理成本，并在 Emu3 家族与扩散模型之间做出选择。

## 练习

1. Emu3 在 8x8 缩减下为每张 512x512 图像生成 4096 个 token。计算 1024x1024 和 2048x2048 下的等效值。推理延迟会发生什么变化？

2. 阅读 Emu3 第 3.3 节关于视频分词器的内容。描述 3D VQ patch 的形状，以及为什么是 4x4x4 而不是 8x8x1。

3. Classifier-free guidance 权重 5.0 与 3.0 相比有什么视觉效果？在 `code/main.py` 中追踪相关数学。

4. 计算 Emu3-7B 在 3000 亿 token 下的训练 FLOPs,并与 Stable Diffusion 3 比较。哪个训练成本更高？

5. Emu3 在 FID 上击败 SDXL,但在 VQAv2 上却比不过专用 VLM。解释为什么统一损失方法在不同基准上与专用模型相比展现出不同的优势。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 下一词预测 | "NTP" | 标准自回归损失：给定 token[0..i] 预测 token[i+1];只要完成分词，适用于所有模态 |
| IBQ 分词器 | "Inverse bottleneck quantizer" | 一类 VQ-VAE,码本更大(32768+),重建质量优于 Chameleon 的 |
| 3D VQ | "时空量化器" | 码本按(时间，行，列)索引；一个 token 覆盖 4x4x4 像素立方体 |
| Classifier-free guidance | "CFG" | 以权重 gamma 混合条件与无条件 logits;推理时提升图像质量 |
| 统一词表 | "共享 token" | 文本 + 图像 + 视频都来自同一整数空间；模型预测接下来出现的任意模态 |
| MJHQ-30K | "图像生成基准" | 使用 30k 提示词的 Midjourney 质量基准；Emu3 在此报告 FID |

## 延伸阅读

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)