# 12 · Emu3：用下一个 Token 预测实现图像与视频生成

> 智源研究院（BAAI）的 Emu3（Wang 等人，2024 年 9 月）是 2024 年的一项成果，本应就此终结「扩散模型对自回归模型」之争。一个 Llama 风格的纯解码器（decoder-only）Transformer，仅用下一个 token 预测（next-token-prediction）目标训练，在文本 + VQ 图像 token + 3D VQ 视频 token 的统一词表上，图像生成超过 SDXL，感知任务超过 LLaVA-1.6。没有 CLIP 损失，没有扩散调度（diffusion schedule）。推理阶段为提升质量使用了无分类器引导（classifier-free guidance），但核心训练目标就是配合教师强制（teacher forcing）的下一个 token 预测。该成果发表于 Nature。本课研读 Emu3 的核心论点——为什么「更好的 tokenizer 加上规模」就是你所需的全部——并与扩散方法作对比。

**类型：** 学习
**语言：** Python（标准库，3D 视频 tokenizer 数学 + 自回归采样器骨架）
**前置：** 第 12 阶段 · 11（Chameleon）
**时长：** 约 120 分钟

## 学习目标

- 解释为什么 Emu3 的单一损失下一个 token 目标能够奏效，尽管长期以来人们认为图像质量必须依赖扩散。
- 描述 3D 视频 tokenizer：时空 VQ 码本（spatiotemporal VQ codebook）长什么样，为什么 patch 要横跨时间维度。
- 在（训练算力、推理成本、质量上限）三个维度上对比 Emu3 与 Stable Diffusion XL。
- 说出同一个 Emu3 模型扮演的三种角色：Emu3-Gen（图像生成）、Emu3-Chat（感知）、Emu3-Stage2（视频生成）。

## 问题所在

直到 2024 年的传统观点是：图像生成需要扩散。其论据为：离散图像 token 会丢失太多信息，无法重建细节；而自回归采样会在数千个 token 上累积误差。Stable Diffusion、DALL-E 3、Imagen、Midjourney 全都采用某种形式的扩散。Chameleon（第 12.11 课）在小规模上部分推翻了这一观点，但在质量上并未追平 SDXL。

Emu3 正面迎击了这一论据。其主张是：更好的视觉 tokenizer + 足够的规模 + 下一个 token 损失 = 在同一个既能做生成又能做感知的模型里实现超越扩散的图像生成。

这个赌注在发表时颇具争议。两年过去，开源统一生成模型家族（Emu3、Show-o、Janus-Pro、Transfusion）已成为研究的默认路径；生产级前沿模型似乎也采用了某种变体。

## 核心概念

### Emu3 的 tokenizer

关键要素是视觉 tokenizer。Emu3 训练了一个定制的 IBQ 类 tokenizer（Inverse Bottleneck Quantizer，逆瓶颈量化器，属于 SBER-MoVQGAN 家族），每个 token 实现 8x8 的分辨率压缩。一张 512x512 图像变为 64x64 = 4096 个 token，码本大小为 32768。

这比 Chameleon 在 K=8192 下每张 512x512 图像 1024 个 token 要多，但每个 token 更便宜（码本查表更小，编解码更简单）。关键指标是：重建 PSNR 达到 30.5 dB，与 Stable Diffusion 连续潜空间的 32 dB 相当具有竞争力。

对于视频：一个 3D VQ tokenizer 将一个时空 patch（4x4x4 像素）编码为一个整数。一段 8 FPS 的 4 秒片段有 32 帧；在 256x256 分辨率下进行 4 倍空间压缩与 4 倍时间压缩，token 数为 (256/4) * (256/4) * (32/4) = 64 * 64 * 8 = 32,768 个 token。

Tokenizer 的质量就是上限。Emu3 的贡献部分在于「我们训练了一个非常好的 tokenizer」。

### 单一损失训练

Emu3 使用单一目标：在文本 token、2D 图像 token 和 3D 视频 token 的共享词表上做下一个 token 预测。训练时各模态的损失会乘以特定的权重因子以平衡其贡献，但损失函数本身完全相同。

在如下混合数据上训练：
- 图像生成：`<text caption> <image> image_tokens </image>`
- 图像感知：`<image> image_tokens </image> <question> text_tokens`
- 视频生成：`<text caption> <video> video_tokens </video>`
- 视频感知：与上类似。
- 纯文本：标准 NTP。

模型从数据分布中学会何时输出图像 token、何时输出文本 token。生成能力来源于模型在 `<image>` 标签之后预测图像 token。

### 无分类器引导与温度

自回归图像生成在推理时配合无分类器引导（CFG）会大幅改善。Emu3 采用了它：生成两次，一次使用完整 caption，一次使用空 caption，再用一个引导权重（典型值 3.0-7.0）混合两者的 logits。这正是扩散所用的同一套 CFG 技巧，被借用到自回归场景中。

温度很关键：过高会产生伪影，过低会导致模式坍缩（mode collapse）。Emu3 推荐的温度是感知任务 1.0，图像生成 0.8。

### 三种角色，一个模型

