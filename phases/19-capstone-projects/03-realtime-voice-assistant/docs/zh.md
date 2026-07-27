# 毕业项目 03 — 实时语音助手（ASR 到 LLM 到 TTS）

> 一款体验流畅的语音助手，其端到端延迟应低于 800ms，能准确判断用户何时停止说话，支持打断（barge-in），并能在不卡顿的情况下调用工具。Retell、Vapi、LiveKit Agents 和 Pipecat 在 2026 年均已达到这一标准。它们的架构如出一辙：流式 ASR、话轮检测器（turn-detector）、流式 LLM 和流式 TTS，全部通过 WebRTC 连接，每个环节都有严格的延迟预算。构建这样一个系统，测量其 WER（词错误率）、MOS（平均意见分）和误切断率（false-cutoff rate），并在丢包条件下运行测试。

**类型：** 毕业项目
**语言：** Python（智能体 + 流水线）、TypeScript（Web 客户端）
**前置阶段：** 阶段 6（语音与音频）、阶段 7（Transformers）、阶段 11（LLM 工程）、阶段 13（工具）、阶段 14（智能体）、阶段 17（基础设施）
**涉及阶段：** P6 · P7 · P11 · P13 · P14 · P17
**时间：** 30 小时

## 问题

语音已成为 2025-2026 年 AI 用户体验领域中发展最快的类别。技术门槛每个季度都在降低。OpenAI Realtime API、Gemini 2.5 Live、Cartesia Sonic-2、ElevenLabs Flash v3、LiveKit Agents 1.0 和 Pipecat 0.0.70 都已将首次音频输出（first-audio-out）控制在 800ms 以内。但衡量标准不仅仅是延迟，更重要的是交互感受：不打断用户、不被用户打断、从句子中间的中断中恢复、在对话中调用工具时不卡顿音频、在抖动的移动网络下稳定运行。

仅靠拼接三个 REST 调用无法达到这一目标。架构必须是端到端的流式流水线。构建这样一个系统后，各种故障模式便会显现：为电话音频调优的 VAD 在背景电视噪音下误触发、话轮检测器等待永远不会出现的标点符号、TTS 在输出前缓冲 400ms。本毕业项目的目标就是在负载下逐个修复这些问题，并发布一份延迟与质量报告。

## 概念

该流水线包含五个流式阶段：**音频输入**（来自浏览器或 PSTN 的 WebRTC）、**ASR**（来自 Deepgram Nova-3 或 faster-whisper 的流式部分转录结果）、**话轮检测**（VAD 加一个小型话轮检测模型，读取部分转录结果以判断是否结束）、**LLM**（一旦话轮被判定为完成，立即开始流式输出 token）、**TTS**（在收到第一个 LLM token 后的约 200ms 内开始流式输出音频）。

三个横切关注点。**打断（Barge-in）**：当用户在智能体说话时开始发言，TTS 应立即取消，ASR 立即接管。**工具使用**：对话中的函数调用（查询天气、日历）必须通过侧通道（side channel）运行，不卡顿音频；如果延迟超过 300ms，智能体应预填充一个确认 token（"请稍等……"）。**背压（Backpressure）**：在丢包条件下，暂存部分转录结果，VAD 提高语音门限阈值，智能体避免在未确认的消息上说话。

衡量标准是量化的。在 Hamming VAD 基准测试中，15 dB SNR 条件下 WER 低于 8%。100 次通话测量的首次音频输出 p50 低于 800ms。误切断率低于 3%。TTS 的 MOS 高于 4.2。单台 g5.xlarge 上支持 50 路并发通话。这些数字就是交付目标。

## 架构

