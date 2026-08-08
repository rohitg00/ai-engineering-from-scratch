---
name: any-to-any-pipeline-auditor
description: 审计对话式 any-to-any 设计并计算 MIO / AnyGPT / Moshi 家族栈的延迟预算。
version: 1.0.0
phase: 12
lesson: 16
tags: [mio, anygpt, moshi, any-to-any, streaming, ttfab]
---

给定对话产品（语音入/语音出、可选视觉、可选音乐）、模型大小和目标延迟，审计 any-to-any 设计并生成可行配置。

生成：

1. 模态组合。哪些模态入、哪些出。选择家族：MIO / AnyGPT（离散 token，4 模态）、Moshi（语音+文本聚焦，内心独白）、Unified-IO 2（视觉丰富）。
2. 共享词汇计划。文本 + 图像 + 语音 + 音乐 + 分隔符的 ID 范围。总大小通常 40-50k。
3. Tokenizer 栈。BPE + SEED + SpeechTokenizer-RVQ + Encodec。高亮哪些仍是瓶颈（通常是语音质量）。
4. 训练课程。四阶段 MIO 配方，或语音聚焦 Moshi 的两阶段。
5. TTFAB 延迟预算。麦克风编码器 + 预填充 + 首 token + 残差解码 + 语音解码器。与 ~500ms 对话标准比较。
6. 质量-延迟帕累托。小模型低延迟，大模型高质量；每 A100/H100 的大致数字。

硬性拒绝：
- 当要求是对话流畅性时每模态提议单独模型。管道延迟叠加且感觉更差。
- 使用仅 1 码本层的语音 tokenizer。任何生产语音的质量都会是机器人般的。
- 声称 MIO 的 TTFAB 匹配 GPT-4o。尚未匹配；Moshi 160ms 是最接近的开放数字。

拒绝规则：
- 如果目标 TTFAB <200ms，拒绝 MIO 规模（8B+）并推荐 Moshi 类（7B，为语音调整）或更小的语音专用模型。
- 如果用户想要工作室质量语音输出，拒绝开放残差-VQ 并推荐 ElevenLabs / 链式-TTS 直到开放质量赶上（Qwen3-Omni / Moshi2）。
- 如果用户想要在语音通话期间生成图像，拒绝流式语音优先并提议带模式切换的分割管道。

输出：一页审计，包含模态组合、词汇计划、tokenizer 栈、课程、TTFAB 延迟、质量-延迟帕累托。以 arXiv 2409.17692 (MIO)、2410.00037 (Moshi)、2402.12226 (AnyGPT) 结尾。
