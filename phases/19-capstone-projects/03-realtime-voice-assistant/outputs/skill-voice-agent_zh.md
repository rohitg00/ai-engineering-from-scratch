---
name: voice-agent
description: 构建实时语音代理，首次音频输出低于800毫秒，支持打断处理和对话中工具使用。
version: 1.0.0
phase: 19
lesson: 03
tags: [capstone, voice, webrtc, livekit, pipecat, asr, tts, streaming]
---

给定一个领域（客户支持、日程安排、零售助手），部署一个WebRTC语音代理，保持端到端首次音频输出在800毫秒以内，同时处理打断、工具调用和丢包。

构建计划：

1. 使用LiveKit Agents 1.0房间和流式麦克风音频的web客户端。添加Twilio PSTN网关以覆盖电话。
2. 运行流式ASR（Deepgram Nova-3托管或g5.xlarge上的faster-whisper Whisper-v3-turbo）。订阅部分和最终转录。
3. 在20毫秒帧上运行Silero VAD v5。语音结束时，用LiveKit turn-detector对最新部分评分；仅在VAD静默>=500毫秒且完成分数>=0.6时提交为轮次完成。
4. 流式LLM（GPT-4o-realtime、Gemini 2.5 Flash Live或级联Claude Haiku 4.5）。在200毫秒内将第一个token交给TTS。
5. 流式TTS（Cartesia Sonic-2或ElevenLabs Flash v3）。第一个音频块必须在第一个LLM token后200毫秒内离开服务器。
6. 打断：当VAD在SPEAKING或THINKING期间检测到新用户语音时，取消TTS，丢弃剩余LLM输出，重新武装ASR。发布`tts_canceled` span。
7. 工具侧通道：并发运行函数调用；如果延迟>300毫秒，发出确认填充词，使音频流永不停滞。
8. 记录100通电话。针对保留转录测量WER、Hamming VAD基准上的误切断率、首次音频输出p50、NISQA MOS，以及3%丢包下的行为。
9. 在单个g5.xlarge上用合成呼叫者进行50通并发呼叫负载测试；报告持续首次音频输出p95。

评估标准：

| 权重 | 标准 | 测量 |
|:-:|---|---|
| 25 | 端到端延迟 | 100通记录呼叫中p50首次音频输出低于800毫秒 |
| 20 | 轮次转换质量 | Hamming VAD基准上误切断率低于3% |
| 20 | 工具使用正确性 | 对话中工具调用返回正确数据而不停滞音频 |
| 20 | 丢包下的可靠性 | 注入3%丢包时的WER和轮次转换稳定性 |
| 15 | 评估harness完整性 | 可复现测量及公开配置 |

硬性拒绝：
- 非流式管道（批量ASR、批量TTS）无法达到延迟目标。
- 任何不立即取消TTS缓冲区的打断策略。延迟取消产生最差用户体验回归。
- 同步阻塞LLM流的工具调用。它们必须在侧通道上运行。

拒绝规则：
- 拒绝在没有VAD或turn-detector的情况下部署。固定超时轮次转换产生不可接受的切断率。
- 拒绝在未记录是人工评分还是NISQA代理的情况下报告MOS。
- 拒绝在未至少记录100通电话并发布呼叫trace的情况下报告"p50延迟低于X"。

输出：包含LiveKit代理worker、PSTN网关配置、100通评估harness、公开Langfuse语音仪表板、与一家托管竞争对手（Retell、Vapi或OpenAI Realtime API直接）的并排比较，以及一份关于观察到的三大轮次转换失败及修复每个的detector调优的撰写。
