# 顶点项目 03 —— 实时语音助手（ASR 到 LLM 到 TTS）

> 一个感觉对的语音智能体具有端到端延迟低于 800 毫秒，知道你何时停止说话，处理打断，并且可以在不卡顿的情况下调用工具。Retell、Vapi、LiveKit Agents 和 Pipecat 都在 2026 年达到了这个标准。它们以相同的形态实现：流式 ASR、轮次检测器、流式 LLM 和流式 TTS，全部通过 WebRTC 连接，在每个跳点都有激进的延迟预算。构建一个，测量 WER 和 MOS 以及错误切断率，并在丢包情况下运行它。

**类型：** 顶点项目
**语言：** Python（智能体 + 管道）、TypeScript（Web 客户端）
**先决条件：** Phase 6（语音和音频）、Phase 7（transformers）、Phase 11（LLM 工程）、Phase 13（工具）、Phase 14（智能体）、Phase 17（基础设施）
**涉及阶段：** P6 · P7 · P11 · P13 · P14 · P17
**时间：** 30 小时

## 问题

语音是 2025-2026 年发展最快的 AI 用户体验类别。技术天花板每季度都在下降。OpenAI Realtime API、Gemini 2.5 Live、Cartesia Sonic-2、ElevenLabs Flash v3、LiveKit Agents 1.0 和 Pipecat 0.0.70 都将首次音频输出低于 800 毫秒置于可及范围内。标准不仅仅是延迟。它是交互感觉：不切断用户、不被切断、从句子中间的打断中恢复、在对话中调用工具而不卡顿音频、在抖动移动网络中存活。

你无法通过拼接三个 REST 调用来达到那里。架构是端到端的流水线流式传输。构建它，失败模式就会变得可见：一个为电话音频调谐的 VAD 在背景电视上触发、一个等待永远不会出现的标点的轮次检测器、一个在发出前缓冲 400 毫秒的 TTS。顶点项目是逐一修复这些，在负载下，并发布延迟和质量报告。

## 概念

管道有五个流式阶段：**音频输入**（来自浏览器或 PSTN 的 WebRTC）、**ASR**（来自 Deepgram Nova-3 或 faster-whisper 的流式部分转录）、**轮次检测**（VAD 加上一个小型轮次检测器模型，读取部分转录以获取完成线索）、**LLM**（一旦判断轮次完成就立即流式传输 token）、**TTS**（在第一个 LLM token 后约 200 毫秒内流式传输音频输出）。

三个横切关注点。**打断**：当用户在智能体说话时开始说话，TTS 取消，ASR 立即接收。**工具使用**：对话中的函数调用（天气、日历）必须在不卡顿音频的情况下在侧通道上运行；如果延迟超过 300 毫秒，智能体预填充一个确认 token（"稍等..."）。**背压**：在丢包情况下，部分转录被保留，VAD 提高语音门阈值，智能体避免在未确认的消息上说话。

测量标准是定量的。在 15 dB SNR 的 Hamming VAD 基准上 WER 低于 8%。100 次测量呼叫的首次音频输出 p50 低于 800 毫秒。错误切断率低于 3%。TTS 的 MOS 高于 4.2。单个 g5.xlarge 上 50 个并发呼叫。这些数字是可交付成果。

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
  ASR              VAD v5         轮次检测器     侧通道
(Deepgram         (Silero)          (LiveKit)        工具
 Nova-3 /         语音门        部分上的完成分数    （天气、
 Whisper-v3)      每 20 毫秒                        日历）
   |                   |              |
   +--------+----------+--------------+
            v
        LLM（流式）
     GPT-4o-realtime / Gemini 2.5 Flash /
     级联 Claude Haiku 4.5
            |
            v
        TTS 流式
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     音频返回给呼叫者
            |
            v
   OpenTelemetry 语音跟踪 -> Langfuse
