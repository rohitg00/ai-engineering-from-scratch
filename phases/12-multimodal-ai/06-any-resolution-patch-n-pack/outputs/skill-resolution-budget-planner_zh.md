---
name: resolution-budget-planner
description: 为混合宽高比 VLM 工作负载在 square-resize、AnyRes、M-RoPE 和 NaFlex 之间选择，并为每个任务发射 token 预算计划。
version: 1.0.0
phase: 12
lesson: 06
tags: [vlm, patch-n-pack, naflex, anyres, m-rope, token-budget]
---

给定一个工作负载——VLM 将看到的图像描述（OCR 文档、图表、UI 截图、自然照片、视频帧）和总每请求 token 预算——为每个图像类别选择一个分辨率策略并生成可运行的配置。

输出：

1. 每图像类别策略。对每个声明的类别（OCR、图表、UI、照片、视频帧），从 {square-resize、AnyRes、M-RoPE、NaFlex} 中选择一个。引用任务的分辨率敏感性，用一句话论证。
2. 每张图像 token 预算。包括 min_pixels、max_pixels（Qwen2.5-VL 风格）和所选策略下的预期序列长度。标记是否有任何单张图像超出 LLM 上下文的 40%。
3. 批处理打包计划。如果请求是批处理的，指定使用 `cu_seqlens`（FlashAttn varlen）、密集块对角掩码还是非批处理的单图像推理。注意当批处理宽高比差异超过 2 倍时 varlen 的 FLOP 节省。
4. 编码器推荐。混合工作负载用 SigLIP 2 NaFlex；智能体 UI 用 Qwen2.5-VL 原生；冻结编码器部署用 CLIP-336 + AnyRes；仅照片路径用 224 的原始 ViT。
5. 故障模式警报。所选配置下的每图像 token 数；30 tok/s 预填充下的延迟成本；上下文填充百分比；与典型 OCR 基准上的 square-resize 相比的预期准确率差异。

硬拒绝：
- 在没有引用用户将丢失哪个基准数字的情况下推荐 OCR 或图表任务的 square-resize。
- 提出产生超过 LLM 上下文允许的 token 的策略。始终根据声明的上下文窗口做预算。
- 将 AnyRes 视为通用答案——其乘性瓦片开销可能在单张图像完成编码前就超出 LLM 上下文。

拒绝规则：
- 如果用户声明的 token 预算低于每张图像 256 token，拒绝除仅照片语义任务外的任何情况——在该预算下没有任何池化能恢复 OCR 准确率。
- 如果用户希望在没有编码器中 ViT 寄存器 token 的情况下获得密集预测输出（分割、深度），拒绝并指向 DINOv2 / SigLIP 2（启用寄存器）。
- 如果用户的 LLM 上下文 < 8k 且工作负载包括文档或截图，拒绝并推荐更大的上下文或 OCR 优先流水线。

输出：一页预算计划，包含每类策略表、批处理打包计划、编码器推荐和警报列表。以相关 arXiv 论文结尾用于后续阅读——2307.06304（NaViT）、2502.14786（SigLIP 2 / NaFlex）、2502.13923（Qwen2.5-VL）。
