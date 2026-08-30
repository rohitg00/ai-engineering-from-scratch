# Emu3：用于图像和视频生成的 Next-Token 预测

> BAAI 的 Emu3（Wang 等人，2024 年 9 月）是 2024 年应该终结扩散 vs 自回归辩论的结果。一个单一的 Llama 风格仅解码器 transformer，仅在 next-token-prediction 目标上训练，跨越文本 + VQ 图像 token + 3D VQ 视频 token 的统一词汇，在图像生成上击败 SDXL，在感知上击败 LLaVA-1.6。没有 CLIP 损失。没有扩散调度。推理时使用无分类器引导来提升质量，但核心训练目标是带教师强制的 next-token 预测。发表在 Nature 上。本课解读 Emu3 的论点——为什么更好的分词器加规模就是你所需要的一切——并与扩散方法进行对比。

**类型：** Learn
**语言：** Python（stdlib，3D 视频分词器数学 + 自回归采样器骨架）
**前置知识：** Phase 12 · 11（Chameleon）
**时间：** ~120 分钟

## 学习目标

- 解释为什么 Emu3 的单一损失 next-token 目标有效，尽管长期假设图像质量需要扩散。
- 描述 3D 视频分词器：时空 VQ 码本的样子，为什么 patch 跨越时间。
- 在（训练计算、推理成本、质量上限）上比较 Emu3 与 Stable Diffusion XL。
- 命名同一 Emu3 模型扮演的三个角色：Emu3-Gen（图像生成）、Emu3-Chat（感知）、Emu3-Stage2（视频生成）。

## 问题所在

到 2024 年的传统智慧：图像生成需要扩散。论点：离散图像 token 丢失太多信息来重建细节，自回归采样在数千 token 上累积误差。Stable Diffusion、DALL-E 3、Imagen、Midjourney 都使用某种形式的扩散。Chameleon（第 12.11 课）在小规模上部分反驳了这一点，但在质量上没有匹配 SDXL。

Emu3 正面攻击了这一论点。声明：更好的视觉分词器 + 足够的规模 + next-token 损失 = 在同一模型中击败扩散的图像生成，该模型还做感知。

发表时这一赌注有争议。两年后，开源统一生成家族（Emu3、Show-o、Janus-Pro、Transfusion）是研究的默认路径；生产前沿模型似乎使用某种变体。

## 核心概念

### Emu3 分词器

关键成分是视觉分词器。Emu3 训练自定义 IBQ 类分词器（逆瓶颈量化器，SBER-MoVQGAN 家族），每个 token 8x8 分辨率缩减。512x512 图像变成 64x64 = 4096 个 token，码本大小 32768。

这比 Chameleon 的 512x512 图像 1024 个 token（K=8192）更大，但每个 token 更便宜（更小的码本查找，更简单的编解码器）。关键指标：重建 PSNR 为 30.5 dB，与 Stable Diffusion 的连续潜在空间 32 dB 竞争。

对于视频：3D VQ 分词器将时空 patch（4x4x4 像素）编码为一个整数。4 秒片段在 8 FPS 下有 32 帧；在 256x256 分辨率下，4x 空间和 4x 时间缩减，token 数量为 (256/4) * (256/4) * (32/4) = 64 * 64 * 8 = 32,768 个 token。

分词器质量是上限。Emu3 的贡献部分在于"我们训练了一个非常好的分词器"。

### 单一损失训练

Emu3 使用一个目标：在共享词汇上跨文本 token、2D 图像 token 和 3D 视频 token 的 next-token 预测。训练期间权重乘以模态特定因子以平衡贡献，但损失函数相同。

在以下混合上训练：
- 图像生成：`<text caption> <image> image_tokens </image>`
- 图像感知：`<image> image_tokens </image> <question> text_tokens`
- 视频生成：`<text caption> <video> video_tokens </video>`
- 视频感知：类似。
- 纯文本：标准 NTP。

模型从数据分布中学习何时发出图像 token vs 文本 token。生成从模型在 `<image>` 标签后预测图像 token 中涌现。

### 无分类器引导和温度

自回归图像生成在推理时使用无分类器引导（CFG）会好得多。Emu3 使用它：生成两次，一次用完整描述，一次用空描述，用引导权重混合 logits（典型 3.0-7.0）。这是扩散使用的相同 CFG 技巧，借用到自回归设置。

温度很重要：太高，产生伪影；太低，模式崩溃。Emu3 的推荐温度是感知 1.0，图像生成 0.8。

### 三个角色，一个模型

Emu3 作为三个功能不同的 API 发布，但底层权重集相同：

- Emu3-Gen。图像生成。输入文本，输出图像 token。
- Emu3-Chat。VQA 和描述。输入图像（token），输出文本。
- Emu3-Stage2。视频生成和视频 VQA。输入文本或视频，输出文本或视频。

