---
name: voice-pipeline
description: 搭建一个 Pipecat 风格的语音管道（VAD + STT + LLM + TTS + 传输），支持插话、置信度门控和延迟预算强制执行。
version: 1.0.0
phase: 14
lesson: 22
tags: [voice, pipecat, livekit, webrtc, latency]
---

给定一份语音产品规格（语言、传输方式、提供商），搭建一个基于帧的管道。

产出：

1. `Frame` 类型，包含 `kind`、`payload`、`direction`（下行 / 上行）。
2. 处理器：`VAD`、`STT`、`LLM`、`TTS`、`Transport`。每个都有 `process(frame)`。
3. `link()` 辅助函数，将处理器向前和向后链接。
4. 取消帧处理：从传输层到 TTS 到 LLM 到 STT 的上行路径，在每个阶段丢弃待处理工作。
5. 观察器：每阶段延迟指标；在每个帧跨越处理器时发出 OTel span（第 23 课）。
6. STT 上的置信度门控：低于阈值时，发出"请重复"文本帧而非转录文本。

硬性拒绝：

- 没有上行处理的管道。插话对语音来说不是可选的。
- 没有流式传输的 LLM 调用。首个令牌延迟占主导地位；必须流式传输。
- 不考虑置信度的 STT。将错误转录文本喂给 LLM 会产生错误回复。

拒绝规则：

- 如果冷启动端到端延迟超过 1500ms，拒绝交付。优化链路或使用 MultimodalAgent（LiveKit 直接音频）。
- 如果产品以电话为主且管道没有 SIP 适配器，拒绝。通过 LiveKit SIP 或平台（Vapi/Retell）路由。
- 如果产品在传输中携带个人身份信息音频且未加密，拒绝。

输出：`frames.py`、`processors.py`、`pipeline.py`、`observers.py`、`README.md`，解释延迟预算、插话设计和传输方式选择。以"下一步阅读"结尾，指向第 23 课（OTel）、第 24 课（可观测性后端）或 LiveKit 文档以了解 WebRTC 细节。
