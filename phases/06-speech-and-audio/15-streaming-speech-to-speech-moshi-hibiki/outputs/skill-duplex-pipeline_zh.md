---
name: duplex-pipeline
description: 为语音代理工作负载选择全双工（Moshi）vs 流水线（VAD + STT + LLM + TTS）架构。
version: 1.0.0
phase: 6
lesson: 15
tags: [moshi, hibiki, full-duplex, voice-agent, streaming]
---

给定工作负载（延迟目标、工具调用需求、语言覆盖范围、硬件预算、云端 vs 边缘），输出：

1. 架构。全双工（Moshi / GPT-4o Realtime / Gemini Live）vs 流水线（LiveKit + STT + LLM + TTS，第 12 课）。一句话说明原因。
2. 模型。Moshi · Hibiki · Hibiki-Zero · Sesame CSM · GPT-4o Realtime · Gemini 2.5 Live · 传统流水线。说明原因。
3. 规模。每会话 GPU 成本（Moshi 占用一个槽位）、最大并发会话数、冷启动影响。
4. 工具调用路径。如果需要——混合流水线（全双工 + 外部 LLM 用于工具调用）或纯流水线。解释权衡。
5. 语言覆盖范围。全双工模型语言支持较窄；流水线继承 LLM 的多语言能力。

拒绝将纯全双工架构用于需要工具调用 / 检索的企业代理——Moshi 是对话模型，不是代理框架。拒绝将纯流水线用于低于 250 ms 的对话代理——各阶段累加。拒绝在单个 GPU 上为 Moshi 分配 &gt; 4 个并发会话——会产生争用。

示例输入："语言学习语音伴侣——对话流利度练习。英语 + 法语。&lt; 250 ms 响应速度。10k 日活跃用户。"

示例输出：
- 架构：全双工（Moshi）。低于 250 ms 的延迟要求 + 对话流利度符合 Moshi 的优势。
- 模型：Moshi。EN + FR 都得到良好支持。CC-BY 4.0 许可证。
- 规模：每 4-6 个并发会话一个 L4 GPU → 10k DAU 在 10% 并发率下峰值约需 1500 个 GPU。计划使用 Kyutai Pocket TTS + 本地 Whisper 的设备端轻量模式作为安静路径。
- 工具调用：最少——"显示语法提示"和"翻译这个短语"可以通过一个微型 LLM 边车路由；大部分交互是开放式对话，Moshi 在此表现出色。
- 语言覆盖：EN + FR（原生）；ES / DE / JP 通过 Hibiki-Zero 自适应（每种新语言需要 1000 小时音频）。
