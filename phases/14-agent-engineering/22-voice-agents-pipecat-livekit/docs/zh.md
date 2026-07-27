# 语音智能体：Pipecat 与 LiveKit

> 语音智能体是 2026 年的一流生产类别。Pipecat 提供了基于 Python 的帧式流水线（VAD → STT → LLM → TTS → 传输层）。LiveKit Agents 通过 WebRTC 将 AI 模型桥接到用户。生产级延迟目标为端到端 450–600ms（高端方案）。

**类型：** 学习
**语言：** Python（标准库）
**前置知识：** 阶段 14 · 01（智能体循环），阶段 14 · 12（工作流模式）
**用时：** ~60 分钟

## 学习目标

- 描述 Pipecat 的帧式流水线：DOWNSTREAM（源→接收端）和 UPSTREAM（控制）。
- 列举典型的语音流水线阶段以及 Pipecat 支持的传输层。
- 解释 LiveKit Agents 的两种语音智能体类（MultimodalAgent、VoicePipelineAgent）及其适用场景。
- 总结 2026 年生产环境延迟预期及其对架构选择的影响。

## 问题

语音智能体并非简单的文本循环加上 TTS。延迟预算十分严苛（约 600ms），部分音频是常态，话轮检测是一个模型，传输层涵盖从电话 SIP 到 WebRTC 的范围。你要么构建一个帧式流水线（Pipecat），要么依赖平台（LiveKit）。

## 概念

### Pipecat（pipecat-ai/pipecat）

- Python 帧式流水线框架。
- `Frame` → `FrameProcessor` 链。
- 两种流向：
  - **DOWNSTREAM** — 源 → 接收端（音频输入，TTS 输出）。
  - **UPSTREAM** — 反馈与控制（取消、指标、打断）。
- `PipelineTask` 通过事件（`on_pipeline_started`、`on_pipeline_finished`、`on_idle_timeout`）和观察者（用于指标、追踪、RTVI）管理生命周期。

典型流水线：

```
VAD（Silero）→ STT → LLM（上下文交替用户/助手）→ TTS → 传输层
```

传输层：Daily、LiveKit、SmallWebRTCTransport、FastAPI WebSocket、WhatsApp。

Pipecat Flows 增加了结构化对话（状态机）。Pipecat Cloud 是托管运行时。

### LiveKit Agents（livekit/agents）

- 通过 WebRTC 将 AI 模型桥接到用户。
- 核心概念：`Agent`、`AgentSession`、`entrypoint`、`AgentServer`。
- 两种语音智能体类：
  - **MultimodalAgent** — 通过 OpenAI Realtime 或等效方案直接处理音频。
  - **VoicePipelineAgent** — STT → LLM → TTS 级联；提供文本级别的控制。
- 基于 transformer 模型的语义话轮检测。
- 原生 MCP 集成。
- 通过 SIP 实现电话功能。
- 通过 LiveKit Inference 可获取 50+ 模型（无需 API 密钥）；通过插件还可获得 200+ 模型。

### 商业平台

Vapi（优化高端方案约 450–600ms）和 Retell（180 次测试调用中端到端约 600ms）构建在以上技术之上。当你需要托管语音方案但没有 WebRTC 团队时，选择平台。

### 此模式易出错的地方

- **无打断处理。** 用户打断时智能体仍继续说话。需要在 Pipecat 中使用 UPSTREAM 取消帧，或在 LiveKit 中使用等效方案。
- **忽略 STT 置信度。** 低置信度的转写文本被当作事实送入 LLM。应设置置信度阈值或请求确认。
- **TTS 句中截断。** 当流水线在语音中间取消时，TTS 需要感知到这一点或直接截断音频。
- **忽略延迟预算。** 每个组件增加 50–200ms。发布前请计算整条链路的延迟。

### 2026 年典型延迟

- VAD：20–60ms
- STT 部分结果：100–250ms
- LLM 首 token：150–400ms
- TTS 首段音频：100–200ms
- 传输层 RTT：30–80ms

端到端 450–600ms 属于高端水平。800–1200ms 较为常见。超过 1500ms 就会感觉明显卡顿。

## 动手构建

`code/main.py` 是一个基于帧的玩具流水线，包含：

- `Frame` 类型（音频、转写文本、文本、tts_audio、控制）。
- `Processor` 接口，包含 `process(frame)` 方法。
- 一个五阶段流水线（VAD → STT → LLM → TTS → 传输层），实现为脚本化处理器。
- 一个 UPSTREAM 取消帧，用于演示打断功能。

运行：

```
python3 code/main.py
```

跟踪输出展示了正常流程以及一次打断取消操作（在 TTS 说话中途停止）。

## 使用建议

- **Pipecat** — 需要完全控制时使用：自定义处理器、Python 优先、可插拔提供商。
- **LiveKit Agents** — 需要以 WebRTC 为首选部署方案及电话功能时使用。
- **Vapi / Retell** — 需要托管语音智能体但没有 WebRTC 团队时使用。
- **OpenAI Realtime / Gemini Live** — 需要直接音频输入/输出时使用（MultimodalAgent）。

## 交付

`outputs/skill-voice-pipeline.md` 提供了一个 Pipecat 风格的语音流水线脚手架，包含 VAD + STT + LLM + TTS + 传输层及打断处理。

## 练习

1. 为你的玩具流水线添加指标观察者：统计每秒每阶段处理的帧数。延迟积累在哪里？
2. 实现置信度门控的 STT：低于阈值时请求"能重复一遍吗？"
3. 添加语义话轮检测：简单规则——如果转写文本以"？"结尾，则话轮结束。
4. 阅读 Pipecat 的传输层文档。将标准库传输层替换为 SmallWebRTCTransport 配置（存根）。
5. 在同一查询上分别测量 OpenAI Realtime 与 STT+LLM+TTS 级联方案。文本级控制带来了多少延迟成本？

## 关键术语

| 术语 | 人们常说的 | 实际含义 |
|------|-----------|----------|
| Frame（帧） | "事件" | 流水线中带类型的数据单元（音频、转写文本、文本、控制） |
| Processor（处理器） | "流水线阶段" | 包含 process(frame) 的处理程序 |
| DOWNSTREAM（下游） | "正向流" | 从源到接收端：音频输入，语音输出 |
| UPSTREAM（上游） | "反馈流" | 控制：取消、指标、打断 |
| VAD | "语音活动检测" | 检测用户是否在说话 |
| 语义话轮检测 | "智能话轮结束判断" | 基于模型判断用户是否说完 |
| MultimodalAgent | "直接音频智能体" | 音频输入，音频输出；中间无文本环节 |
| VoicePipelineAgent | "级联智能体" | STT + LLM + TTS；文本级控制 |

## 延伸阅读

- [Pipecat 文档](https://docs.pipecat.ai/getting-started/introduction) — 帧式流水线、处理器、传输层
- [LiveKit Agents 文档](https://docs.livekit.io/agents/) — WebRTC + 语音原语
- [Vapi](https://vapi.ai/) — 托管语音平台
- [Retell AI](https://www.retellai.com/) — 托管语音，延迟基准测试
