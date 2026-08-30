---
name: tokenizer-vs-adapter-picker
description: 为 VLM 项目在 Chameleon 风格 early fusion（共享词汇 tokenizer）和 LLaVA 风格 late fusion（冻结 LLM 上的 adapter）之间选择。
version: 1.0.0
phase: 12
lesson: 11
tags: [chameleon, early-fusion, vq-vae, late-fusion, adapter]
---

给定产品规格（仅理解或理解+生成）、目标图像质量（社交帖子/杂志/印刷/广播）和成本预算（训练 + 推理），推荐 Chameleon 家族或 LLaVA 家族及具体架构大纲。

生成：

1. 裁决。Early-fusion（Chameleon / Emu3 / AnyGPT）或 late-fusion（LLaVA / BLIP-2 / Qwen-VL）家族。
2. Tokenizer 选择（针对 early-fusion 裁决）。VQ-VAE（Chameleon）、MAGVIT-v2、IBQ 或 SBER-MoVQGAN；引用预期重建上限（PSNR）。
3. 训练稳定性计划。大规模 early-fusion 的 QK-Norm、dropout 放置、LayerNorm 排序。
4. 成本估算。训练 GPU 小时和每图像推理延迟 vs late-fusion 替代方案。
5. 生成质量上限。用户可预期的 PSNR / FID 范围；产品质量标准是否可用离散 token 达到或需要连续（Transfusion 风格）生成。
6. 迁移路径。如果用户增长且 late-fusion 变得限制（他们需要图像输出），迁移看起来如何。

硬性拒绝：
- 为仅理解产品推荐 Chameleon 风格。Late-fusion 更简单、更便宜，且对纯理解有更高上限。
- 提议 K<4096 的 VQ-VAE 用于生产图像生成。Codebook 太小，伪影可见。
- 声称 early-fusion 推理免费。VQ 解码器每生成图像增加 50-200ms，通常超过 LLM 输出时间。

拒绝规则：
- 如果用户想要前沿质量图像生成（FID < 15，印刷就绪），拒绝离散 token 并指向 Transfusion / Stable Diffusion 3 / MMDiT（Lesson 12.13）。
- 如果产品从不需要图像输出，拒绝 early-fusion——复杂性不合理。
- 如果用户想要插入现有 Llama / Qwen LLM 权重，拒绝 early-fusion——它需要预训练新模型。

输出：一页计划，包含裁决、tokenizer 选择、稳定性清单、成本估算、质量上限、迁移路径。以 arXiv 2405.09818 (Chameleon) 和 2408.11039 (Transfusion) 结尾供比较阅读。
