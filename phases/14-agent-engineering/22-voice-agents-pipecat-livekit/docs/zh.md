# 语音 Agent：Pipecat 与 LiveKit

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 在 2026 年，语音 agent 已经成为一类一等公民的生产形态。Pipecat 给你一条 Python 的、基于 frame 的流水线（VAD → STT → LLM → TTS → transport）。LiveKit Agents 则负责把 AI 模型通过 WebRTC 桥接给用户。高端方案的端到端 latency（延迟）目标大约落在 450–600ms。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 描述 Pipecat 基于 frame 的流水线：DOWNSTREAM（source→sink）与 UPSTREAM（控制流）。
- 说出标准语音流水线的各个阶段，以及 Pipecat 支持哪些 transport。
- 解释 LiveKit Agents 的两个语音 agent 类（MultimodalAgent、VoicePipelineAgent），以及各自适合的场景。
- 总结 2026 年生产环境对 latency 的预期，以及它如何驱动架构选型。

## 问题（The Problem）

语音 agent 不是「文本 loop 外面套一层 TTS」。latency 预算极其紧张（约 600ms），partial audio（部分音频）才是常态，turn detection（轮次判定）本身就是一个模型，transport 从电话 SIP 到 WebRTC 不一而足。要么自己搭一条基于 frame 的流水线（Pipecat），要么靠平台（LiveKit）。

## 概念（The Concept）

### Pipecat (pipecat-ai/pipecat)

- 基于 frame 的 Python 流水线框架。
- `Frame` → `FrameProcessor` 链式处理。
- 两个流向：
  - **DOWNSTREAM** —— source → sink（音频进，TTS 出）。
  - **UPSTREAM** —— 反馈与控制（cancel、metrics、barge-in）。
- `PipelineTask` 用事件管理生命周期（`on_pipeline_started`、`on_pipeline_finished`、`on_idle_timeout`），并通过 observer 做 metrics / tracing / RTVI。

典型流水线：

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

Transport：Daily、LiveKit、SmallWebRTCTransport、FastAPI WebSocket、WhatsApp。

Pipecat Flows 在此之上加了结构化对话（状态机）。Pipecat Cloud 是托管运行时。

### LiveKit Agents (livekit/agents)

- 通过 WebRTC 把 AI 模型桥接给用户。
- 核心概念：`Agent`、`AgentSession`、`entrypoint`、`AgentServer`。
- 两个语音 agent 类：
  - **MultimodalAgent** —— 直连音频，走 OpenAI Realtime 或同类方案。
  - **VoicePipelineAgent** —— STT → LLM → TTS 级联，给你文本层面的控制。
- 用 transformer 模型做语义级 turn detection。
- 原生 MCP 集成。
- 通过 SIP 接电话。
- 通过 LiveKit Inference 提供 50+ 模型免 API key 接入；通过插件再接 200+。

### 商业化平台（Commercial platforms）

Vapi（在优化过的高端栈上 ~450–600ms）和 Retell（180 通测试电话端到端 ~600ms）都是搭在这些之上的。如果你想要一套托管的语音栈、又不想配一个 WebRTC 团队，就选平台。

### 这套模式翻车的地方（Where this pattern goes wrong）

- **没处理 barge-in。**用户打断了，agent 还在说。Pipecat 里需要 UPSTREAM 的 cancel frame，LiveKit 里有等价机制。
- **忽略 STT 置信度。**低置信度的转写直接塞给 LLM，被当成圣旨。要按置信度做 gate，或者请求用户确认。
- **TTS 中途被切。**流水线在话说一半时取消了，TTS 得知道这件事，或者直接切音频。
- **不算 latency 预算。**每个组件都会加 50–200ms。上线前先把整条链路加一遍。

### 2026 年的典型 latency

- VAD：20–60ms
- STT partial：100–250ms
- LLM 首 token：150–400ms
- TTS 首段音频：100–200ms
- Transport RTT：30–80ms

端到端 450–600ms 算高端水准。800–1200ms 是常见数字。超过 1500ms 就让人觉得「这玩意坏了」。

## 动手实现（Build It）

`code/main.py` 是一条基于 frame 的玩具流水线，包含：

- `Frame` 类型（audio、transcript、text、tts_audio、control）。
- `Processor` 接口，带 `process(frame)`。
- 五段式流水线（VAD → STT → LLM → TTS → transport），每段都是脚本化的 processor。
- 一个 UPSTREAM cancel frame，用来演示 barge-in。

跑起来：

```
python3 code/main.py
```

trace 会展示一次正常流程，以及一次 barge-in cancel —— TTS 在话说一半时被叫停。

## 用起来（Use It）

- **Pipecat**：要全套控制权时用 —— 自定义 processor、Python 优先、provider 可插拔。
- **LiveKit Agents**：以 WebRTC 为主、需要电话接入的部署用。
- **Vapi / Retell**：不想配 WebRTC 团队、要托管语音 agent 时用。
- **OpenAI Realtime / Gemini Live**：要直接音频进 / 音频出（MultimodalAgent）时用。

## 上线部署（Ship It）

`outputs/skill-voice-pipeline.md` 给出一个 Pipecat 形态的语音流水线脚手架：VAD + STT + LLM + TTS + transport，外加 barge-in 处理。

## 练习（Exercises）

1. 给玩具流水线加一个 metrics observer：统计每段每秒过的 frame 数。latency 累在哪一段？
2. 实现按置信度 gate 的 STT：低于阈值时反问 "could you repeat that?"。
3. 加一条语义级 turn detection：简单规则 —— 转写以 "?" 结尾就算一轮结束。
4. 读 Pipecat 的 transport 文档，把 stdlib transport 换成 SmallWebRTCTransport 的配置（stub 即可）。
5. 在同一个 query 上测一次 OpenAI Realtime vs STT+LLM+TTS 级联。文本层控制的 latency 代价有多大？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------|---------|
| Frame | "Event" | 流水线里的带类型数据单元（audio、transcript、text、control） |
| Processor | "Pipeline stage" | 带 process(frame) 的处理器 |
| DOWNSTREAM | "Forward flow" | source 到 sink：音频进、语音出 |
| UPSTREAM | "Feedback flow" | 控制流：cancel、metrics、barge-in |
| VAD | "Voice activity detection" | 检测用户是否在说话 |
| Semantic turn detection | "Smart end-of-turn" | 用模型判断用户是否说完了 |
| MultimodalAgent | "Direct audio agent" | 音频进、音频出，中间没有文本 |
| VoicePipelineAgent | "Cascade agent" | STT + LLM + TTS；提供文本层面的控制 |

## 延伸阅读（Further Reading）

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) —— 基于 frame 的流水线、processor、transport
- [LiveKit Agents docs](https://docs.livekit.io/agents/) —— WebRTC + 语音原语
- [Vapi](https://vapi.ai/) —— 托管语音平台
- [Retell AI](https://www.retellai.com/) —— 托管语音，附带 latency 基准
