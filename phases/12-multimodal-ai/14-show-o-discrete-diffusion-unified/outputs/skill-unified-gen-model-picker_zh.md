---
name: unified-gen-model-picker
description: 在 Show-o / Transfusion / Emu3 / Janus-Pro 家族之间选择，用于需要多模态理解和生成且具有开放权重的产品。
version: 1.0.0
phase: 12
lesson: 14
tags: [show-o, masked-diffusion, unified, t2i, inpainting]
---

给定一个需要统一理解+生成（VQA、描述、T2I、可选修复）的产品，具有开放权重约束和延迟预算，选择一个模型家族并发射参考配置。

输出：

1. 家族判断。Show-o（掩码离散扩散）、Transfusion / MMDiT（连续扩散）、Emu3 / Chameleon（自回归离散）或 Janus-Pro（解耦编码器）。
2. 推理步预算。Show-o 16 步，Transfusion 20 步，Emu3 1024+ 步。用用户的延迟预算论证选择。
3. 修复支持。Show-o 原生支持；Transfusion 添加掩码通道；Emu3 需要单独的微调。为用户标记此点。
4. 分词器选择。对于离散家族，推荐 IBQ / MAGVIT-v2 / SBER；对于连续家族，推荐 SD3 的 VAE。
5. 训练稳定性。双损失（Transfusion）需要权重调优；Show-o 的单损失更简洁。
6. 用户增长时的迁移路径。从 Show-o 到 Transfusion 当质量成为瓶颈时。

硬拒绝：
- 当推理延迟每张图像 <10s 时提出 Emu3 / Chameleon。在约 1024 个 token 上的自回归太慢。
- 声称 Show-o 在前沿图像质量上匹配 Transfusion。它不能。分词器是上限。
- 为需要 VQA 的产品推荐 Stable Diffusion。SD 不能推理图像。

拒绝规则：
- 如果用户想要每张图像生成 <2s，拒绝 Show-o 并推荐 Stable Diffusion + 用于理解的单独 VLM。接受多模型复杂度。
- 如果用户想要"同类最佳质量"且具有开放权重，拒绝 Show-o / Emu3 并推荐 Transfusion 家族（MMDiT）或 JanusFlow。
- 如果用户不能承诺使用某个分词器（担心许可、质量上限），拒绝仅离散家族并推荐 Transfusion。

输出：一页选择，包含家族判断、步预算、修复支持、分词器推荐、稳定性计划和迁移路径。以 arXiv 2408.12528（Show-o）、2408.11039（Transfusion）、2501.17811（Janus-Pro）结尾。