```
浏览器 / Twilio PSTN
        |
        v
   WebRTC / SIP 边缘节点
        |
        v
  LiveKit Agents 1.0（或 Pipecat 0.0.70）
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         话轮检测器         侧通道工具
(Deepgram         (Silero)         (LiveKit)         (天气,
 Nova-3 /         speech-gate    完成度评分          日历)
 Whisper-v3)      每 20ms         基于部分转录
   |                   |              |
   +--------+----------+--------------+
            v
        LLM（流式）
     GPT-4o-realtime / Gemini 2.5 Flash /
     级联 Claude Haiku 4.5
            |
            v
        TTS 流式输出
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     音频返回给呼叫方
            |
            v
   OpenTelemetry 语音追踪 -> Langfuse
```

## 技术栈

- **传输层：** LiveKit Agents 1.0（WebRTC）加 Twilio PSTN 网关；Pipecat 0.0.70 作为备选框架
- **ASR：** Deepgram Nova-3（流式，首次部分转录低于 300ms）或自托管 faster-whisper Whisper-v3-turbo
- **VAD：** Silero VAD v5 加 LiveKit 话轮检测器（读取部分转录结果的小型 transformer）
- **LLM：** OpenAI GPT-4o-realtime（紧密集成）、Gemini 2.5 Flash Live、或级联 Claude Haiku 4.5（流式补全，独立音频路径）
- **TTS：** Cartesia Sonic-2（首字节延迟最低）、ElevenLabs Flash v3、或开源 Orpheus（自托管）
- **工具：** FastMCP 侧通道用于天气/日历/预订；工具耗时超过 300ms 时智能体预发填充语
- **可观测性：** OpenTelemetry 语音 span、Langfuse 语音追踪及音频回放
- **部署：** 单台 g5.xlarge（24GB VRAM）用于自托管 Whisper + Orpheus；托管 API 用于最低延迟

## 构建步骤

1. **WebRTC 会话。** 搭建一个 LiveKit 房间和一个流式传输麦克风音频的 Web 客户端。在服务端，附加一个加入该房间的智能体工作进程。

2. **ASR 流式处理。** 将 20ms PCM 帧输入 Deepgram Nova-3（或 GPU 上的 faster-whisper）。订阅部分和最终转录结果。记录每次部分转录的延迟。

3. **VAD 和话轮检测器。** 在帧流上运行 Silero VAD v5。在语音结束事件触发时，针对最新的部分转录结果调用 LiveKit 话轮检测器。仅当 VAD 检测到静默持续 500ms 且话轮检测器完成度评分高于 0.6 时，才判定"话轮完成"。

4. **LLM 流式处理。** 话轮完成时，携带当前对话历史和最终转录结果启动 LLM 调用。流式输出 token。在第一个 token 出现时，立即交给 TTS。

5. **TTS 流式输出。** Cartesia Sonic-2 流式返回音频块。第一个音频块必须在第一个 LLM token 后的 200ms 内离开服务器。将音频块发送到 LiveKit 房间；客户端通过 WebRTC 抖动缓冲区播放。

6. **打断（Barge-in）。** 当 VAD 在 TTS 播放期间检测到新的用户语音时，立即取消 TTS 流，丢弃剩余的 LLM 输出，并重新启用 ASR。发布一个 `tts_canceled` span。

7. **工具侧通道。** 将天气和日历注册为函数调用工具。调用时，并发执行工具调用；如果 300ms 内未返回结果，让 LLM 发出"请稍等，我来查一下"作为填充语；工具返回后继续。

8. **评估框架。** 录制 100 次通话。计算 WER（对照保留的转录文本）、误切断率（用户话说到一半时 TTS 被取消）、首次音频输出 p50、TTS MOS（人工或 NISQA 自动评分），以及抖动丢包测试（丢弃 3% 的数据包）。

9. **负载测试。** 使用模拟呼叫方在单台 g5.xlarge 上驱动 50 路并发通话。测量稳定的首次音频输出 p95。

## 使用示例

