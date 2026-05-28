---
name: voice-pipeline
description: barge-in、confidence gating、latency budget enforcementを備えたPipecat-shaped voice pipeline (VAD + STT + LLM + TTS + transport) をscaffoldする。
version: 1.0.0
phase: 14
lesson: 22
tags: [voice, pipecat, livekit, webrtc, latency]
---

voice product spec (language、transport、providers) を受け取り、frame-based pipelineをscaffoldする。

生成するもの:

1. `kind`、`payload`、`direction` (downstream / upstream) を持つ`Frame` type。
2. Processors: `VAD`、`STT`、`LLM`、`TTS`、`Transport`。それぞれ`process(frame)`を持つ。
3. processorをforward/backwardにchainする`link()` helper。
4. cancel frame handling: transportからTTS、LLM、STTへ戻るUPSTREAM pathを通じ、各stageでpending workをdropする。
5. Observers: stage別latency metrics。processorをframeが横切るたびにOTel spanをemitする (Lesson 23)。
6. STTのconfidence gate: threshold未満ではtranscriptの代わりに"please repeat" text frameをemitする。

Hard rejects:

- UPSTREAM handlingのないpipeline。voiceではbarge-inはoptionalではありません。
- streamingなしのLLM call。first-token latencyが支配的なので、streaming必須です。
- confidence-blindなSTT。誤ったtranscriptをLLMに渡すと、誤ったreplyが生成されます。

Refusal rules:

- cold runでend-to-end latencyが1500msを超える場合、shipを拒否する。chainを最適化するか、MultimodalAgent (LiveKit direct-audio) を使う。
- productがtelephony-firstでpipelineにSIP adapterがない場合は拒否する。LiveKit SIPまたはplatform (Vapi/Retell) 経由でrouteする。
- productがPII audioをtransport encryptionなしで扱う場合は拒否する。

Output: `frames.py`, `processors.py`, `pipeline.py`, `observers.py`, `README.md`。latency budget、barge-in design、transport choiceを説明する。最後に"what to read next"としてLesson 23 (OTel)、Lesson 24 (observability backends)、またはWebRTC specifics向けのLiveKit docsを示す。
