# 22 · 语音智能体：Pipecat 与 LiveKit

> 到 2026 年，语音智能体（voice agents）已成为一等的生产级品类。Pipecat 提供一条基于帧（frame）的 Python 流水线（VAD → STT → LLM → TTS → transport）。LiveKit Agents 通过 WebRTC 把 AI 模型与用户连接起来。在高端技术栈上，生产环境端到端延迟目标落在 450–600ms。

**类型：** 学习
**语言：** Python（标准库）
**前置：** 阶段 14 · 01（智能体循环）、阶段 14 · 12（工作流模式）
**时长：** 约 60 分钟

## 学习目标

- 描述 Pipecat 基于帧的流水线：DOWNSTREAM（源→汇）与 UPSTREAM（控制）。
- 说出语音流水线的标准阶段，以及 Pipecat 支持哪些传输层（transport）。
- 解释 LiveKit Agents 的两类语音智能体（MultimodalAgent、VoicePipelineAgent）及各自的适用场景。
- 总结 2026 年生产环境的延迟预期，以及它如何驱动架构选型。

## 问题所在

语音智能体并不是在文本循环上外挂一层 TTS。延迟预算极为苛刻（约 600ms），部分音频（partial audio）是常态，轮次检测（turn detection）本身是一个模型，而传输层涵盖从电话 SIP 到 WebRTC 的各种形态。要么你自己搭一条基于帧的流水线（Pipecat），要么你依托某个平台（LiveKit）。

## 核心概念

### Pipecat（pipecat-ai/pipecat）

- 基于帧的 Python 流水线框架。
- `Frame` → `FrameProcessor` 链式处理。
- 两个流向：
  - **DOWNSTREAM** —— 源 → 汇（音频进，TTS 出）。
  - **UPSTREAM** —— 反馈与控制（取消、指标、插话打断 barge-in）。
- `PipelineTask` 通过事件（`on_pipeline_started`、`on_pipeline_finished`、`on_idle_timeout`）管理生命周期，并通过观察者（observer）支持指标/追踪/RTVI。

典型流水线：

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

传输层：Daily、LiveKit、SmallWebRTCTransport、FastAPI WebSocket、WhatsApp。

Pipecat Flows 增加了结构化对话（状态机）。Pipecat Cloud 是其托管运行时。

### LiveKit Agents（livekit/agents）

- 通过 WebRTC 把 AI 模型与用户连接起来。
- 关键概念：`Agent`、`AgentSession`、`entrypoint`、`AgentServer`。
- 两类语音智能体：
  - **MultimodalAgent** —— 经由 OpenAI Realtime 或同类服务的直连音频。
  - **VoicePipelineAgent** —— STT → LLM → TTS 级联（cascade）；提供文本层级的控制。
- 通过 transformer 模型实现语义轮次检测（semantic turn detection）。
- 原生 MCP 集成。
- 通过 SIP 支持电话。
- 借助 LiveKit Inference，可零 API key 接入 50+ 模型；通过插件再增加 200+ 模型。

### 商业平台

Vapi（在优化过的高端技术栈上约 450–600ms）和 Retell（180 次测试通话中端到端约 600ms）都构建在上述能力之上。如果你想要一套托管的语音技术栈、又不想组建一支 WebRTC 团队，就选平台。

### 这个模式容易出错的地方

- **没有处理插话打断（barge-in）。** 用户打断了，智能体却还在说。在 Pipecat 中需要 UPSTREAM 取消帧，LiveKit 中需有等价机制。
- **忽略 STT 置信度。** 把低置信度的转写当作金科玉律喂给 LLM。应按置信度设阈值门控，或请求确认。
- **TTS 在句中被截断。** 当流水线在话语中途取消时，TTS 需要知晓并切断音频。
- **忽视延迟预算。** 每个组件都会增加 50–200ms。上线前先把整条链路的延迟加总。

### 2026 年典型延迟

- VAD：20–60ms
- STT 部分结果：100–250ms
- LLM 首 token：150–400ms
- TTS 首段音频：100–200ms
- 传输 RTT：30–80ms

端到端 450–600ms 属于高端水平。800–1200ms 很常见。任何超过 1500ms 的都让人觉得坏掉了。

## 动手构建

`code/main.py` 是一条基于帧的玩具流水线，包含：

- `Frame` 类型（audio、transcript、text、tts_audio、control）。
- 带 `process(frame)` 的 `Processor` 接口。
- 由脚本化处理器构成的五阶段流水线（VAD → STT → LLM → TTS → transport）。
- 一个 UPSTREAM 取消帧，用于演示插话打断。

运行它：

```
python3 code/main.py
```

追踪输出展示了正常流程，以及一次在话语中途停止 TTS 的插话打断取消。

## 如何运用

- **Pipecat**：追求完全掌控时使用 —— 自定义处理器、Python 优先、可插拔的服务提供方。
- **LiveKit Agents**：面向 WebRTC 优先的部署与电话场景。
- **Vapi / Retell**：无需 WebRTC 团队即可托管语音智能体。
- **OpenAI Realtime / Gemini Live**：直连的音频进/音频出（MultimodalAgent）。

## 交付落地

`outputs/skill-voice-pipeline.md` 搭建了一条 Pipecat 形态的语音流水线脚手架，包含 VAD + STT + LLM + TTS + transport，外加插话打断处理。

## 练习

1. 给你的玩具流水线添加一个指标观察者：统计每个阶段每秒处理的帧数。延迟累积在哪里？
2. 实现按置信度门控的 STT：低于阈值时，请求用户「能再说一遍吗？」
3. 添加语义轮次检测：用一条简单规则 —— 如果转写以「?」结尾，即为轮次结束。
4. 阅读 Pipecat 的传输层文档。把标准库传输层换成 SmallWebRTCTransport 配置（桩实现）。
5. 在同一条查询上对比 OpenAI Realtime 与 STT+LLM+TTS 级联。文本层级的控制带来了多少延迟代价？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Frame | 「事件」 | 流水线中带类型的数据单元（audio、transcript、text、control） |
| Processor | 「流水线阶段」 | 带 process(frame) 的处理器 |
| DOWNSTREAM | 「正向流」 | 源到汇：音频进，语音出 |
| UPSTREAM | 「反馈流」 | 控制：取消、指标、插话打断 |
| VAD | 「语音活动检测」 | 检测用户何时在说话 |
| Semantic turn detection | 「智能轮次结束判定」 | 基于模型判断用户是否说完 |
| MultimodalAgent | 「直连音频智能体」 | 音频进，音频出；中间没有文本 |
| VoicePipelineAgent | 「级联智能体」 | STT + LLM + TTS；文本层级控制 |

## 延伸阅读

- [Pipecat 文档](https://docs.pipecat.ai/getting-started/introduction) —— 基于帧的流水线、处理器、传输层
- [LiveKit Agents 文档](https://docs.livekit.io/agents/) —— WebRTC + 语音原语
- [Vapi](https://vapi.ai/) —— 托管语音平台
- [Retell AI](https://www.retellai.com/) —— 托管语音，已做延迟基准测试
