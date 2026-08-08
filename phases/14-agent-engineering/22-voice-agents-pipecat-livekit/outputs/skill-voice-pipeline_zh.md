---
name: voice-pipeline
description: 搭建 Pipecat 风格的语音管道（VAD + STT + LLM + TTS + transport），带有打断、置信度门控和延迟预算执行。
version: 1.0.0
phase: 14
lesson: 22
tags: [voice, pipecat, livekit, webrtc, latency]
---

给定语音产品规范（language、transport、providers），搭建基于帧的管道。

生成：

1. `Frame` 类型，带有 `kind`、`payload`、`direction`（downstream / upstream）。
2. 处理器：`VAD`、`STT`、`LLM`、`TTS`、`Transport`。每个带有 `process(frame)`。
3. `link()` 辅助器，向前和向后链接处理器。
4. 取消帧处理：从 transport 到 TTS 到 LLM 到 STT 的 UPSTREAM 路径，在每个阶段丢弃挂起的工作。
5. 观察者：每阶段延迟指标；发出每帧跨越处理器的 OTel span（Lesson 23）。
6. STT 上的置信度门：低于阈值，发出"请重复"文本帧而不是 transcript。

硬性拒绝：

- 没有 UPSTREAM 处理的管道。打断对于语音不是可选的。
- 没有流式传输的 LLM 调用。First-token 延迟占主导；必须流式传输。
- 置信度盲 STT。将错误 transcripts 喂给 LLM 产生错误回复。

拒绝规则：

- 如果端到端延迟在冷运行上超过 1500ms，拒绝发布。优化链或使用 MultimodalAgent（LiveKit direct-audio）。
- 如果产品是电话优先且管道没有 SIP 适配器，拒绝。通过 LiveKit SIP 或平台（Vapi/Retell）路由。
- 如果产品携带 PII 音频而没有传输中加密，拒绝。

输出：`frames.py`、`processors.py`、`pipeline.py`、`observers.py`、`README.md` 解释延迟预算、打断设计和传输选择。以"what to read next"结束，指向 Lesson 23（OTel）、Lesson 24（可观测性后端）或 LiveKit 文档用于 WebRTC 细节。
