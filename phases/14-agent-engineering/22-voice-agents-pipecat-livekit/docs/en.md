# Voice Agents: Pipecat and LiveKit

> Voice agentは2026年のfirst-class production categoryです。PipecatはPythonのframe-based pipeline (VAD → STT → LLM → TTS → transport) を提供します。LiveKit AgentsはAI modelとuserをWebRTCでつなぎます。premium stackのproduction latency targetはend-to-endで450–600msです。

**種別:** 学習
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 01 (Agent Loop), Phase 14 · 12 (Workflow Patterns)
**所要時間:** 約60分

## Learning Objectives

- Pipecatのframe-based pipelineを説明する: DOWNSTREAM (source→sink) とUPSTREAM (control)。
- canonical voice pipeline stagesと、Pipecatがsupportするtransportを挙げる。
- LiveKit Agentsの2つのvoice agent class (MultimodalAgent、VoicePipelineAgent) と、それぞれが合う場面を説明する。
- 2026年のproduction latency expectationと、それがarchitecture choiceをどう動かすかを要約する。

## 問題

Voice agentは、text loopにTTSを後付けしたものではありません。latency budgetは厳しく (約600ms)、partial audioがdefaultで、turn detectionはmodelであり、transportはtelephony SIPからWebRTCまで広がります。frame-based pipeline (Pipecat) を構築するか、platform (LiveKit) に寄せるかのどちらかです。

## The Concept

### Pipecat (pipecat-ai/pipecat)

- Python frame-based pipeline framework。
- `Frame` → `FrameProcessor` chain。
- 2つのflow direction:
  - **DOWNSTREAM** — source → sink (audio in、TTS out)。
  - **UPSTREAM** — feedbackとcontrol (cancellation、metrics、barge-in)。
- `PipelineTask`はevents (`on_pipeline_started`, `on_pipeline_finished`, `on_idle_timeout`) とmetrics/tracing/RTVI向けobserverでlifecycleを管理します。

Typical pipeline:

```
VAD (Silero) → STT → LLM (context alternates user/assistant) → TTS → transport
```

Transports: Daily、LiveKit、SmallWebRTCTransport、FastAPI WebSocket、WhatsApp。

Pipecat Flowsはstructured conversations (state machines) を追加します。Pipecat Cloudはmanaged runtimeです。

### LiveKit Agents (livekit/agents)

- AI modelとuserをWebRTCでbridgeします。
- Key concepts: `Agent`、`AgentSession`、`entrypoint`、`AgentServer`。
- 2つのvoice agent class:
  - **MultimodalAgent** — OpenAI Realtimeまたは同等の仕組みによるdirect audio。
  - **VoicePipelineAgent** — STT → LLM → TTS cascade。text-level controlを提供する。
- transformer modelによるsemantic turn detection。
- Native MCP integration。
- SIPによるtelephony。
- LiveKit Inference経由でAPI keyなしの50+ models、plugin経由でさらに200+。

### Commercial platforms

Vapi (optimized premium stackで約450–600ms) とRetell (180 test callsで約600ms end-to-end) は、これらの上に構築されています。WebRTC teamなしでmanaged voice stackが欲しい場合はplatformを選びます。

### Where this pattern goes wrong

- **No barge-in handling。** userがinterruptしてもagentが話し続ける。PipecatではUPSTREAM cancel frames、LiveKitでは同等の仕組みが必要です。
- **STT confidence ignored。** low-confidence transcriptを真実のようにLLMへ渡す。confidenceでgateするか、confirmationを求めます。
- **TTS mid-sentence cutoff。** pipelineがutterance途中でcancelされたとき、TTSはそれを知るかaudioをcutする必要があります。
- **Latency budget ignored。** すべてのcomponentが50–200msを追加します。ship前にchain全体を合計してください。

### Typical 2026 latencies

- VAD: 20–60ms
- STT partial: 100–250ms
- LLM first token: 150–400ms
- TTS first audio: 100–200ms
- Transport RTT: 30–80ms

End-to-end 450–600msはpremiumです。800–1200msは一般的です。1500msを超えると壊れているように感じられます。

## 実装

`code/main.py`はframe-based toy pipelineです。

- `Frame` types (audio、transcript、text、tts_audio、control)。
- `process(frame)`を持つ`Processor` interface。
- scripted processorsとしての5-stage pipeline (VAD → STT → LLM → TTS → transport)。
- barge-inを示すUPSTREAM cancel frame。

実行:

```
python3 code/main.py
```

traceはnormal flowと、TTSをutterance途中で止めるbarge-in cancelを示します。

## Use It

- **Pipecat** はfull control向け。custom processors、Python-first、pluggable providers。
- **LiveKit Agents** はWebRTC-first deploymentとtelephony向け。
- **Vapi / Retell** はWebRTC teamなしのhosted voice agents向け。
- **OpenAI Realtime / Gemini Live** はdirect audio-in/audio-out (MultimodalAgent) 向け。

## Ship It

`outputs/skill-voice-pipeline.md`は、VAD + STT + LLM + TTS + transportにbarge-in handlingを加えたPipecat-shaped voice pipelineをscaffoldします。

## Exercises

1. toy pipelineにmetrics observerを追加する。stageごとに1秒あたりのframe数をcountする。latencyはどこに蓄積するか。
2. confidence-gated STTを実装する。threshold未満なら"could you repeat that?"をrequestする。
3. semantic turn detectionを追加する。simple rule: transcriptが"?"で終わるならturn終了。
4. Pipecatのtransport docsを読む。stdlib transportをSmallWebRTCTransport config (stub) に差し替える。
5. 同じqueryでOpenAI RealtimeとSTT+LLM+TTS cascadeを測定する。text-level controlにはどのlatency costがあるか。

## Key Terms

| Term | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| Frame | "Event" | pipeline内のtyped data unit (audio、transcript、text、control) |
| Processor | "Pipeline stage" | process(frame)を持つhandler |
| DOWNSTREAM | "Forward flow" | sourceからsinkへ。audio in、speech out |
| UPSTREAM | "Feedback flow" | control: cancel、metrics、barge-in |
| VAD | "Voice activity detection" | userが話しているタイミングをdetectする |
| Semantic turn detection | "Smart end-of-turn" | userが話し終えたかをmodel-basedに判定する |
| MultimodalAgent | "Direct audio agent" | audio in、audio out。途中にtextを挟まない |
| VoicePipelineAgent | "Cascade agent" | STT + LLM + TTS。text-level control |

## 参考文献

- [Pipecat docs](https://docs.pipecat.ai/getting-started/introduction) — frame-based pipeline, processors, transports
- [LiveKit Agents docs](https://docs.livekit.io/agents/) — WebRTC + voice primitives
- [Vapi](https://vapi.ai/) — managed voice platform
- [Retell AI](https://www.retellai.com/) — managed voice, latency-benchmarked