```

## 技术栈

- 传输：LiveKit Agents 1.0（WebRTC）加上 Twilio PSTN 网关；Pipecat 0.0.70 作为替代框架
- ASR：Deepgram Nova-3（流式，首次部分低于 300 毫秒）或自托管的 faster-whisper Whisper-v3-turbo
- VAD：Silero VAD v5 加上 LiveKit 轮次检测器（读取部分转录的小型 transformer）
- LLM：OpenAI GPT-4o-realtime 用于紧密集成，Gemini 2.5 Flash Live，或级联 Claude Haiku 4.5（流式完成，独立音频路径）
- TTS：Cartesia Sonic-2（最低首字节），ElevenLabs Flash v3，或自托管的开源 Orpheus
- 工具：用于天气/日历/预订的 FastMCP 侧通道；如果工具耗时 >300 毫秒，智能体预发出填充词
- 可观察性：OpenTelemetry 语音跨度，Langfuse 语音跟踪带音频回放
- 部署：单个 g5.xlarge（24GB VRAM）用于自托管 Whisper + Orpheus；托管 API 用于最低延迟

## 构建它

1. **WebRTC 会话。** 建立一个 LiveKit 房间和一个流式传输麦克风音频的 Web 客户端。在服务器上，附加一个加入房间的智能体工作器。

2. **ASR 流式。** 将 20 毫秒 PCM 帧馈送到 Deepgram Nova-3（或 GPU 上的 faster-whisper）。订阅部分和最终转录。记录每次部分延迟。

3. **VAD 和轮次检测器。** 在帧流上运行 Silero VAD v5。在语音结束事件上，针对最新部分转录触发 LiveKit 轮次检测器。仅在 VAD 表示静默 500 毫秒且轮次检测器评分完成 > 0.6 时才提交"轮次完成"。

4. **LLM 流式。** 轮次完成时，用正在进行的对话加上最终转录开始 LLM 调用。流式传输 token 输出。在第一个 token 时，移交给 TTS。

5. **TTS 流式。** Cartesia Sonic-2 流式传输音频块返回。第一个块必须在第一个 LLM token 后 200 毫秒内离开服务器。将块发送到 LiveKit 房间；客户端通过 WebRTC 抖动缓冲区播放。

6. **打断。** 当 VAD 在 TTS 播放时检测到新的用户语音，立即取消 TTS 流，丢弃剩余的 LLM 输出，并重新武装 ASR。发布 `tts_canceled` 跨度。

7. **工具侧通道。** 将天气和日历注册为函数调用工具。调用时，并发触发调用；如果在 300 毫秒内未解决，让 LLM 发出"稍等，让我查一下"作为填充词；工具返回后恢复。

8. **评估工具。** 记录 100 次呼叫。计算 WER（与保留转录对比）、错误切断率（TTS 在用户句子中间取消）、首次音频输出 p50、TTS MOS（人工或 NISQA）和抖动丢失测试（丢弃 3% 的数据包）。

9. **负载测试。** 在单个 g5.xlarge 上用合成呼叫者驱动 50 个并发呼叫。测量持续的首次音频输出 p95。

## 使用它

```
呼叫者："东京明天的天气怎么样"
[asr  ] 部分 @280 毫秒："what is the"
[asr  ] 部分 @540 毫秒："what is the weather"
[turn ] 完成分数 0.82 @820 毫秒；提交
[llm  ] 首个 token @960 毫秒
[tool ] weather.tokyo 明天 -> 68/52 局部多云 @1140 毫秒
[tts  ] 首次音频输出 @1040 毫秒："Tokyo tomorrow will be partly cloudy..."
轮次延迟：1040 毫秒 用户停止 -> 音频输出
```

## 交付它

`outputs/skill-voice-agent.md` 是可交付成果。给定一个领域（客户支持、调度或 kiosk），它建立一个 LiveKit 智能体，ASR/VAD/LLM/TTS 管道调整到测量标准。评分标准：

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 端到端延迟 | 100 次记录呼叫的首次音频输出 p50 低于 800 毫秒 |
| 20 | 轮次转换质量 | Hamming VAD 基准上的错误切断率低于 3% |
| 20 | 工具使用正确性 | 对话中调用工具返回正确数据而不卡顿音频 |
| 20 | 丢包下的可靠性 | 注入 3% 丢包时的 WER 和轮次转换稳定性 |
| 15 | 评估工具完整性 | 可复现的测量，带公开配置 |
| **100** | | |

## 练习

1. 在 g5.xlarge 上将 Deepgram Nova-3 替换为 faster-whisper v3 turbo。测量延迟和 WER 差距。识别 CPU 与 GPU 决策在何处重要。

2. 添加打断仲裁策略：当用户在工具调用期间打断时，智能体做什么？比较三种策略（硬取消、完成工具然后停止、排队下一轮次）。

3. 运行对抗性轮次检测器测试：给用户句子中间的长停顿。调整 VAD 静默阈值和轮次检测器评分阈值，以在不超过 900 毫秒的情况下实现最低错误切断。

4. 通过 Twilio 在 PSTN 上部署相同的智能体。比较 PSTN 首次音频输出与 WebRTC。解释抖动缓冲区和编解码器差异。

5. 为非英语语言（日语、西班牙语）添加语音活动检测。测量 Silero VAD v5 误触发率与语言特定微调对比。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 轮次检测 | "话语结束" | 给定 VAD 静默和部分转录，判断用户说完的分类器 |
| 打断 | "打断处理" | 当 VAD 检测到新的用户语音时，取消正在播放的 TTS |
| 首次音频输出 | "延迟" | 从用户停止说话到第一个音频数据包离开服务器的时间 |
| VAD | "语音门" | 将音频帧分类为语音与静默的模型；Silero VAD v5 是 2026 年默认 |
| 抖动缓冲区 | "音频平滑" | 客户端缓冲区，短暂保留数据包以吸收网络差异 |
| 填充词 | "确认 token" | 智能体在工具慢时发出的简短短语以避免静默 |
| MOS | "平均意见分数" | 感知语音质量评分；NISQA 是自动化代理 |

## 延伸阅读

- [LiveKit Agents 1.0](https://github.com/livekit/agents) —— 参考 WebRTC 智能体框架
- [Pipecat](https://github.com/pipecat-ai/pipecat) —— 替代 Python 优先流式智能体框架
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) —— 集成语音模型参考
- [Deepgram Nova-3 文档](https://developers.deepgram.com/docs) —— 流式 ASR 参考
- [Silero VAD v5](https://github.com/snakers4/silero-vad) —— VAD 参考模型
- [Cartesia Sonic-2](https://docs.cartesia.ai) —— 低延迟 TTS 参考
- [Retell AI 架构](https://docs.retellai.com) —— 生产语音智能体架构
- [Vapi.ai 生产栈](https://docs.vapi.ai) —— 替代生产参考
