# 语音 Agent：Pipecat 与 LiveKit

> 语音 Agent 在 2026 年是一类一等生产产品。Pipecat 提供基于帧的流水线（VAD → STT → LLM → TTS → 传输）。LiveKit Agents 通过 WebRTC 将 AI 模型桥接到用户。生产级延迟目标为高端技术栈的端到端 450–600ms。

**类型：** 学习
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 01（Agent 循环）、阶段 14 · 12（工作流模式）
**时长：** 约 60 分钟

## 学习目标

- 描述 Pipecat 的基于帧的流水线：DOWNSTREAM（源→接收器）和 UPSTREAM（控制）。
- 说出规范语音流水线的阶段以及 Pipecat 支持的传输方式。
- 解释 LiveKit Agents 的两个语音 Agent 类别（MultimodalAgent、VoicePipelineAgent）及其适用场景。
- 总结 2026 年生产延迟预期以及它们如何驱动架构选择。

## 问题背景

语音 Agent 不是带 TTS 外接的文字循环。延迟预算极其苛刻（约 600ms），部分音频是默认行为，话轮检测是一个模型，传输方式从电话 SIP 到 WebRTC 不等。要么构建基于帧的流水线（Pipecat），要么依托平台（LiveKit）。

## 核心概念

### Pipecat（pipecat-ai/pipecat）

- Python 基于帧的流水线框架。
- `Frame` → `FrameProcessor` 链。
- 两个流方向：
  - **DOWNSTREAM**——源 → 接收器（音频输入，TTS 输出）。
  - **UPSTREAM**——反馈和控制（取消、指标、插话）。
- `PipelineTask` 通过事件管理生命周期（`on_pipeline_started`、`on_pipeline_finished`、`on_idle_timeout`）以及用于指标/追踪/RTVI 的观察器。

典型流水线：

```
VAD (Silero) → STT → LLM（上下文交替 user/assistant）→ TTS → 传输
```

传输方式：Daily、LiveKit、SmallWebRTCTransport、FastAPI WebSocket、WhatsApp。

Pipecat Flows 添加了结构化对话（状态机）。Pipecat Cloud 是托管运行时。

### LiveKit Agents（livekit/agents）

- 通过 WebRTC 将 AI 模型桥接到用户。
- 关键概念：`Agent`、`AgentSession`、`entrypoint`、`AgentServer`。
- 两个语音 Agent 类别：
  - **MultimodalAgent**——通过 OpenAI Realtime 或同类产品直接音频输入输出。
  - **VoicePipelineAgent**——STT → LLM → TTS 级联；提供文本级控制。
- 通过 Transformer 模型进行语义话轮检测。
- 原生 MCP 集成。
- 通过 SIP 支持电话。
- 通过 LiveKit Inference 支持 50+ 模型且无需 API 密钥；通过插件支持 200+ 更多模型。

### 商业平台

Vapi（优化高端技术栈约 450–600ms）和 Retell（180 次测试调用端到端约 600ms）构建在这些基础之上。当你想要托管语音技术栈且无需 WebRTC 团队时，请选择平台。

### 这种模式哪里会出错

- **无插话处理。** 用户打断；Agent 继续说话。需要在 Pipecat 中使用 UPSTREAM 取消帧，在 LiveKit 中使用同等机制。
- **忽略 STT 置信度。** 低置信度转录本被当作绝对真理喂给 LLM。请基于置信度设置门控或请求确认。
- **TTS 句中切断。** 当流水线在话语中途取消时，TTS 需要知道或切断音频。
- **忽略延迟预算。** 每个组件增加 50–200ms。在交付前汇总你的链式延迟。

### 2026 年典型延迟

- VAD：20–60ms
- STT 部分结果：100–250ms
- LLM 首个 token：150–400ms
- TTS 首个音频：100–200ms
- 传输 RTT：30–80ms

端到端 450–600ms 是高端产品。800–1200ms 是常见水平。超过 1500ms 会感到不可用。

## 构建它

`code/main.py` 是一个基于帧的玩具流水线：

- `Frame` 类型（音频、转录本、文本、tts_audio、控制）。
- 带 `process(frame)` 的 `Processor` 接口。
- 一个五阶段流水线（VAD → STT → LLM → TTS → 传输）作为脚本化处理器。
- 一个 UPSTREAM 取消帧来演示插话。

运行它：

```
python3 code/main.py
```

输出：每个任务的成功率和轨迹效率，反映 OSWorld-Human 的方法。

## 使用它

- **Pipecat** 用于完全控制——自定义处理器、Python 优先、可插拔提供商。
- **LiveKit Agents** 用于 WebRTC 优先的部署和电话。
- **Vapi / Retell** 用于没有 WebRTC 团队的托管语音 Agent。
- **OpenAI Realtime / Gemini Live** 用于直接音频输入/音频输出（MultimodalAgent）。

## 部署它

`outputs/skill-voice-pipeline.md` 搭建一个带有 VAD + STT + LLM + TTS + 传输以及插话处理的 Pipecat 形语音流水线。

## 练习

1. 向玩具流水线添加一个指标观察器：每秒计算每个阶段的帧数。延迟在哪里累积？
2. 实现置信度门控的 STT：低于阈值时，请求"你能重复一下吗？"
3. 添加语义话轮检测：简单规则——如果转录本以"？"结尾，则结束话轮。
4. 阅读 Pipecat 的传输文档。将标准库传输替换为 SmallWebRTCTransport 配置（存根）。
5. 测量同一查询的 OpenAI Realtime 与 STT+LLM+TTS 级联。文本级控制带来什么延迟成本？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Frame | "事件" | 流水线中的类型化数据单元（音频、转录本、文本、控制） |
| Processor | "流水线阶段" | 带 process(frame) 的处理器 |
| DOWNSTREAM | "前向流" | 源到接收器：音频输入，语音输出 |
| UPSTREAM | "反馈流" | 控制：取消、指标、插话 |
| VAD | "语音活动检测" | 检测用户何时在说话 |
| Semantic turn detection | "智能话轮结束" | 基于模型的决策，判断用户是否完成 |
| MultimodalAgent | "直接音频 Agent" | 音频输入，音频输出；中间无文本 |
| VoicePipelineAgent | "级联 Agent" | STT + LLM + TTS；文本级控制 |

## 延伸阅读

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction)——基于帧的流水线、处理器、传输
- [LiveKit Agents docs](https://docs.livekit.io/agents/)——WebRTC + 语音原语
- [Vapi](https://vapi.ai/)——托管语音平台
- [Retell AI](https://www.retellai.com/)——托管语音，延迟基准测试
