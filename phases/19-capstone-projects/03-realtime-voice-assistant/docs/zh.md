# 03 · 实时语音助手（从 ASR 到 LLM 到 TTS）

> 一个体验到位的语音智能体需要端到端延迟低于 800ms，能判断你何时说完，能处理插话打断，还能在调用工具时不卡顿。到 2026 年，Retell、Vapi、LiveKit Agents 和 Pipecat 均已达到这一水准。它们的架构形态相同：一个流式自动语音识别（ASR）、一个轮次检测器、一个流式大语言模型（LLM）和一个流式文字转语音（TTS），全部通过 WebRTC 连接，每一跳都有严格的延迟预算。动手构建一个，测量词错率（WER）、平均意见分（MOS）和误打断率，并在丢包条件下运行。

**类型：** 顶点项目
**语言：** Python（智能体与流水线）、TypeScript（Web 客户端）
**前置：** 第六阶段（语音与音频）、第七阶段（变换器）、第十一阶段（LLM 工程）、第十三阶段（工具）、第十四阶段（智能体）、第十七阶段（基础设施）
**涵盖阶段：** P6 · P7 · P11 · P13 · P14 · P17
**时长：** 30 小时

## 问题

语音是 2025-2026 年 AI 用户体验中发展最快的品类。技术天花板每个季度都在降低。OpenAI Realtime API、Gemini 2.5 Live、Cartesia Sonic-2、ElevenLabs Flash v3、LiveKit Agents 1.0 和 Pipecat 0.0.70 都将首次音频输出（first-audio-out）的延迟推到了 800ms 以内。衡量标准不仅仅是延迟，更是交互感受：不打断用户、不被用户打断、在句子中间被打断后能恢复、能在对话中途调用工具而不卡顿音频、能在抖动的移动网络下存活。

你不可能靠拼接三次 REST 调用来达到这个目标。架构必须是端到端的流水线式流式传输。动手构建它，各种故障模式就会显现：为电话音频调优的语音活动检测（VAD）被背景电视声误触发、轮次检测器等待永远不会出现的标点符号、TTS 在输出前缓冲 400ms。这个顶点项目的目标就是在负载下逐一解决这些问题，并发布一份延迟与质量报告。

## 概念

流水线包含五个流式阶段：**音频输入**（来自浏览器或 PSTN 的 WebRTC）、**ASR**（来自 Deepgram Nova-3 或 faster-whisper 的流式部分转写）、**轮次检测**（VAD 加上一个小型轮次检测模型，读取部分转写文本以寻找完成线索）、**LLM**（在判定轮次完成后立即开始流式输出 token）、**TTS**（在收到第一个 LLM token 后约 200ms 内开始流式输出音频）。

三个跨领域关注点。**插话打断（Barge-in）**：当用户在智能体说话时开始讲话，TTS 立即取消，ASR 立即接管。**工具调用**：对话中途的函数调用（天气、日历）必须在侧信道（side channel）上运行，不卡顿音频；如果延迟超过 300ms，智能体预先发出确认 token（如"稍等一下……"）。**背压（Backpressure）**：在丢包情况下，部分转写文本暂缓处理，VAD 提高语音门限，智能体避免在未确认消息之上继续说话。

衡量标准是量化的。在 15 dB 信噪比下，Hamming VAD 基准测试的 WER 低于 8%。100 次实测通话的首次音频输出 p50 低于 800ms。误打断率低于 3%。TTS 的 MOS 高于 4.2。单台 g5.xlarge 支持 50 路并发通话。这些数字就是交付成果。

## 架构

```
浏览器 / Twilio PSTN
        |
        v
   WebRTC / SIP 边缘
        |
        v
  LiveKit Agents 1.0（或 Pipecat 0.0.70）
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         轮次检测器        侧信道工具
(Deepgram         (Silero)        (LiveKit)        (天气、日历)
 Nova-3 /         每 20ms 语音    对部分转写文本
 Whisper-v3)      门限判定        计算完成度分数
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
   OpenTelemetry 语音链路追踪 -> Langfuse
```

## 技术栈

- 传输层：LiveKit Agents 1.0（WebRTC）加 Twilio PSTN 网关；Pipecat 0.0.70 作为备选框架
- ASR：Deepgram Nova-3（流式，首次部分转写低于 300ms）或自托管 faster-whisper Whisper-v3-turbo
- VAD：Silero VAD v5 加上 LiveKit 轮次检测器（读取部分转写文本的小型变换器模型）
- LLM：OpenAI GPT-4o-realtime 用于紧密集成，Gemini 2.5 Flash Live，或级联 Claude Haiku 4.5（流式补全，独立音频通路）
- TTS：Cartesia Sonic-2（首字节延迟最低）、ElevenLabs Flash v3，或自托管的开源 Orpheus
- 工具：FastMCP 侧信道用于天气/日历/预订；若工具耗时超过 300ms，智能体预先发出填充语
- 可观测性：OpenTelemetry 语音链路追踪跨度，Langfuse 语音追踪含音频回放
- 部署：单台 g5.xlarge（24GB 显存）用于自托管 Whisper + Orpheus；使用托管 API 以获得最低延迟

## 构建步骤

1. **WebRTC 会话。** 启动一个 LiveKit 房间和一个流式传输麦克风音频的 Web 客户端。在服务端附加一个加入房间的智能体工作进程。

2. **ASR 流式传输。** 将 20ms 的 PCM 音频帧送入 Deepgram Nova-3（或 GPU 上的 faster-whisper）。订阅部分转写和最终转写结果。记录每次部分转写的延迟。