没有任务特定头。只是不同的提示词模板。相同的检查点。

### 基准

来自 Emu3 论文（2024 年 9 月）：

- 图像生成：在 MJHQ-30K FID 上击败 SDXL（5.4 vs 5.6），GenEval 总体（0.54 vs 0.55——统计平局），以及 Deep-Eval 的综合评分持平。
- 图像感知：在 VQAv2 上击败 LLaVA-1.6（75.1 vs 72.4），在 MMMU 上大致匹配。
- 视频生成：4 秒片段质量与 Sora 时代公开基准模型的 FVD 竞争。

数字并非总是获胜——Emu3 在这里交易一分，在那里获得一分——但"next-token 预测就是你所需要的一切"的声明在跨模态上是可辩护的。

### 计算成本

Emu3 在约 3000 亿多模态 token 上训练 7B 参数模型。GPU 小时大致与 Llama-2-7B 预训练相当（A100 级硅上 2000-4000 GPU 年）。像 Stable Diffusion 3 这样的扩散模型在类似预算下训练，但需要单独的文本编码器和更复杂的流水线。

推理时，Emu3 比 SDXL 每张图像慢：4096 图像 token 在 30 tok/s 下约 2 分钟每张 512x512 图像，vs SDXL 的 2-5 秒。推测解码和 KV 缓存优化缩小差距但无法闭合。自回归图像生成计算密集；这是持续的权衡。

### 为什么重要

Emu3 的深层贡献是概念性的。如果 next-token 预测扩展到匹配扩散的图像生成，统一模型路径（一个损失，一个骨干，任何模态）是可行的。未来模型不需要单独的文本编码器、单独的扩散调度器、单独的 VAE。一个 transformer，每个模态一个分词器，规模。

Show-o、Janus-Pro 和 InternVL-U 都建立或挑战这一论点。中国实验室（BAAI、DeepSeek）在 2025 年之前比美国实验室更积极地朝这个方向发表。

## 使用它

`code/main.py` 构建两个玩具部分：

- 2D vs 3D VQ 分词器计数计算器：给定（分辨率、patch、片段长度、FPS），计算图像 vs 视频的 token 数量。
- 带无分类器引导的自回归图像 token 采样器，在温度下。

CFG 实现匹配 Emu3 的配方——用引导权重混合条件和非条件 logits。

## 交付它

本课产出 `outputs/skill-token-gen-cost-analyzer.md`。给定生成产品规格（图像或视频，目标分辨率，质量层级，延迟预算），它计算 token 数量、推理成本，并在 Emu3 家族与扩散之间选择。

## 练习

1. Emu3 在 8x8 缩减下每张 512x512 图像产生 4096 个 token。计算 1024x1024 和 2048x2048 的等效值。推理延迟会发生什么？

2. 阅读 Emu3 第 3.3 节关于视频分词器。描述 3D VQ patch 形状以及为什么它是 4x4x4 而非 8x8x1。

3. 无分类器引导权重 5.0 vs 3.0：什么视觉效果？在 `code/main.py` 中追踪数学。

4. 计算 Emu3-7B 在 300B token 上的训练 FLOPs，并与 Stable Diffusion 3 比较。哪个训练更昂贵？

5. Emu3 在 FID 上击败 SDXL，但在 VQAv2 上未击败专业 VLM。解释为什么统一损失方法在不同基准上 vs 专家模型显示不同优势。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Next-token 预测 | "NTP" | 标准自回归损失：给定 token[0..i] 预测 token[i+1]；分词后对每种模态都有效 |
| IBQ 分词器 | "逆瓶颈量化器" | 一类 VQ-VAE，码本更大（32768+），重建比 Chameleon 的更好 |
| 3D VQ | "时空量化器" | 由（时间、行、列）索引的码本；一个 token 覆盖 4x4x4 像素立方体 |
| 无分类器引导 | "CFG" | 用权重 gamma 混合条件和非条件 logits；提升推理时的图像质量 |
| 统一词汇 | "共享 token" | 文本 + 图像 + 视频都取自相同的整数空间；模型预测接下来哪种模态 |
| MJHQ-30K | "图像生成基准" | 3 万提示词的 Midjourney 质量基准；Emu3 在此报告 FID |

## 延伸阅读

- [Wang et al. — Emu3: Next-Token Prediction is All You Need (arXiv:2409.18869)](https://arxiv.org/abs/2409.18869)
- [Sun et al. — Emu: Generative Pretraining in Multimodality (arXiv:2307.05222)](https://arxiv.org/abs/2307.05222)
- [Liu et al. — LWM (arXiv:2402.08268)](https://arxiv.org/abs/2402.08268)
- [Yu et al. — MAGVIT-v2 (arXiv:2310.05737)](https://arxiv.org/abs/2310.05737)
- [Tian et al. — VAR (arXiv:2404.02905)](https://arxiv.org/abs/2404.02905)
