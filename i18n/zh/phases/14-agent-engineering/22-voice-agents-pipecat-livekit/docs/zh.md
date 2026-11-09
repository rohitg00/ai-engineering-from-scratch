# 语音代理:皮皮卡特和LiveKit

> 语音代理是2026年一流的生产类别.皮皮卡特为您提供了基于Python框架的管道 (VAD → STT → LLM → TTS →运输).LiveKit代理将AI模型与用户交互通过WebRTC.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**Time:** ~60 minutes

## 学习目标

- 描述皮佩卡的基于框架的管道:DOWNSTREAM (来源→沉没) 和UPSTREAM (控制).
- 列出了可信语音管道的阶段,以及 Pipecat 运输的支持.
- 解释LiveKit代理的两个语音代理类 (多模特代理,语音管线代理) 和每一个类的适合时间.
- 总结2026年生产延迟预期以及它们如何推动建筑选择.

## 问题

语音代理不是一个文字循环,TTS是插入的.延迟预算是残酷的 (~600ms),部分音频是默认的,转转检测是模型,运输范围从电话SIP到WebRTC.要么你构建一个基于框架的管道 (Pipecat) 或你依赖于一个平台 (LiveKit).

## 概念

### 皮皮卡特 (pipecat-ai/pipecat)

- 基于Python框架的管道框架.
- `Frame`其他`FrameProcessor`链接.
- 两条流程:
  - **DOWNSTREAM**源 →水槽 (音频进入,TTS出).
  - **UPSTREAM**反和控制 (取消,指标,入).
- `PipelineTask`管理生命周期与事件 (`on_pipeline_started`现在`on_pipeline_finished`现在`on_idle_timeout`) 和指标/追踪/RTVI观察员.

典型的管道:

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

运输:日报,LiveKit,SmallWebRTCTransport,FastAPI WebSocket,WhatsApp.

皮佩卡特流量添加结构化对话 (状态机).皮佩卡特云是管理运行时间.

### 现场服务代理 (livekit/agents)

- 通过WebRTC将人工智能模型传达给用户.
- 主要概念:`Agent`现在`AgentSession`现在`entrypoint`现在`AgentServer`现在,我们要去.
- 两个语音代理课程:
  - **MultimodalAgent**通过OpenAI实时或同等方式直接录音.
  - **VoicePipelineAgent** STT → LLM → TTS;提供文本级控制.
- 通过变压器模型进行语义转换检测.
- 产地MCP集成
- 通过SIP进行电话.
- 通过LiveKitInference使用没有API密钥的50多个模型;通过插件使用的200多个模型.

### 商业平台

在此基础上,Vapi (~450600ms在优化的高级堆上) 和Retell (~600ms在180次测试调用中端到端) 构建.当您想要一个没有WebRTC团队的管理语音堆时,选择一个平台.

### 在这个模式出现错误的地方

- **No barge-in handling.**用户打断,代理继续说话. 要求UPSTREAM在Pippecat中取消,相当于LiveKit.
- **STT confidence ignored.**低信心的转录像像像福音一样送给法师.
- **TTS mid-sentence cutoff.**电气管道在中发音中取消时,TTS需要知道或切断音频.
- **Latency budget ignored.**每个组件都增加了50200ms.

### 2026年典型的延迟

- 射频: 2060ms
- 部分STT: 100250ms
- 士师第一代币:150400ms
- 频率:100200ms
- 运输时间:3080ms

总体而言,在线观看的视频是非常简单的.

```figure
voice-pipeline
```

## 建立它

`code/main.py`是一个基于的玩具管道,具有:

- `Frame`类型 (音频,转录,文字,tts_audio,控制).
- `Processor`接口`process(frame)`现在,我们要去.
- 作为脚本处理器的五阶段管道 (VAD → STT → LLM → TTS → 运输).
- 为了证明入.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

痕迹显示正常流量, 轮取消了TTS中发射.

## 用它

- **Pipecat**对于完全控制的定制处理器,Python首,可插入的提供商.
- **LiveKit Agents**对于WebRTC首次部署和电话.
- **Vapi / Retell**对于没有WebRTC团队的托管语音代理人.
- **OpenAI Realtime / Gemini Live**直接录音/录音输出 (多动机代理).

## 运送它

`outputs/skill-voice-pipeline.md`配备一个像皮佩卡特的音频管道,配备VAD+STT+LLM+TTS+运输以及船操作.

## 运动

1. 加入一个测量观察器到玩具管道:每秒计算每个阶段的框架.
2. 执行安全门户的STT:在门以下,请问"您可以重复吗?"
3. 添加语义转变检测:简单规则如果转录以"?",转变结束.
4. 读取皮皮卡特的运输文件. 换取Stdlib运输的SmalWebRTCTransport配置 (stub).
5. 在同一查询中测量OpenAI实时与STT+LLM+TTS的尾数.文本级控制带来了什么延迟成本?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Frame | "Event" | Typed unit of data in the pipeline (audio, transcript, text, control) |
| Processor | "Pipeline stage" | Handler with process(frame) |
| DOWNSTREAM | "Forward flow" | Source to sink: audio in, speech out |
| UPSTREAM | "Feedback flow" | Control: cancel, metrics, barge-in |
| VAD | "Voice activity detection" | Detects when user is speaking |
| Semantic turn detection | "Smart end-of-turn" | Model-based decision that the user is done |
| MultimodalAgent | "Direct audio agent" | Audio in, audio out; no text in the middle |
| VoicePipelineAgent | "Cascade agent" | STT + LLM + TTS; text-level control |

## 进一步阅读

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction)基于的管道,加工器,运输
- [LiveKit Agents docs](https://docs.livekit.io/agents/) WebRTC + 语音原始
- [Vapi](https://vapi.ai/)管理的语音平台
- [Retell AI](https://www.retellai.com/)语音管理,延迟标记