```
呼叫方: "what is the weather in tokyo tomorrow"
[asr  ] 部分转录 @280ms: "what is the"
[asr  ] 部分转录 @540ms: "what is the weather"
[话轮] 完成度评分 0.82 @820ms; 判定完成
[llm  ] 第一个 token @960ms
[工具] weather.tokyo tomorrow -> 68/52 局部多云 @1140ms
[tts  ] 首次音频输出 @1040ms: "Tokyo tomorrow will be partly cloudy..."
话轮延迟: 1040ms 从用户停止到音频输出
```

## 交付标准

`outputs/skill-voice-agent.md` 为交付物。针对某个领域（客服、日程安排或自助终端），搭建一个 LiveKit 智能体，其 ASR/VAD/LLM/TTS 流水线需调整至满足测量标准。评分标准如下：

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 端到端延迟 | 100 次录制通话的首次音频输出 p50 低于 800ms |
| 20 | 话轮切换质量 | Hamming VAD 基准测试中误切断率低于 3% |
| 20 | 工具使用正确性 | 对话中的工具调用返回正确数据且不卡顿音频 |
| 20 | 丢包下的可靠性 | 注入 3% 丢包时 WER 和话轮切换稳定性 |
| 15 | 评估框架完整性 | 可重现的测量结果，附带公开配置 |
| **100** | | |

## 练习题

1. 将 Deepgram Nova-3 替换为 g5.xlarge 上的 faster-whisper v3 turbo。测量延迟和 WER 差距。明确哪些场景下 CPU 与 GPU 的选择至关重要。

2. 添加一个中断仲裁策略：当用户在工具调用期间打断时，智能体应如何处理？比较三种策略（硬取消、完成工具后停止、排队等待下个话轮）。

3. 运行对抗性话轮检测器测试：让用户在句子中间出现长停顿。调优 VAD 静默阈值和话轮检测器评分阈值，在不突破 900ms 的前提下将误切断率降至最低。

4. 通过 Twilio 在 PSTN 上部署相同的智能体。比较 PSTN 与 WebRTC 的首次音频输出延迟。解释抖动缓冲区和编解码器的差异。

5. 为非英语语言（日语、西班牙语）添加语音活动检测。测量 Silero VAD v5 的误触发率与针对特定语言微调模型之间的差异。

## 关键术语

| 术语 | 通常说法 | 实际含义 |
|------|---------|---------|
| 话轮检测（Turn detection） | "话语结束" | 根据 VAD 静默和部分转录结果，判断用户是否已经说完的分类器 |
| 打断（Barge-in） | "中断处理" | 当 VAD 检测到新的用户语音时，在播放中取消 TTS |
| 首次音频输出（First-audio-out） | "延迟" | 从用户停止说话到第一个音频包离开服务器的时间 |
| VAD | "语音门控" | 将音频帧分类为语音或静默的模型；Silero VAD v5 是 2026 年的默认选择 |
| 抖动缓冲区（Jitter buffer） | "音频平滑" | 客户端侧短暂持有数据包以吸收网络波动的缓冲区 |
| 填充语（Filler） | "确认 token" | 智能体在工具响应较慢时发出的简短短语，避免静默 |
| MOS | "平均意见分" | 感知语音质量评分；NISQA 是自动化代理评测工具 |

## 延伸阅读

- [LiveKit Agents 1.0](https://github.com/livekit/agents) — 参考 WebRTC 智能体框架
- [Pipecat](https://github.com/pipecat-ai/pipecat) — 备选的 Python 优先流式智能体框架
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — 集成语音模型的参考文档
- [Deepgram Nova-3 文档](https://developers.deepgram.com/docs) — 流式 ASR 参考文档
- [Silero VAD v5](https://github.com/snakers4/silero-vad) — VAD 参考模型
- [Cartesia Sonic-2](https://docs.cartesia.ai) — 低延迟 TTS 参考文档
- [Retell AI 架构](https://docs.retellai.com) — 生产级语音智能体架构
- [Vapi.ai 生产级技术栈](https://docs.vapi.ai) — 备选生产级参考文档
