---
name: tokenizer-vs-adapter-picker
description: 为 VLM 项目选择 Chameleon 风格早期融合（共享词汇表分词器）和 LLaVA 风格后期融合（冻结 LLM 上的适配器）。
version: 1.0.0
phase: 12
lesson: 11
tags: [chameleon, early-fusion, vq-vae, late-fusion, adapter]
---

给定一个产品规格（仅理解或理解+生成）、目标图像质量（社交媒体帖子 / 杂志 / 印刷 / 广播）和成本预算（训练 + 推理），推荐 Chameleon 家族或 LLaVA 家族，附具体架构大纲。

输出：

1. 判断。早期融合（Chameleon / Emu3 / AnyGPT）或后期融合（LLaVA / BLIP-2 / Qwen-VL）家族。
2. 分词器选择（针对早期融合判断）。VQ-VAE（Chameleon）、MAGVIT-v2、IBQ 或 SBER-MoVQGAN；引用 PSNR 中的预期重建上限。
3. 训练稳定性计划。大规模早期融合的 QK-Norm、丢弃位置、LayerNorm 排序。
4. 成本估算。与后期融合替代方案相比的训练 GPU 小时数和每张图像推理延迟。
5. 生成质量上限。用户可预期的 PSNR / FID 范围；产品是否可通过离散 token 达到质量要求，或需要连续（Transfusion 风格）生成。
6. 迁移路径。如果用户增长且后期融合变得受限（他们需要图像输出），迁移路径是什么样子。

硬拒绝：
- 推荐 Chameleon 风格用于仅理解产品。后期融合对纯理解更简单、更便宜、上限更高。
- 提出使用 K<4096 的 VQ-VAE 用于生产图像生成。码本太小，伪影可见。
- 声称早期融合推理免费。VQ 解码器每张生成图像增加 50-200ms，通常超过 LLM 输出时间。

拒绝规则：
- 如果用户想要前沿质量的图像生成（FID < 15，印刷就绪），拒绝离散 token 并指向 Transfusion / Stable Diffusion 3 / MMDiT（第 12.13 课）。
- 如果产品从不需要图像输出，拒绝早期融合——复杂度不合理。
- 如果用户想要插入现有的 Llama / Qwen LLM 权重，拒绝早期融合——它需要从头预训练新模型。

输出：一页计划，包含判断、分词器选择、稳定性检查清单、成本估算、质量上限、迁移路径。以 arXiv 2405.09818（Chameleon）和 2408.11039（Transfusion）结尾供比较阅读。
