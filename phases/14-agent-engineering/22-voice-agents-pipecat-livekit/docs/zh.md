# 语音 Agent：Pipecat 与 LiveKit

> 语音 agent 在 2026 年是一流的生产类别。Pipecat 提供基于 Python 帧的管道（VAD → STT → LLM → TTS → 传输）。LiveKit Agents 通过 WebRTC 将 AI 模型桥接到用户。生产延迟目标落在 450–600ms 端到端，用于优质堆栈。

**类型：** 学习
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 01（Agent Loop），第 14 阶段 · 12（工作流模式）
**时间：** ~60 分钟

## 学习目标

- 描述 Pipecat 的基于帧的管道：DOWNSTREAM（源→汇）和 UPSTREAM（控制）。
- 说出标准语音管道阶段以及 Pipecat 支持的传输。
- 解释 LiveKit Agents 的两个语音 agent 类（MultimodalAgent、VoicePipelineAgent）以及各自的适用场景。
- 总结 2026 年生产延迟预期以及它们如何驱动架构选择。

## 问题

语音 agent 不是带有 TTS 的文本循环。延迟预算残酷（~600ms），部分音频是默认的，轮次检测是一个模型，传输范围从电话 SIP 到 WebRTC。你要么构建基于帧的管道（Pipecat），要么依赖平台（LiveKit）。

## 概念

### Pipecat（pipecat-ai/pipecat）

- 基于 Python 帧的管道框架。
- `Frame` → `FrameProcessor` 链。
- 两个流向：
  - **DOWNSTREAM** — 源 → 汇（音频输入，TTS 输出）。
  - **UPSTREAM** — 反馈和控制（取消、指标、插话）。
- `PipelineTask` 管理生命周期，带有事件（`on_pipeline_started`、`on_pipeline_finished`、`on_idle_timeout`）和用于指标/跟踪/RTVI 的观察者。

典型管道：

```
VAD (Silero) → STT → LLM（上下文交替用户/助手）→ TTS → 传输
```

传输：Daily、LiveKit、SmallWebRTCTransport、FastAPI WebSocket、WhatsApp。

Pipecat Flows 添加结构化对话（状态机）。Pipecat Cloud 是托管运行时。

### LiveKit Agents（livekit/agents）

- 通过 WebRTC 将 AI 模型桥接到用户。
- 关键概念：`Agent`、`AgentSession`、`entrypoint`、`AgentServer`。
- 两个语音 agent 类：
  - **MultimodalAgent** — 通过 OpenAI Realtime 或等效的直接音频。
  - **VoicePipelineAgent** — STT → LLM → TTS 级联；提供文本级控制。
- 通过 transformer 模型进行语义轮次检测。
- 原生 MCP 集成。
- 通过 SIP 的电话。
- 通过 LiveKit Inference 无需 API 密钥的 50+ 模型；通过插件的 200+ 更多模型。

### 商业平台

Vapi（~450–600ms，优化优质堆栈）和 Retell（~600ms 端到端，跨越 180 次测试调用）构建在这些之上。当你想要没有 WebRTC 团队的托管语音堆栈时，选择平台。

### 此模式出错的地方

- **无插话处理。** 用户打断；agent 继续说话。需要 Pipecat 中的 UPSTREAM 取消帧，LiveKit 中的等效物。
- **忽略 STT 置信度。** 低置信度转录被当作真理喂给 LLM。基于置信度门控或请求确认。
- **TTS 句子中间截断。** 当管道在话语中间取消时，TTS 需要知道或切断音频。
- **忽略延迟预算。** 每个组件增加 50–200ms。在发布前加总你的链。

### 典型 2026 年延迟

- VAD：20–60ms
- STT 部分：100–250ms
- LLM 首个令牌：150–400ms
- TTS 首个音频：100–200ms
- 传输 RTT：30–80ms

端到端 450–600ms 是优质的。800–1200ms 是常见的。任何 > 1500ms 都感觉坏了。

## 构建

`code/main.py` 是一个基于帧的玩具管道：

- `Frame` 类型（音频、转录、文本、tts_audio、控制）。
- 带有 `process(frame)` 的 `Processor` 接口。
- 五阶段管道（VAD → STT → LLM → TTS → 传输）作为脚本化处理器。
- UPSTREAM 取消帧以演示插话。

运行：

```
python3 code/main.py
```

跟踪显示正常流和停止 TTS 中间话语的插话取消。

## 使用

- **Pipecat** 用于完全控制 —— 自定义处理器、Python 优先、可插拔提供者。
- **LiveKit Agents** 用于 WebRTC 优先部署和电话。
- **Vapi / Retell** 用于没有 WebRTC 团队的托管语音 agent。
- **OpenAI Realtime / Gemini Live** 用于直接音频输入/音频输出（MultimodalAgent）。

## 交付

`outputs/skill-voice-pipeline.md` 搭建 Pipecat 形状的语音管道，包含 VAD + STT + LLM + TTS + 传输以及插话处理。

## 练习

1. 向你的玩具管道添加指标观察者：每秒每阶段计数帧。延迟在哪里累积？
2. 实现置信度门控 STT：低于阈值，请求"你能重复一下吗？"
3. 添加语义轮次检测：简单规则 —— 如果转录以"?"结尾，轮次结束。
4. 阅读 Pipecat 的传输文档。将标准库传输替换为 SmallWebRTCTransport 配置（存根）。
5. 测量 OpenAI Realtime 与 STT+LLM+TTS 级联在相同查询上的延迟。文本级控制带来什么延迟成本？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Frame | "事件" | 管道中的类型化数据单元（音频、转录、文本、控制） |
| Processor | "管道阶段" | 带有 process(frame) 的处理程序 |
| DOWNSTREAM | "正向流" | 源到汇：音频输入，语音输出 |
| UPSTREAM | "反馈流" | 控制：取消、指标、插话 |
| VAD | "语音活动检测" | 检测用户何时在说话 |
| Semantic turn detection | "智能轮次结束" | 基于模型的用户完成决策 |
| MultimodalAgent | "直接音频 agent" | 音频输入，音频输出；中间无文本 |
| VoicePipelineAgent | "级联 agent" | STT + LLM + TTS；文本级控制 |

## 延伸阅读

- [Pipecat 文档](https://docs.pipecat.ai/getting-started/introduction) —— 基于帧的管道、处理器、传输
- [LiveKit Agents 文档](https://docs.livekit.io/agents/) —— WebRTC + 语音原语
- [Vapi](https://vapi.ai/) —— 托管语音平台
- [Retell AI](https://www.retellai.com/) —— 托管语音，延迟基准测试