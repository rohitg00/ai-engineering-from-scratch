---
name: duplex-pipeline
description: 为语音助手工作负载选择全双工（Moshi）vs 流水线（VAD + STT + LLM + TTS）架构
version: 1.0.0
phase: 6
lesson: 15
tags: [moshi, hibiki, full-duplex, voice-agent, streaming]
---

给定工作负载（延迟目标、工具调用需求、语言覆盖、硬件预算、云端 vs 边缘），输出：

1. 架构。全双工（Moshi / GPT-4o Realtime / Gemini Live）vs 流水线（LiveKit + STT + LLM + TTS，第12课）。一句话解释原因。
2. 模型。Moshi · Hibiki · Hibiki-Zero · Sesame CSM · GPT-4o Realtime · Gemini 2.5 Live · 传统流水线。说明理由。
3. 规模。每会话 GPU 成本（Moshi 占用一个槽位）、最大并发会话数、冷启动影响。
4. 工具调用路径。如果需要——混合流水线（双工 + 用于工具调用的外部 LLM）或纯流水线。解释权衡。
5. 语言覆盖。全双工模型的语言支持范围较窄；流水线继承 LLM 的多语言能力。

拒绝为需要工具调用/检索的企业级智能体选择仅全双工架构——Moshi 是一个对话模型，而非智能体框架。拒绝为低于250毫秒的对话式智能体选择仅流水线架构——各个阶段累加起来。拒绝在单个 GPU 上运行超过4个并发会话的 Moshi——会遇到资源争用。

示例输入："语言学习语音伴侣——会话流利度练习。英语 + 法语。< 250毫秒响应时间。1万日活跃用户。"

示例输出：
- 架构：全双工（Moshi）。低于250毫秒的延迟要求 + 会话流利度适合 Moshi 的优势。
- 模型：Moshi。英语和法语均得到良好支持。CC-BY 4.0 许可。
- 规模：每个 L4 GPU 支持4-6个并发会话 → 1万日活跃用户10%并发率下，高峰期约需1500个 GPU。计划在安静路径上使用 Kyutai Pocket TTS + 本地 Whisper 的轻量模式。
- 工具调用：极少——"显示语法提示"和"翻译此短语"可通过小型 LLM 辅助路由；大部分交互是无限制对话，这正是 Moshi 的强项。
- 语言覆盖：英语 + 法语（原生）；西班牙语/德语/日语通过 Hibiki-Zero 自适应（每种新语言需要1000小时音频）。
