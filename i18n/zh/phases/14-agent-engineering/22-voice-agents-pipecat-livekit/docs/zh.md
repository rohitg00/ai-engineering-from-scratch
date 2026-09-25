# 语音智能体：Pipecat 与 LiveKit

> 语音智能体在 2026 年已是头等的生产级类别。Pipecat 提供基于帧的 Python 管线（VAD → STT → LLM → TTS → 传输层）。LiveKit Agents 通过 WebRTC 将 AI 模型与用户连接起来。高端技术栈的生产级端到端延迟目标为 450–600ms。

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 01 (Agent Loop)、Phase 14 · 12 (Workflow Patterns)
**Time:** ~60 minutes

## 学习目标

- 描述 Pipecat 基于帧的管线：DOWNSTREAM（source→sink）与 UPSTREAM（控制）。
- 说出经典的语音管线各阶段，以及 Pipecat 支持哪些传输方式。
- 解释 LiveKit Agents 的两个语音智能体类（MultimodalAgent、VoicePipelineAgent）及各自适用的场景。
- 总结 2026 年的生产级延迟预期，以及它们如何影响架构选择。

## 问题

语音智能体不是简单加上 TTS 的文本循环。延迟预算极为严苛（约 600ms），部分音频（partial audio）是常态，话轮检测本身就是一个模型，传输方式则涵盖电话 SIP 到 WebRTC。你要么构建基于帧的管线（Pipecat），要么依赖一个平台（LiveKit）。

## 核心概念

### Pipecat (pipecat-ai/pipecat)

- Python 基于帧的管线框架。
- `Frame` → `FrameProcessor` 链路。
- 两个流向：
  - **DOWNSTREAM** — source → sink（音频输入，TTS 输出）。
  - **UPSTREAM** — 反馈与控制（取消、指标、打断插入 barge-in）。
- `PipelineTask` 通过事件（`on_pipeline_started`、`on_pipeline_finished`、`on_idle_timeout`）管理生命周期，并提供用于指标/追踪/RTVI 的观察者。

典型管线：

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

传输方式：Daily、LiveKit、SmallWebRTCTransport、FastAPI WebSocket、WhatsApp。

Pipecat Flows 增加了结构化对话（状态机）。Pipecat Cloud 是托管运行时。

### LiveKit Agents (livekit/agents)

- 通过 WebRTC 将 AI 模型与用户连接起来。
- 核心概念：`Agent`、`AgentSession`、`entrypoint`、`AgentServer`。
- 两个语音智能体类：
  - **MultimodalAgent** — 通过 OpenAI Realtime 或同类产品直接处理音频。
  - **VoicePipelineAgent** — STT → LLM → TTS 级联；提供文本层面的控制。
- 通过 transformer 模型实现语义话轮检测。
- 原生 MCP 集成。
- 通过 SIP 支持电话。
- 通过 LiveKit Inference 提供 50 多个模型且无需 API 密钥；通过插件还可接入 200 多个。

### 商业平台

Vapi（优化后的高端技术栈约 450–600ms）和 Retell（180 次测试通话中端到端约 600ms）都构建在这些基础之上。当你想要一个无需 WebRTC 团队的托管语音技术栈时，选择平台。

### 这一模式的常见问题

- **没有处理打断插入（barge-in）。** 用户打断，智能体却继续说话。需要在 Pipecat 中使用 UPSTREAM 取消帧，在 LiveKit 中使用等价机制。
- **忽略 STT 置信度。** 低置信度的转写文本被当作可靠结果送入 LLM。应按置信度设门槛或请求确认。
- **TTS 在句子中途被截断。** 当管线在语句中途被取消时，TTS 需要得到通知或停止输出音频。
- **忽略延迟预算。** 每个组件都会增加 50–200ms。上线之前，先算清整条链路的总延迟。

### 2026 年典型延迟

- VAD：20–60ms
- STT 部分（partial）：100–250ms
- LLM 首个 token：150–400ms
- TTS 首段音频：100–200ms
- 传输 RTT：30–80ms

端到端 450–600ms 属于高端水平。800–1200ms 很常见。超过 1500ms 就会让人感觉出故障了。

```figure
voice-pipeline
```

## 动手构建

`code/main.py` 是一个基于帧的玩具管线，包含：

- `Frame` 类型（audio、transcript、text、tts_audio、control）。
- 带 `process(frame)` 的 `Processor` 接口。
- 一个五阶段管线（VAD → STT → LLM → TTS → transport），以脚本化的处理器实现。
- 一个 UPSTREAM 取消帧，用于演示打断插入（barge-in）。

运行方式：

```
python3 code/main.py
```

追踪日志展示了正常流程，以及一个在语句中途停止 TTS 的打断插入（barge-in）取消操作。

## 选用建议

- **Pipecat** — 需要完全控制：自定义处理器、Python 优先、提供方可插拔。
- **LiveKit Agents** — WebRTC 优先的部署及电话场景。
- **Vapi / Retell** — 无需 WebRTC 团队的托管语音智能体。
- **OpenAI Realtime / Gemini Live** — 直接的音频输入/输出（MultimodalAgent）。

## 上线交付

`outputs/skill-voice-pipeline.md` 搭建了一个 Pipecat 风格的语音管线，包含 VAD + STT + LLM + TTS + 传输层，并带有打断插入（barge-in）处理。

## 练习

1. 为你的玩具管线添加一个指标观察者：统计每个阶段每秒的帧数。延迟在哪里累积？
2. 实现按置信度设门槛的 STT：低于阈值时，请求“能再说一遍吗？”
3. 添加语义话轮检测：简单规则——如果转写文本以“？”结尾，则视为话轮结束。
4. 阅读 Pipecat 的传输层文档。将 stdlib 传输替换为 SmallWebRTCTransport 配置（stub）。
5. 在同一个查询上对比测量 OpenAI Realtime 与 STT+LLM+TTS 级联。文本层面的控制需要付出多少延迟代价？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|------------------------|
| Frame | “事件” | 管线中带类型的数据单元（audio、transcript、text、control） |
| Processor | “管线阶段” | 带 process(frame) 的处理器 |
| DOWNSTREAM | “正向流” | 从 source 到 sink：音频进，语音出 |
| UPSTREAM | “反馈流” | 控制：取消、指标、打断插入 |
| VAD | “语音活动检测” | 检测用户何时在说话 |
| 语义话轮检测 | “智能话轮结束” | 基于模型判断用户已经说完 |
| MultimodalAgent | “直接音频智能体” | 音频进，音频出；中间没有文本 |
| VoicePipelineAgent | “级联智能体” | STT + LLM + TTS；文本层面的控制 |

## 延伸阅读

- [Pipecat 文档](https://docs.pipecat.ai/getting-started/introduction) — 基于帧的管线、处理器、传输层
- [LiveKit Agents 文档](https://docs.livekit.io/agents/) — WebRTC 与语音原语
- [Vapi](https://vapi.ai/) — 托管语音平台
- [Retell AI](https://www.retellai.com/) — 托管语音，经延迟基准测试