# 综合项目 03 — 实时语音助手（ASR 到 LLM 到 TTS）

> 一个感觉良好的语音智能体具有低于 800ms 的端到端延迟，知道你何时停止说话，能处理插话（barge-in），并且可以在不中断的情况下调用工具。Retell、Vapi、LiveKit Agents 和 Pipecat 在 2026 年都达到了这一标准。它们通过相同的形态实现：流式 ASR、轮次检测器、流式 LLM 和流式 TTS，全部通过 WebRTC 连接，每个跳点都有激进的延迟预算。构建一个，测量 WER、MOS 和错误截断率，并在丢包情况下运行它。

**类型：** 综合项目
**语言：** Python（智能体 + 管道）、TypeScript（Web 客户端）
**前置条件：** 第 6 阶段（语音和音频）、第 7 阶段（Transformer）、第 11 阶段（LLM 工程）、第 13 阶段（工具）、第 14 阶段（智能体）、第 17 阶段（基础设施）
**涉及阶段：** P6 · P7 · P11 · P13 · P14 · P17
**时间：** 30 小时

## 问题描述

语音是 2025-2026 年发展最快的 AI UX 类别。技术天花板每个季度都在下降。OpenAI Realtime API、Gemini 2.5 Live、Cartesia Sonic-2、ElevenLabs Flash v3、LiveKit Agents 1.0 和 Pipecat 0.0.70 都使亚 800ms 的首音频输出触手可及。标准不仅仅是延迟。而是交互感受：不截断用户、不被截断、从中途打断中恢复、在不中断音频的情况下在对话中调用工具、在抖动的移动网络中存活。

你不能通过拼接三个 REST 调用来达到这个目标。架构是端到端的流水线流式传输。构建它，失败模式就会显现：为电话音频调整的 VAD 在背景电视声中误触发，等待永远不会到来的标点的轮次检测器，在发出前缓冲 400ms 的 TTS。本综合项目的目标是在负载下逐个修复这些问题，并发布延迟和质量报告。

## 核心概念

管道有五个流式阶段：**音频输入**（来自浏览器或 PSTN 的 WebRTC）、**ASR**（来自 Deepgram Nova-3 或 faster-whisper 的流式部分转录）、**轮次检测**（VAD 加上一个小型轮次检测器模型，读取部分转录以寻找完成提示）、**LLM**（一旦判断轮次完成就流式传输 token）、**TTS**（在第一个 LLM token 约 200ms 内流式传输音频输出）。

三个跨领域关注点。**插话（Barge-in）**：当用户在智能体说话时开始说话，TTS 取消，ASR 立即接管。**工具使用**：对话中的 mid-conversation 函数调用（天气、日历）必须在侧通道上运行，而不中断音频；如果延迟超过 300ms，智能体预填充一个确认 token（"稍等..."）。**背压（Backpressure）**：在丢包情况下，部分转录被保持，VAD 提高语音门限阈值，智能体避免在未确认消息上说话。

测量标准是量化的。在 15 dB SNR 的 Hamming VAD 基准测试上，WER 低于 8%。在 100 次测量通话中，首音频输出 p50 低于 800ms。错误截断率低于 3%。TTS 的 MOS 高于 4.2。在单个 g5.xlarge 上 50 个并发通话。这些数字是可交付成果。

## 架构

```
浏览器 / Twilio PSTN
        |
        v
   WebRTC / SIP 边缘
        |
        v
  LiveKit Agents 1.0  （或 Pipecat 0.0.70）
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         轮次检测器        侧通道
(Deepgram         (Silero)           (LiveKit)        工具
 Nova-3 /         speech-gate    完成分数            （天气、
 Whisper-v3）     每 20ms        在部分结果上        日历）
   |                   |              |
   +--------+----------+--------------+
            v
        LLM（流式）
     GPT-4o-realtime / Gemini 2.5 Flash /
     级联的 Claude Haiku 4.5
            |
            v
        TTS 流式传输
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     音频返回给呼叫者
            |
            v
   OpenTelemetry 语音追踪 -> Langfuse
```

## 技术栈

- 传输：LiveKit Agents 1.0（WebRTC）加上 Twilio PSTN 网关；Pipecat 0.0.70 作为备选框架
- ASR：Deepgram Nova-3（流式，首个部分结果低于 300ms）或自托管的 faster-whisper Whisper-v3-turbo
- VAD：Silero VAD v5 加上 LiveKit 轮次检测器（读取部分转录的小型 Transformer）
- LLM：OpenAI GPT-4o-realtime（紧密集成）、Gemini 2.5 Flash Live，或级联的 Claude Haiku 4.5（流式完成，独立音频路径）
- TTS：Cartesia Sonic-2（最低首字节延迟）、ElevenLabs Flash v3，或用于自托管的开源 Orpheus
- 工具：FastMCP 侧通道，用于天气/日历/预订；如果工具耗时 >300ms，智能体预发填充词
- 可观测性：OpenTelemetry 语音 span、带音频回放的 Langfuse 语音追踪
- 部署：单个 g5.xlarge（24GB VRAM）用于自托管 Whisper + Orpheus；托管 API 用于最低延迟

## 构建步骤

1. **WebRTC 会话。** 搭建一个 LiveKit 房间和一个流式传输麦克风音频的 Web 客户端。在服务器上，附加一个加入房间的智能体 worker。

