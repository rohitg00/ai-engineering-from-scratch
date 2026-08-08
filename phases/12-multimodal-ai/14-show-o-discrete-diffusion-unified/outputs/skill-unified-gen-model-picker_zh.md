---
name: unified-gen-model-picker
description: 为需要多模态理解和生成且开放权重的产品在 Show-o / Transfusion / Emu3 / Janus-Pro 家族之间选择。
version: 1.0.0
phase: 12
lesson: 14
tags: [show-o, masked-diffusion, unified, t2i, inpainting]
---

给定需要统一理解 + 生成（VQA、字幕、T2I、可选修复）且开放权重约束和延迟预算的产品，选择模型家族并发出参考配置。

生成：

1. 家族裁决。Show-o（masked 离散 diffusion）、Transfusion / MMDiT（连续 diffusion）、Emu3 / Chameleon（自回归离散）或 Janus-Pro（解耦编码器）。
2. 推理步数预算。Show-o 16 步，Transfusion 20 步，Emu3 1024+。用用户延迟预算论证选择。
3. 修复支持。Show-o 免费；Transfusion 添加掩码通道；Emu3 需要单独微调。为用户标记此点。
4. Tokenizer 选择。离散家族推荐 IBQ / MAGVIT-v2 / SBER；连续推荐 SD3 的 VAE。
5. 训练稳定性。双损失（Transfusion）需要权重调整；Show-o 的单损失更干净。
6. 用户增长时的迁移路径。当质量成为限制时从 Show-o 到 Transfusion。

硬性拒绝：
- 当推理延迟 <10s 每图像时提议 Emu3 / Chameleon。~1024 token 上的自回归太慢。
- 声称 Show-o 在 frontier 图像质量上匹配 Transfusion。不匹配。Tokenizer 是上限。
- 为需要 VQA 的产品推荐 Stable Diffusion。SD 不能对图像推理。

拒绝规则：
- 如果用户想要 <2s 每图像生成，拒绝 Show-o 并推荐 Stable Diffusion + 单独 VLM 用于理解。接受多模型复杂性。
- 如果用户想要开放权重的"最佳质量"，拒绝 Show-o / Emu3 并推荐 Transfusion 家族（MMDiT）或 JanusFlow。
- 如果用户无法承诺 tokenizer（担心许可、质量上限），拒绝仅离散家族并推荐 Transfusion。

输出：一页选择，包含家族裁决、步数预算、修复支持、tokenizer 推荐、稳定性计划和迁移路径。以 arXiv 2408.12528 (Show-o)、2408.11039 (Transfusion)、2501.17811 (Janus-Pro) 结尾。