3. **VAD 与轮次检测器。** 在音频帧流上运行 Silero VAD v5。在语音结束事件触发时，对最新的部分转写文本调用 LiveKit 轮次检测器。只有当 VAD 判定静音持续 500ms 且轮次检测器给出的完成度分数 > 0.6 时，才确认"轮次完成"。

4. **LLM 流。** 轮次确认完成后，用当前对话记录加上最终转写文本启动 LLM 调用。流式输出 token。在收到第一个 token 时，立即交给 TTS。

5. **TTS 流。** Cartesia Sonic-2 流式返回音频块。第一个块必须在收到第一个 LLM token 后 200ms 内离开服务端。将音频块发送到 LiveKit 房间；客户端通过 WebRTC 抖动缓冲播放。

6. **插话打断。** 当 VAD 在 TTS 播放期间检测到新的用户语音时，立即取消 TTS 流，丢弃剩余的 LLM 输出，并重新激活 ASR。发布一条 `tts_canceled` 链路追踪跨度。

7. **工具侧信道。** 将天气和日历注册为函数调用工具。被触发时，并发执行工具调用；如果在 300ms 内未返回结果，让 LLM 发出"稍等一下，我查查"作为填充语；工具返回后恢复对话。

8. **评估套件。** 录制 100 次通话。计算 WER（对照保留的转写文本）、误打断率（用户在句子中间被打断导致 TTS 取消）、首次音频输出 p50、TTS MOS（人工评分或 NISQA 自动评分），以及抖动丢包测试（丢弃 3% 的数据包）。

9. **负载测试。** 在单台 g5.xlarge 上用合成呼叫方驱动 50 路并发通话。测量持续的首次音频输出 p95。

## 使用示例

```
呼叫方: "明天东京天气怎么样"
[asr  ] 部分转写 @280ms: "明天东京"
[asr  ] 部分转写 @540ms: "明天东京天气怎么样"
[turn ] 完成度分数 0.82 @820ms；确认轮次
[llm  ] 首个 token @960ms
[tool ] weather.tokyo tomorrow -> 68/52 多云间晴 @1140ms
[tts  ] 首次音频输出 @1040ms: "东京明天多云间晴……"
轮次延迟: 用户停止说话到音频输出 1040ms
```

## 交付标准

`outputs/skill-voice-agent.md` 是交付物。给定一个领域（客服、排程或自助终端），它搭建一个 LiveKit 智能体，其 ASR/VAD/LLM/TTS 流水线经过调优以达到以下衡量标准。评分标准：

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 端到端延迟 | 100 次录制通话的首次音频输出 p50 低于 800ms |
| 20 | 轮次交互质量 | 在 Hamming VAD 基准测试中误打断率低于 3% |
| 20 | 工具调用正确性 | 对话中途的工具调用返回正确数据且不卡顿音频 |
| 20 | 丢包下的可靠性 | 注入 3% 丢包后 WER 和轮次交互稳定性 |
| 15 | 评估套件完整性 | 使用公开配置可复现的测量 |
| **100** | | |

## 练习

1. 将 Deepgram Nova-3 替换为在 g5.xlarge 上运行的 faster-whisper v3 turbo。测量延迟和 WER 差距。分析 CPU 与 GPU 决策的关键点。

2. 添加打断仲裁策略：当用户在工具调用期间插话时，智能体应如何处理？比较三种策略（硬取消、完成工具调用后停止、排队下一轮）。

3. 运行对抗性轮次检测测试：让用户在句子中间有长时间停顿。调整 VAD 静音阈值和轮次检测器分数阈值，以在不超过 900ms 的前提下实现最低误打断率。

4. 通过 Twilio 将同一智能体部署到 PSTN。比较 PSTN 与 WebRTC 的首次音频输出。解释抖动缓冲和编解码器差异。

5. 为非英语语言（日语、西班牙语）添加语音活动检测。测量 Silero VAD v5 的误触发率与特定语言微调版本的对比。

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|---------|---------|
| 轮次检测（Turn detection） | "话语结束" | 结合 VAD 静音和部分转写文本，判断用户是否说完的分类器 |
| 插话打断（Barge-in） | "打断处理" | 当 VAD 检测到新的用户语音时，取消正在播放的 TTS |
| 首次音频输出（First-audio-out） | "延迟" | 从用户停止说话到第一个音频包离开服务端的时间 |
| 语音活动检测（VAD） | "语音门限" | 将音频帧分类为语音或静音的模型；Silero VAD v5 是 2026 年的默认选择 |
| 抖动缓冲（Jitter buffer） | "音频平滑" | 客户端暂存数据包的缓冲区，用于吸收网络波动 |
| 填充语（Filler） | "确认 token" | 智能体在工具响应较慢时发出的短句，以避免静音 |
| 平均意见分（MOS） | "平均意见分" | 感知语音质量评分；NISQA 是自动化的替代方案 |

## 延伸阅读

- [LiveKit Agents 1.0](https://github.com/livekit/agents) — WebRTC 智能体框架参考
- [Pipecat](https://github.com/pipecat-ai/pipecat) — 备选的 Python 优先流式智能体框架
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — 集成语音模型参考
- [Deepgram Nova-3 文档](https://developers.deepgram.com/docs) — 流式 ASR 参考
- [Silero VAD v5](https://github.com/snakers4/silero-vad) — VAD 参考模型
- [Cartesia Sonic-2](https://docs.cartesia.ai) — 低延迟 TTS 参考
- [Retell AI 架构](https://docs.retellai.com) — 生产级语音智能体架构
- [Vapi.ai 生产栈](https://docs.vapi.ai) — 备选的生产级参考
