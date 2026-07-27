---
name: voice-agent
description: 构建一个实时语音助手，首次音频输出低于 800 毫秒，支持插话处理和对话中的工具使用。
version: 1.0.0
phase: 19
lesson: 03
tags: [capstone, voice, webrtc, livekit, pipecat, asr, tts, streaming]
---

给定一个领域（客户支持、日程安排、零售助手），部署一个 WebRTC 语音助手，保持端到端首次音频输出低于 800 毫秒，同时处理插话、工具调用和数据包丢失。

构建计划：

1. 搭建一个 LiveKit Agents 1.0 房间，带有流式麦克风音频的 Web 客户端。添加 Twilio PSTN 网关以覆盖电话线路。
2. 运行流式 ASR（Deepgram Nova-3 托管服务或基于 g5.xlarge 的 faster-whisper Whisper-v3-turbo）。订阅部分和最终转录。
3. 在 20ms 帧上运行 Silero VAD v5。在语音结束时，使用 LiveKit 轮次检测器对最新的部分转录打分；仅在 VAD 静默 >= 500ms 且完成分数 >= 0.6 时确认轮次完成。
4. 流式 LLM（GPT-4o-realtime、Gemini 2.5 Flash Live 或级联的 Claude Haiku 4.5）。在 200ms 内将第一个令牌交给 TTS。
5. 流式 TTS（Cartesia Sonic-2 或 ElevenLabs Flash v3）。第一个音频块必须在收到第一个 LLM 令牌后的 200ms 内离开服务器。
6. 插话：当 VAD 在 SPEAKING 或 THINKING 状态下检测到新的用户语音时，取消 TTS，丢弃剩余的 LLM 输出，重新启动 ASR。发布一个 `tts_canceled` 跨度。
7. 工具侧通道：并发运行函数调用；如果延迟超过 300ms，发出确认填充内容，使音频流永不中断。
8. 录制 100 次通话。测量 WER 与保留转录本的对比、Hamming VAD 基准上的误切率、首次音频输出 p50、NISQA MOS，以及在 3% 数据包丢失下的行为。
9. 使用合成呼叫者在单个 g5.xlarge 上对 50 个并发通话进行负载测试；报告持续首次音频输出 p95。

评估量规：

| 权重 | 标准 | 衡量方法 |
|:-:|---|---|
| 25 | 端到端延迟 | 100 次录制通话中首次音频输出 p50 低于 800ms |
| 20 | 轮次切换质量 | Hamming VAD 基准上误切率低于 3% |
| 20 | 工具使用正确性 | 对话中的工具调用返回正确数据，不中断音频 |
| 20 | 数据包丢失下的可靠性 | 注入 3% 数据包丢失时的 WER 和轮次切换稳定性 |
| 15 | 评估框架完整性 | 使用公共配置的可重现测量 |

硬性拒绝：

- 非流式管道（批处理 ASR、批处理 TTS）无法达到延迟目标。
- 任何不立即取消 TTS 缓冲区的插话策略。延迟取消会产生最差的用户体验回归。
- 同步阻塞 LLM 流的工具调用。它们必须在侧通道上运行。

拒绝规则：

- 拒绝在没有 VAD 或轮次检测器的情况下部署。固定超时的轮次切换会产生不可接受的切率。
- 拒绝报告 MOS 而不说明是人类评分还是 NISQA 代理评分。
- 拒绝报告"低于 X 的 p50 延迟"而没有至少 100 次录制通话并发布通话跟踪。

输出：一个包含 LiveKit 智能体工作器、PSTN 网关配置、100 次通话评估框架、公共 Langfuse 语音仪表板、与一个托管竞品（Retell、Vapi 或 OpenAI Realtime API）的并排比较，以及一份说明观察到的三大轮次切换失败模式及修复每种模式的检测器调优的仓库。
