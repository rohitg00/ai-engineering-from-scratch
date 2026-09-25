# 毕业项目 03 — 实时语音助手（ASR → LLM → TTS）

> 一个体验良好的语音代理，端到端延迟低于 800ms，知道你何时停止说话，能够处理插话（barge-in），并能在调用工具时不卡顿。Retell、Vapi、LiveKit Agents 和 Pipecat 在 2026 年都达到了这个标准。它们的实现方式相同：流式 ASR、话轮检测器、流式 LLM 和流式 TTS，全部通过 WebRTC 连接，并在每一跳上设置严格的延迟预算。构建一个，测量 WER、MOS 和误截断率，并在丢包情况下运行测试。

**Type:** 毕业项目
**Languages:** Python（代理 + 流水线）、TypeScript（Web 客户端）
**Prerequisites:** 阶段 6（语音与音频）、阶段 7（Transformer）、阶段 11（LLM 工程）、阶段 13（工具）、阶段 14（代理）、阶段 17（基础设施）
**Phases exercised:** P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 小时

## 问题

语音是 2025-2026 年发展最快的 AI 交互（UX）类别。技术天花板每个季度都在降低。OpenAI Realtime API、Gemini 2.5 Live、Cartesia Sonic-2、ElevenLabs Flash v3、LiveKit Agents 1.0 和 Pipecat 0.0.70 都让“首音频输出”低于 800ms 成为可能。标准不只是延迟，而是交互感：不打断用户、不被打断、能从句子中途的插话中恢复、在对话中调用工具时不阻塞音频、在不稳定的移动网络中保持可用。

你无法通过拼接三个 REST 调用来实现。架构必须是端到端的流式流水线。构建它之后，故障模式会显现出来：为电话音频调优的 VAD 被背景电视声误触发、话轮检测器等待永远不会到来的标点符号、TTS 在输出前缓冲了 400ms。这个毕业项目的目标是在负载下一次解决这些问题，并发布一份延迟与质量报告。

## 概念

流水线包含五个流式阶段：**音频输入**（来自浏览器或 PSTN 的 WebRTC）、**ASR**（来自 Deepgram Nova-3 或 faster-whisper 的流式部分转写）、**话轮检测**（VAD 加上一个小型话轮检测器模型，读取部分转写中的话轮完整线索）、**LLM**（一旦判定话轮完成即开始流式输出 token）、**TTS**（在第一个 LLM token 之后约 200ms 内流式输出音频）。

有三个横切关注点。**插话（Barge-in）**：当用户在代理说话时开始说话，TTS 立即取消，ASR 立即接管。**工具调用**：对话中调用的函数（天气、日历）必须在侧信道上运行，不阻塞音频；如果延迟超过 300ms，代理会预先生成确认语（“请稍等...”）。**背压**：在丢包情况下，部分转写被保持，VAD 提高语音门限，代理避免在未确认的消息之上说话。

衡量标准是定量的。在 15 dB SNR 的 Hamming VAD 基准上 WER 低于 8%。在 100 次测量通话中，“首音频输出” p50 低于 800ms。误截断率低于 3%。TTS 的 MOS 高于 4.2。在单个 g5.xlarge 上支持 50 路并发通话。这些数字就是交付成果。

## 架构

```
browser / Twilio PSTN
        |
        v
   WebRTC / SIP edge
        |
        v
  LiveKit Agents 1.0  (or Pipecat 0.0.70)
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         turn-detector     side-channel
(Deepgram         (Silero)          (LiveKit)        tools
 Nova-3 /         speech-gate    completion score    (weather,
 Whisper-v3)      per 20ms        on partials        calendar)
   |                   |              |
   +--------+----------+--------------+
            v
        LLM (streaming)
     GPT-4o-realtime / Gemini 2.5 Flash /
     cascaded Claude Haiku 4.5
            |
            v
        TTS streaming
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     audio back to caller
            |
            v
   OpenTelemetry voice traces -> Langfuse
```

## 技术栈

- 传输层：LiveKit Agents 1.0（WebRTC）加 Twilio PSTN 网关；Pipecat 0.0.70 作为备选框架
- ASR：Deepgram Nova-3（流式，首部分转写低于 300ms）或自托管的 faster-whisper Whisper-v3-turbo
- VAD：Silero VAD v5 加 LiveKit 话轮检测器（读取部分转写的小型 Transformer）
- LLM：OpenAI GPT-4o-realtime（深度集成）、Gemini 2.5 Flash Live，或级联的 Claude Haiku 4.5（流式补全，独立音频路径）
- TTS：Cartesia Sonic-2（最低首字节延迟）、ElevenLabs Flash v3，或开源 Orpheus 用于自托管
- 工具：FastMCP 侧信道用于天气/日历/预订；若工具耗时超过 300ms，代理预先发出填充语
- 可观测性：OpenTelemetry 语音 span，带音频回放的 Langfuse 语音 trace
- 部署：单个 g5.xlarge（24GB VRAM）用于自托管 Whisper + Orpheus；托管 API 用于最低延迟

```figure
ce-voice-latency
```

## 构建步骤

1. **WebRTC 会话。** 搭建一个 LiveKit 房间和一个流式传输麦克风音频的 Web 客户端。在服务器上，附加一个加入该房间的代理工作进程（agent worker）。

2. **ASR 流式处理。** 将 20ms PCM 帧送入 Deepgram Nova-3（或 GPU 上的 faster-whisper）。订阅部分转写和最终转写。记录每次部分转写的延迟。

