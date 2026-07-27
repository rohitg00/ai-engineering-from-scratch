---
name: realtime-voice-pipeline
description: 为目标端到端延迟选择传输方式、VAD、流式 STT、LLM、流式 TTS 和编排方案
version: 1.0.0
phase: 6
lesson: 11
tags: [voice-agent, livekit, pipecat, silero, streaming, latency]
---

给定目标（延迟 P50/P95、语言、信道、离线 vs 云端、通话量），输出：

1. 传输方式。WebRTC（LiveKit / Daily）· WebSocket · SIP 中继（Twilio / Telnyx）。理由与抖动容忍度和用例相关。
2. VAD + 轮换控制。Silero VAD（开放、99.5% TPR）· Cobra（商业）· LiveKit 轮换检测器。阈值、最短语音时长、静音持续时间。
3. 流式 STT。Parakeet TDT（最快的开放方案）· Kyutai STT（带刷新技巧）· Deepgram Nova-3（API、约150毫秒）· Whisper-streaming。说明理由。
4. LLM + 流式。在 TTS 启动前固定前20个词元。模型 + 流式配置 + 针对提示注入的安全护栏。
5. 流式 TTS。Kokoro-82M（约100毫秒 TTFA）· Orpheus · Cartesia Sonic · ElevenLabs Turbo。语音包或克隆保护（第8课）。
6. 编排。LiveKit Agents · Pipecat · Vapi · Retell · 自定义 Rust。理由与团队技能和规模相关。
7. 可观测性。按阶段的 P50/P95/P99 直方图；误正中断率；通话掉线率；通话样本的词错误率（WER）。

拒绝在 STT 之前缓冲整个话语的部署。拒绝不进行流式传输的 TTS。拒绝用平均延迟评估——要求使用 P95。拒绝超过10万分钟/月的托管平台（Vapi / Retell）而不与自建方案进行成本比较。

示例输入："车险报价语音助手。< 500毫秒 P95。英语，美国。5万分钟/周。合规：类似 HIPAA（日志中不含个人身份信息）。"

示例输出：
- 传输方式：LiveKit Agents + Twilio SIP。在呼叫中心规模下经过验证，可选 HIPAA 模式。
- VAD：Silero VAD @ 阈值 0.45，最短语音 220毫秒，静音持续时间 400毫秒。叠加 LiveKit 轮换检测器。
- STT：Deepgram Nova-3 英语（约150毫秒 P95）；如需本地审计则回退到 Parakeet-TDT。
- LLM：通过 OpenAI 实时 API 进行 GPT-4o 流式传输；使用后过滤器防御提示注入；将前20个词元固定到 TTS。
- TTS：Cartesia Sonic 2（约150毫秒 TTFA，不使用音色克隆——使用预设音色）。
- 编排：LiveKit Agents。通过 Hamming AI 进行生产环境可观测性。
- 日志：在持久化之前使用正则表达式 + NER 去除 CVV / 社会安全号码 / 出生日期。保留30天。
