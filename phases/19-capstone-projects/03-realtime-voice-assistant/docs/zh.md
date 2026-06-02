# Capstone 03 — 实时语音助手（ASR 到 LLM 到 TTS）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个体验对路的语音 agent，端到端延迟得在 800ms 以内，知道你什么时候说完了，能处理 barge-in（打断），还能在不卡顿音频的前提下调用工具。Retell、Vapi、LiveKit Agents、Pipecat 在 2026 年都达到了这条线。它们的架构形状是一样的：streaming ASR、turn-detector（轮次检测器）、streaming LLM、streaming TTS，全部用 WebRTC 串起来，每一跳都死抠延迟预算。把它搭出来，量 WER 和 MOS 与 false-cutoff（误截断）率，并在丢包条件下跑通。

**Type:** Capstone
**Languages:** Python（agent + pipeline 流水线），TypeScript（web 客户端）
**Prerequisites:** Phase 6（语音与音频）、Phase 7（transformer）、Phase 11（LLM 工程）、Phase 13（工具）、Phase 14（agent）、Phase 17（基础设施）
**Phases exercised:** P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 hours

## 问题（Problem）

语音是 2025-2026 年 AI UX 里推进最快的赛道。技术天花板每个季度都在掉。OpenAI Realtime API、Gemini 2.5 Live、Cartesia Sonic-2、ElevenLabs Flash v3、LiveKit Agents 1.0、Pipecat 0.0.70 都把 sub-800ms 的首音输出（first-audio-out）拉到了可达范围。门槛已经不只是延迟，而是交互手感：不打断用户，不被用户打断，能从句子中段的打断里恢复，对话进行中调工具不卡音频，撑得住抖动严重的移动网络。

靠串三个 REST 调用是做不到的。架构必须是端到端的流水线式 streaming。搭出来之后，失败模式才会暴露：一个为电话音频调过的 VAD 被背景电视声触发；一个 turn-detector 在等永远不会出现的标点；一个 TTS 缓冲了 400ms 才往外吐音频。Capstone 的目标，就是在负载下一个一个修掉这些问题，并发布一份延迟与质量报告。

## 概念（Concept）

流水线有五个 streaming 阶段：**音频输入**（来自浏览器或 PSTN 的 WebRTC）、**ASR**（Deepgram Nova-3 或 faster-whisper 的流式 partial transcript）、**turn detection 轮次检测**（VAD 加上一个读 partial transcript 判断是否完句的小型 turn-detector 模型）、**LLM**（一旦判定轮次结束就开始流式吐 token）、**TTS**（在第一个 LLM token 发出后约 200ms 内开始流式吐音频）。

三条横切关注点。**Barge-in**：用户在 agent 说话时开口，TTS 立刻取消，ASR 立刻接管。**Tool use（工具调用）**：对话中段的 function call（天气、日历）必须走旁路通道，不能卡住音频；如果延迟超过 300ms，agent 预先吐一个确认 token（"稍等……"）。**Backpressure（背压）**：丢包时挂住 partial transcript，VAD 抬高 speech-gate 阈值，agent 避免在一条还没确认的消息上叠话。

衡量标准是定量的。15 dB SNR 下 Hamming VAD 基准 WER 低于 8%。100 通测量通话首音输出 p50 低于 800ms。False-cutoff 率低于 3%。TTS MOS 高于 4.2。单台 g5.xlarge 上 50 路并发通话。这些数字就是交付物。

## 架构（Architecture）

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

## 技术栈（Stack）

- 传输：LiveKit Agents 1.0（WebRTC）外加 Twilio PSTN 网关；Pipecat 0.0.70 作备选框架
- ASR：Deepgram Nova-3（streaming，sub-300ms 首个 partial）或自建 faster-whisper Whisper-v3-turbo
- VAD：Silero VAD v5 加 LiveKit turn-detector（一个读 partial transcript 的小 transformer）
- LLM：OpenAI GPT-4o-realtime（紧耦合集成）、Gemini 2.5 Flash Live，或级联式 Claude Haiku 4.5（流式 completion，独立音频通路）
- TTS：Cartesia Sonic-2（首字节最低）、ElevenLabs Flash v3，或自建用开源 Orpheus
- 工具：FastMCP 旁路通道做天气/日历/预订；工具耗时 >300ms 时 agent 预先吐 filler（填充语）
- 可观测性：OpenTelemetry voice span，Langfuse voice trace 带音频回放
- 部署：单台 g5.xlarge（24GB VRAM）跑自建 Whisper + Orpheus；最低延迟方案用托管 API

## 动手实现（Build It）

1. **WebRTC 会话。** 起一个 LiveKit room，写一个浏览器客户端把麦克风音频流式发上去。服务端挂一个 agent worker 加入这个 room。

2. **ASR streaming。** 把 20ms PCM 帧喂给 Deepgram Nova-3（或 GPU 上的 faster-whisper）。订阅 partial 和 final transcript。记录每条 partial 的延迟。

