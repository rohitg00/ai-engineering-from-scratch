---
name: patch-geometry-reader
description: 读取 ViT 配置并生成 patch-token、参数和 VRAM 分析，用于下游 VLM 规划。
version: 1.0.0
phase: 12
lesson: 01
tags: [vit, patch-tokens, dinov2, siglip, vlm-backbone]
---

给定一个视觉骨干配置（patch 大小、分辨率、隐藏维度、深度、头数、可选寄存器），生成一个几何分析，告诉调用者该编码器将发出多少 token、运行它需要多少 VRAM，以及它是否是下游 VLM 或密集预测任务的正确选择。

生成：

1. Patch 网格和序列长度。网格形状 (H/P, W/P)。包括 CLS、寄存器和任何池化 token 的序列长度。声明时高亮多分辨率支持（NaFlex、AnyRes）。
2. 参数分解。Patch 嵌入、位置嵌入、transformer 块（注意力 + MLP）、最终 LN，精确计数和易读格式（例如 86.4M）的总数。
3. 每次前向 FLOPs。注意力（每块 4 N D^2 + 2 N^2 D）和 MLP（每块 16 N D^2），跨深度求和。标记在高分辨率下会咬人的 N 的二次方成本。
4. VRAM 估算。单张图像单次前向的推理激活内存，加上如果编码器馈送下游 LLM 的 KV 等效缓存。
5. 池化建议。CLS、均值 patch、基于寄存器，或为 VLM 跳过池化，基于声明的下游任务。

硬性拒绝：
- 任何将 patch token 视为与输入像素相同的分析。投影是学习的线性映射；patch 是抽象向量，不是像素。
- 声称 CLS 始终是正确的池化。现代密集特征和 VLM 路径完全跳过 CLS。
- 将 2D-RoPE 和学习的 positional embeddings 视为可互换而不注明 NaFlex 风格的 native-resolution 灵活性。

拒绝规则：
- 如果提供的配置声明的 patch 大小不能整除图像大小，拒绝——这不是没有声明填充方案的 NaFlex 兼容配置。
- 如果调用者要求专有模型（Gemini、Claude、GPT-5）的精确预训练权重计数，拒绝——这些未公开。
- 如果目标部署 VRAM 低于 4GB 用于 ViT-g/14 级模型，拒绝并推荐 SigLIP SO400m/14 或更小的骨干。

输出：一页几何分析，包含 token 计数、参数分解、FLOPs 估算、VRAM 预算和推荐的池化策略。以"接下来阅读什么"段落结尾，指向 SigLIP 2 论文（arXiv:2502.14786）了解 NaFlex 细节、DINOv2 论文了解密集特征，或 Lesson 12.06 了解 patch-n'-pack 实现。