3. **VAD 和话轮检测器。** 在帧流上运行 Silero VAD v5。在语音结束事件上，针对最新的部分转写触发 LiveKit 话轮检测器。只有当 VAD 判定静音持续 500ms 且话轮检测器的完成得分 > 0.6 时，才提交“话轮完成”。

4. **LLM 流。** 在话轮完成后，使用对话上下文加最终转写启动 LLM 调用。流式输出 token。在收到第一个 token 时，交由 TTS 处理。

5. **TTS 流。** Cartesia Sonic-2 流式返回音频块。第一个块必须在第一个 LLM token 之后 200ms 内离开服务器。将块发送到 LiveKit 房间；客户端通过 WebRTC 抖动缓冲区播放。

6. **插话（Barge-in）。** 当 VAD 在 TTS 播放期间检测到新的用户语音时，立即取消 TTS 流，丢弃剩余的 LLM 输出，并重新武装 ASR。发布一个 `tts_canceled` span。

7. **工具侧信道。** 将天气和日历注册为函数调用工具。被调用时，并发执行调用；如果 300ms 内未解析，让 LLM 输出“请稍等，我查一下”作为填充语；工具返回后继续。

8. **评估套件。** 录制 100 次通话。计算 WER（对照留出的转写）、误截断率（用户句中时 TTS 被取消）、“首音频输出” p50、TTS MOS（人工或 NISQA），以及抖动-丢包测试（丢弃 3% 的数据包）。

9. **负载测试。** 在单个 g5.xlarge 上使用合成呼叫者驱动 50 路并发通话。测量持续的“首音频输出” p95。

## 使用

```
caller: "what is the weather in tokyo tomorrow"
[asr  ] partial @280ms: "what is the"
[asr  ] partial @540ms: "what is the weather"
[turn ] completion score 0.82 at @820ms; commit
[llm  ] first token @960ms
[tool ] weather.tokyo tomorrow -> 68/52 partly cloudy @1140ms
[tts  ] first audio-out @1040ms: "Tokyo tomorrow will be partly cloudy..."
turn latency: 1040ms user-stop -> audio-out
```

## 交付

`outputs/skill-voice-agent.md` 是交付成果。给定一个领域（客户支持、排程或自助终端），它搭建一个 LiveKit 代理，其 ASR/VAD/LLM/TTS 流水线经过调优以满足衡量标准。评分标准：

| 权重 | 标准 | 如何衡量 |
|:-:|---|---|
| 25 | 端到端延迟 | 100 次录制通话中“首音频输出” p50 低于 800ms |
| 20 | 话轮切换质量 | Hamming VAD 基准上误截断率低于 3% |
| 20 | 工具调用正确性 | 对话中的工具调用返回正确数据且不阻塞音频 |
| 20 | 丢包下的可靠性 | 注入 3% 丢包后的 WER 和话轮切换稳定性 |
| 15 | 评估套件完整性 | 使用公开配置的可复现测量 |
| **100** | | |

## 练习

1. 在 g5.xlarge 上将 Deepgram Nova-3 替换为 faster-whisper v3 turbo。测量延迟和 WER 差距。找出 CPU-vs-GPU 决策在哪些方面最重要。

2. 添加一个插话仲裁策略：用户在工具调用期间插话时，代理该怎么办？比较三种策略（硬取消、完成工具后停止、排队下一轮）。

3. 运行对抗性话轮检测器测试：让用户在句子中长时间停顿。调整 VAD 静音阈值和话轮检测器得分阈值，在不超过 900ms 的前提下实现最低误截断。

4. 通过 Twilio 将同一个代理部署到 PSTN。比较 PSTN 与 WebRTC 的“首音频输出”。解释抖动缓冲区和编解码器的差异。

5. 为非英语语言（日语、西班牙语）添加语音活动检测。测量 Silero VAD v5 相对于针对特定语言微调模型的误触发率。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 话轮检测 | “话语结束” | 分类器：给定 VAD 静音和部分转写，判断用户是否已说完 |
| 插话 | “打断处理” | 当 VAD 检测到新的用户语音时，在播放中途取消 TTS |
| 首音频输出 | “延迟” | 从用户停止说话到第一个音频包离开服务器的时间 |
| VAD | “语音门” | 将音频帧分类为语音或静音的模型；Silero VAD v5 是 2026 年的默认选择 |
| 抖动缓冲区 | “音频平滑” | 客户端缓冲区，短暂保存数据包以吸收网络波动 |
| 填充语 | “确认语” | 代理在工具响应慢时发出的短语，以避免沉默 |
| MOS | “平均意见得分” | 语音感知质量评分；NISQA 是自动化代理指标 |

## 延伸阅读

- [LiveKit Agents 1.0](https://github.com/livekit/agents) — 参考级 WebRTC 代理框架
- [Pipecat](https://github.com/pipecat-ai/pipecat) — 备选的 Python 优先流式代理框架
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — 集成语音模型参考
- [Deepgram Nova-3 文档](https://developers.deepgram.com/docs) — 流式 ASR 参考
- [Silero VAD v5](https://github.com/snakers4/silero-vad) — VAD 参考模型
- [Cartesia Sonic-2](https://docs.cartesia.ai) — 低延迟 TTS 参考
- [Retell AI 架构](https://docs.retellai.com) — 生产级语音代理架构
- [Vapi.ai 生产栈](https://docs.vapi.ai) — 备选生产参考