2. **ASR 流式传输。** 将 20ms PCM 帧送入 Deepgram Nova-3（或 GPU 上的 faster-whisper）。订阅部分的和最终的转录。记录每个部分结果的延迟。

3. **VAD 和轮次检测器。** 在帧流上运行 Silero VAD v5。在语音结束事件上，针对最新的部分转录触发 LiveKit 轮次检测器。仅当 VAD 报告静音 500ms 且轮次检测器完成分数 > 0.6 时，才提交"轮次完成"。

4. **LLM 流。** 轮次完成后，使用运行中的对话加上最终转录开始 LLM 调用。流式输出 token。在第一个 token 时，移交给 TTS。

5. **TTS 流。** Cartesia Sonic-2 将音频块流式传回。第一个块必须在第一个 LLM token 的 200ms 内离开服务器。将块发送到 LiveKit 房间；客户端通过 WebRTC 抖动缓冲区播放。

6. **插话。** 当 VAD 在 TTS 播放时检测到新的用户语音，立即取消 TTS 流，丢弃剩余的 LLM 输出，并重新武装 ASR。发布一个 `tts_canceled` span。

7. **工具侧通道。** 将天气和日历注册为函数调用工具。调用时，并发触发调用；如果 300ms 内未解决，让 LLM 发出"稍等，让我查一下"作为填充词；工具返回后恢复。

8. **评估框架。** 记录 100 次通话。计算 WER（对照留出的转录）、错误截断率（TTS 在用户说话中途被取消）、首音频输出 p50、TTS MOS（人工或 NISQA），以及抖动丢失测试（丢弃 3% 的数据包）。

9. **负载测试。** 在单个 g5.xlarge 上用合成呼叫者驱动 50 个并发通话。测量持续的首音频输出 p95。

## 使用示例

```
呼叫者："明天东京的天气怎么样"
[asr  ] 部分结果 @280ms："什么是"
[asr  ] 部分结果 @540ms："什么是天气"
[turn ] 完成分数 0.82 @820ms；提交
[llm  ] 第一个 token @960ms
[tool ] weather.tokyo tomorrow -> 68/52 局部多云 @1140ms
[tts  ] 首音频输出 @1040ms："明天东京将是局部多云..."
轮次延迟：1040ms 用户停止 -> 音频输出
```

## 交付成果

`outputs/skill-voice-agent.md` 是可交付成果。给定一个领域（客户支持、日程安排或信息亭），它搭建一个 LiveKit 智能体，其 ASR/VAD/LLM/TTS 管道调整到测量标准。评分标准：

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 端到端延迟 | 在 100 次记录通话中，p50 首音频输出低于 800ms |
| 20 | 轮次交接质量 | 在 Hamming VAD 基准测试上，错误截断率低于 3% |
| 20 | 工具使用正确性 | 对话中工具调用返回正确数据而不中断音频 |
| 20 | 丢包情况下的可靠性 | 注入 3% 丢包时的 WER 和轮次交接稳定性 |
| 15 | 评估框架完整性 | 具有公开配置的可重现测量 |
| **100** | | |

## 练习

1. 在 g5.xlarge 上将 Deepgram Nova-3 换为 faster-whisper v3 turbo。测量延迟和 WER 差距。确定 CPU 与 GPU 决策重要的地方。

2. 添加中断仲裁策略：当用户在工具调用期间插话时，智能体做什么？比较三种策略（硬取消、完成工具后停止、排队下一个轮次）。

3. 运行对抗性轮次检测器测试：给用户在句子中间长暂停。调整 VAD 静音阈值和轮次检测器分数阈值，以获得最低的错误截断率，而不超过 900ms。

4. 通过 Twilio 在 PSTN 上部署同一个智能体。比较 PSTN 首音频输出与 WebRTC。解释抖动缓冲区和编解码器差异。

5. 为非英语语言（日语、西班牙语）添加语音活动检测。测量 Silero VAD v5 误触发率与特定语言微调的对比。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 轮次检测 | "话语结束" | 给定 VAD 静音和部分转录，判断用户说完话的分类器 |
| 插话 | "中断处理" | 当 VAD 检测到新的用户语音时，取消播放中的 TTS |
| 首音频输出 | "延迟" | 从用户停止说话到第一个音频数据包离开服务器的时间 |
| VAD | "语音门" | 将音频帧分类为语音与静音的模型；Silero VAD v5 是 2026 年默认 |
| 抖动缓冲区 | "音频平滑" | 客户端缓冲区，短暂保存数据包以吸收网络方差 |
| 填充词 | "确认 token" | 智能体在工具缓慢时发出以避免静音的短句 |
| MOS | "平均意见得分" | 感知语音质量评级；NISQA 是自动化代理 |

## 延伸阅读

- [LiveKit Agents 1.0](https://github.com/livekit/agents) — 参考 WebRTC 智能体框架
- [Pipecat](https://github.com/pipecat-ai/pipecat) — 备选的 Python 优先流式智能体框架
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — 集成语音模型参考
- [Deepgram Nova-3 文档](https://developers.deepgram.com/docs) — 流式 ASR 参考
- [Silero VAD v5](https://github.com/snakers4/silero-vad) — VAD 参考模型
- [Cartesia Sonic-2](https://docs.cartesia.ai) — 低延迟 TTS 参考
- [Retell AI 架构](https://docs.retellai.com) — 生产级语音智能体架构
- [Vapi.ai 生产栈](https://docs.vapi.ai) — 备选生产参考