Emu3 以三个功能上各不相同的 API 形式发布，但底层是同一套权重：

- Emu3-Gen。图像生成。输入文本，输出图像 token。
- Emu3-Chat。视觉问答（VQA）与图像描述。输入图像（token），输出文本。
- Emu3-Stage2。视频生成与视频 VQA。输入文本或视频，输出文本或视频。

没有任务专用的输出头。仅靠不同的提示模板。同一个检查点（checkpoint）。

### 基准测试

来自 Emu3 论文（2024 年 9 月）：

- 图像生成：在 MJHQ-30K FID 上超过 SDXL（5.4 对 5.6），GenEval 总分（0.54 对 0.55——统计上打平），Deep-Eval 综合分持平。
- 图像感知：在 VQAv2 上超过 LLaVA-1.6（75.1 对 72.4），在 MMMU 上大致持平。
- 视频生成：4 秒片段质量在 FVD 上与 Sora 时代公开评测的模型具有竞争力。

这些数字并非总是领先——Emu3 在此处让一分、在彼处赢一分——但「下一个 token 预测就是你所需的全部」这一主张在各模态上都站得住脚。

### 算力成本

Emu3 使用一个 70 亿参数模型，在约 3000 亿个多模态 token 上训练。GPU 小时数大致与 Llama-2-7B 预训练相当（A100 级硅片上约 2k-4k GPU 年）。像 Stable Diffusion 3 这样的扩散模型在相近的预算内训练，但需要独立的文本编码器和更复杂的流水线。

在推理时，Emu3 每张图像比 SDXL 慢：4096 个图像 token 以 30 tok/s 计算，约需 2 分钟生成一张 512x512 图像，而 SDXL 仅需 2-5 秒。投机解码（speculative decoding）和 KV-cache 优化能缩小这一差距，但无法消除它。自回归图像生成是算力密集型的；这是长期存在的权衡。

### 为什么重要

Emu3 的深层贡献是概念性的。如果下一个 token 预测能随规模扩展到在图像生成上追平扩散，那么统一模型路线（一个损失、一个骨干网络、任意模态）就是可行的。未来的模型不需要独立的文本编码器、独立的扩散调度器、独立的 VAE。一个 Transformer，每种模态一个 tokenizer，加上规模。

Show-o、Janus-Pro 和 InternVL-U 都在此论点之上构建或对其发起挑战。在整个 2025 年，中国实验室（BAAI、DeepSeek）在这个方向上的发表比美国实验室更为激进。

## 动手实践

`code/main.py` 构建了两个玩具组件：

- 一个 2D 与 3D VQ tokenizer 计数计算器：给定（分辨率、patch、片段长度、FPS），计算图像与视频各自的 token 数。
- 一个带无分类器引导、可设温度的自回归图像 token 采样器。

CFG 的实现与 Emu3 的配方一致——用一个引导权重混合条件 logits 与无条件 logits。

## 交付实战

本课产出 `outputs/skill-token-gen-cost-analyzer.md`。给定一份生成产品规格（图像或视频、目标分辨率、质量档位、延迟预算），它会计算 token 数、推理成本，并在 Emu3 家族与扩散方案之间作出选择。

## 练习

1. Emu3 在 8x8 压缩下每张 512x512 图像产生 4096 个 token。计算 1024x1024 和 2048x2048 的等效 token 数。推理延迟会发生什么变化？

2. 阅读 Emu3 论文第 3.3 节关于视频 tokenizer 的内容。描述 3D VQ patch 的形状，以及为什么它是 4x4x4 而不是 8x8x1。

3. 无分类器引导权重 5.0 与 3.0：视觉效果有何不同？追踪 `code/main.py` 中的数学过程。

4. 计算 Emu3-7B 在 3000 亿 token 下的训练 FLOPs，并与 Stable Diffusion 3 对比。哪一个训练成本更高？

5. Emu3 在 FID 上超过 SDXL，但在 VQAv2 上不及专用的 VLM。解释为什么统一损失方法在不同基准上相对于专家模型展现出不同的强项。

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|------|-----------------|------------------------|
| 下一个 token 预测 | "NTP" | 标准自回归损失：在给定 token[0..i] 的条件下预测 token[i+1]；一旦完成 tokenize，对每种模态都适用 |
| IBQ tokenizer | "逆瓶颈量化器" | 一类 VQ-VAE，码本更大（32768+），重建质量优于 Chameleon |
| 3D VQ | "时空量化器" | 以（时间、行、列）索引的码本；一个 token 覆盖一个 4x4x4 的像素立方体 |
| 无分类器引导 | "CFG" | 用权重 gamma 混合条件与无条件 logits；在推理时提升图像质量 |
| 统一词表 | "共享 token" | 文本 + 图像 + 视频全部取自同一个整数空间；模型预测接下来出现的是哪种模态 |
| MJHQ-30K | "图像生成基准" | Midjourney 质量基准，含 3 万条 prompt；Emu3 在此报告 FID |

## 延伸阅读

- [Wang 等人 — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun 等人 — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu 等人 — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu 等人 — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian 等人 — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
