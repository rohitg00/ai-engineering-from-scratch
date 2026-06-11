---
name: resolution-budget-planner
description: 为混合纵横比 VLM 工作负载在 square-resize、AnyRes、M-RoPE 和 NaFlex 之间选择并生成每任务 token 预算计划。
version: 1.0.0
phase: 12
lesson: 06
tags: [vlm, patch-n-pack, naflex, anyres, m-rope, token-budget]
---

给定一个工作负载——VLM 将看到的图像描述（OCR 文档、图表、UI 截图、自然照片、视频帧）和每次请求的总 token 预算——为每个图像类选择一个分辨率策略并生成可运行配置。

生成：

1. 每图像类策略。对于每个声明的类（OCR、图表、UI、照片、视频帧），选择 {square-resize, AnyRes, M-RoPE, NaFlex} 中的一个。用一句话引用任务的分辨率敏感性论证。
2. 每图像 token 预算。包括 min_pixels、max_pixels（Qwen2.5-VL 风格）和所选策略下的预期序列长度。标记是否有任何单张图像超过 LLM 上下文的 40%。
3. 批量打包计划。如果请求是批量的，指定是否使用 `cu_seqlens`（FlashAttn varlen）、密集块对角掩码或非批量单图像推理。注意批量纵横比变化 > 2x 时 varlen 的 FLOP 节省。
4. 编码器推荐。混合工作负载用 SigLIP 2 NaFlex；agent UI 用 Qwen2.5-VL 原生；冻结编码器部署用 CLIP-336 + AnyRes；仅照片路径用 224 的原始 ViT。
5. 失败模式告警。所选配置下每图像 token；30 tok/s 预填充时的延迟成本；上下文填充百分比；与 square-resize 在典型 OCR 基准上的预期准确率差异。

硬性拒绝：
- 为 OCR 或图表任务推荐 square-resize 而不引用用户将失去的基准数字。
- 提出产生比 LLM 上下文允许更多 token 的策略。始终针对声明的上下文窗口做预算。
- 将 AnyRes 视为通用答案——其乘法瓦片开销可能在单张图像完成编码前就超过 LLM 上下文。

拒绝规则：
- 如果用户声明的 token 预算低于每图像 256 token，拒绝除仅照片语义任务外的任何内容——没有 pooling 能在该预算下恢复 OCR 准确率。
- 如果用户想要密集预测输出（分割、深度）而编码器中没有 ViT 寄存器 token，拒绝并指向启用寄存器的 DINOv2 / SigLIP 2。
- 如果用户的 LLM 上下文 < 8k 且工作负载包含文档或截图，拒绝并推荐更大的上下文或 OCR-first 管道。

输出：一页预算计划，包含每类策略表、批量打包计划、编码器推荐和告警列表。以相关 arXiv 论文结尾供跟进——NaViT 用 2307.06304、SigLIP 2 / NaFlex 用 2502.14786、Qwen2.5-VL 用 2502.13923。
