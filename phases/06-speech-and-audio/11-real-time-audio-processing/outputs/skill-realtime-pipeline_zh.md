---
name: realtime-voice-pipeline
description: 为目标端到端延迟选择传输层、VAD、流式 STT、LLM、流式 TTS 和编排方案。
version: 1.0.0
phase: 6
lesson: 11
tags: [voice-agent, livekit, pipecat, silero, streaming, latency]
---

给定目标（延迟 P50/P95、语言、通道、离线 vs 云端、通话量），输出：

1. 传输层。WebRTC（LiveKit / Daily）· WebSocket · SIP 中继（Twilio / Telnyx）。原因与抖动容忍度 + 用例相关。
2. VAD + 话轮转换。Silero VAD（开源，99.5% TPR）· Cobra（商业）· LiveKit 话轮检测器。阈值、最小语音时长、静音挂起时间。
3. 流式 STT。Parakeet TDT（最快的开源）· Kyutai STT（带 flush 技巧）· Deepgram Nova-3（API，~150 ms）· Whisper-streaming。说明原因。
4. LLM + 流式。在 TTS 启动前固定前 20 个 token。模型 + 流式配置 + 提示注入防护栏。
5. 流式 TTS。Kokoro-82M（~100 ms TTFA）· Orpheus · Cartesia Sonic · ElevenLabs Turbo。语音包或克隆防护（第 8 课）。
6. 编排。LiveKit Agents · Pipecat · Vapi · Retell · 自定义 Rust。原因与团队技能 + 规模相关。
7. 可观测性。每阶段 P50/P95/P99 直方图；误报中断率；掉话率；通话样本上的 WER。

拒绝在 STT 前缓冲整个 utterance 的部署。拒绝不流式的 TTS。拒绝按平均延迟评估——要求 P95。拒绝在没有与自建成本比较的情况下将托管平台（Vapi / Retell）用于 &gt; 100k 分钟/月。

示例输入："车险报价语音代理。&lt; 500 ms P95。英语，美国。50k 分钟/周。合规：HIPAA 相关（日志中无 PII）。"

示例输出：
- 传输层：LiveKit Agents + Twilio SIP。在呼叫中心规模得到验证，支持 HIPAA 模式选择加入。
- VAD：Silero VAD @ 阈值 0.45，最小语音 220 ms，静音挂起 400 ms。LiveKit 话轮检测器覆盖。
- STT：Deepgram Nova-3 英语（~150 ms P95）；如果需要本地审计，则回退到 Parakeet-TDT。
- LLM：通过 OpenAI 实时 API 流式传输 GPT-4o；使用后过滤防止提示注入；将前 20 个 token 固定给 TTS。
- TTS：Cartesia Sonic 2（~150 ms TTFA，不使用声音克隆——预定义语音）。
- 编排：LiveKit Agents。通过 Hamming AI 进行生产可观测性。
- 日志：在持久化前用正则 + NER 通道去除 CVV / SSN / DOB。保留 30 天。