3. **VAD 与 turn detector。** 在帧流上跑 Silero VAD v5。在 speech-end 事件上，对最新的 partial transcript 触发 LiveKit turn-detector。只有当 VAD 报告静音持续 500ms 且 turn-detector 完句得分 > 0.6 时才提交"轮次结束"。

4. **LLM 流。** 轮次结束后，用当前对话历史加上 final transcript 发起 LLM 调用。流式吐 token。第一个 token 出现时即把控制权交给 TTS。

5. **TTS 流。** Cartesia Sonic-2 流式回吐音频块。第一个块必须在第一个 LLM token 之后 200ms 内离开服务器。把音频块往 LiveKit room 里发；客户端通过 WebRTC jitter buffer 播放。

6. **Barge-in。** 当 TTS 正在播放时 VAD 检测到新的用户语音，立即取消 TTS 流，丢掉剩余的 LLM 输出，重新激活 ASR。发布一个 `tts_canceled` span。

7. **工具旁路通道。** 把天气和日历注册成 function-calling 工具。被调用时并发触发；如果 300ms 内没解析完，让 LLM 吐一个 "稍等，我查一下" 作为 filler；工具返回后再继续。

8. **评估流水线（Eval harness）。** 录 100 通通话。计算 WER（对照 held-out transcript）、false-cutoff 率（用户句子还没说完 TTS 被取消）、首音输出 p50、TTS MOS（人评或 NISQA）、抖动-丢包测试（丢 3% 包）。

9. **压测。** 用合成呼叫者在单台 g5.xlarge 上压 50 路并发。测量持续首音输出 p95。

## 用起来（Use It）

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

## 上线部署（Ship It）

`outputs/skill-voice-agent.md` 是交付物。给定一个领域（客服、排程、或 kiosk 自助机），它会用按指标调好的 ASR/VAD/LLM/TTS pipeline 起一个 LiveKit agent。评分细则：

| 权重 | 标准 | 怎么测 |
|:-:|---|---|
| 25 | 端到端延迟 | 100 通录制通话上首音输出 p50 低于 800ms |
| 20 | 轮次切换质量 | Hamming VAD 基准上 false-cutoff 率低于 3% |
| 20 | 工具调用正确性 | 对话中段工具调用返回正确数据，且不卡音频 |
| 20 | 丢包下的可靠性 | 注入 3% 丢包时 WER 与轮次切换的稳定性 |
| 15 | 评估流水线完备性 | 可复现的测量，配置公开 |
| **100** | | |

## 练习（Exercises）

1. 把 Deepgram Nova-3 换成 g5.xlarge 上的 faster-whisper v3 turbo。测延迟和 WER 差距。指出 CPU 与 GPU 选型在哪些点上有决定性影响。

2. 加一条打断仲裁策略：用户在工具调用过程中 barge-in，agent 该怎么办？比较三种策略（硬取消、跑完工具再停、把下一轮排队）。

3. 跑一次对抗性 turn-detector 测试：让用户在句子中段拉很长的停顿。调 VAD 静音阈值和 turn-detector 得分阈值，在不冲破 900ms 的前提下把 false-cutoff 压到最低。

4. 把同一个 agent 通过 Twilio 部到 PSTN。比较 PSTN 与 WebRTC 的首音输出。解释 jitter buffer 和 codec 差异。

5. 给非英语语言（日语、西班牙语）加 voice activity detection。测量 Silero VAD v5 的误触发率，并和按语言专门微调的版本对比。

## 关键术语（Key Terms）

| Term | 大家怎么说 | 实际是什么 |
|------|-----------------|------------------------|
| Turn detection | "End of utterance（话语结束）" | 一个分类器：给定 VAD 静音和 partial transcript，判定用户是否说完了 |
| Barge-in | "Interruption handling（打断处理）" | 在 VAD 检测到新用户语音时，把播放中的 TTS 取消掉 |
| First-audio-out | "Latency（延迟）" | 用户停下到第一个音频包离开服务器之间的时间 |
| VAD | "Speech gate（语音门）" | 把音频帧分类为语音/静音的模型；2026 年默认是 Silero VAD v5 |
| Jitter buffer | "Audio smoothing（音频平滑）" | 客户端侧的缓冲区，短暂挂住数据包以吸收网络抖动 |
| Filler | "Acknowledgment token（确认词）" | agent 在工具慢的时候吐出来的短语，避免冷场 |
| MOS | "Mean opinion score（平均意见分）" | 感知语音质量评分；NISQA 是自动化代理指标 |

## 延伸阅读（Further Reading）

- [LiveKit Agents 1.0](https://github.com/livekit/agents) — 参考的 WebRTC agent 框架
- [Pipecat](https://github.com/pipecat-ai/pipecat) — 备选的 Python 优先流式 agent 框架
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — 集成式语音模型参考
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) — streaming ASR 参考
- [Silero VAD v5](https://github.com/snakers4/silero-vad) — VAD 参考模型
- [Cartesia Sonic-2](https://docs.cartesia.ai) — 低延迟 TTS 参考
- [Retell AI architecture](https://docs.retellai.com) — 生产环境语音 agent 架构
- [Vapi.ai production stack](https://docs.vapi.ai) — 备选的生产参考
