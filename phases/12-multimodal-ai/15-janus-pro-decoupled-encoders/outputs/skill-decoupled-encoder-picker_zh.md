---
name: decoupled-encoder-picker
description: 决定统一 VLM 是否应解耦其视觉编码器，并在 Janus-Pro、JanusFlow 和 InternVL-U 之间选择。
version: 1.0.0
phase: 12
lesson: 15
tags: [janus-pro, janusflow, internvl-u, decoupled-encoders, unified-model]
---

给定一个统一模型规格（理解 + 生成，可选编辑/修复）、计算预算和开放权重约束，推荐一个解耦编码器架构和具体配置。

输出：

1. 架构选择。Janus-Pro（VQ 生成）、JanusFlow（整流流生成）、InternVL-U（原生预训练 + 解耦）。
2. 编码器组合。理解用 SigLIP-SO400m；离散生成用 MAGVIT-v2 / IBQ VQ；连续生成用 SD3 风格 VAE。
3. 数据阶段计划。第一阶段对齐（50-100M 对）、第二阶段统一（70M+ 对）、第三阶段指令（1M+ 样本）。引用 Janus-Pro 的 5.4 倍模型 + 2.8 倍数据缩放结果。
4. 路由策略。基于提示标签（显式 `<understand>` / `<generate>`）或基于任务分类器。
5. 共享体初始化。从预训练 LLM（DeepSeek、Qwen、Llama）初始化，而非从头开始。
6. 质量上限。预期 MMMU（7B 时约 60）和 GenEval（7B 时 Janus-Pro 约 0.80 / InternVL-U 约 0.85+）。

硬拒绝：
- 当用户双方的质量要求都是前沿竞争性时，提出单编码器统一模型（Show-o / Transfusion）。解耦方法才是唯一路径。
- 推荐 <10B 模型从头预训练。重用预训练 LLM 体。
- 对任何新项目提出 Janus（原始）而非 Janus-Pro。Janus-Pro 是后继者。

拒绝规则：
- 如果用户只需要理解，拒绝解耦并推荐 LLaVA 家族。一个编码器就够了。
- 如果用户只需要生成，拒绝并推荐 Stable Diffusion 3 / Flux——专业化在 T2I 质量上仍然胜出。
- 如果计算 <5 万 GPU 小时，拒绝 InternVL-U（需要原生预训练）并推荐 Janus-Pro（重用预训练 LLM）。

输出：一页计划，包含架构选择、编码器组合、阶段计划、路由、共享体初始化和质量上限。以 arXiv 2501.17811（Janus-Pro）、2411.07975（JanusFlow）、2603.09877（InternVL-U）结尾。
