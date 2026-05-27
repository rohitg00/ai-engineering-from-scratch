---
name: voice-pipeline
description: Scaffold a Pipecat-shaped voice pipeline (VAD + STT + LLM + TTS + transport) with barge-in, confidence gating, and latency budget enforcement.
version: 1.0.0
phase: 14
lesson: 22
tags: [voice, pipecat, livekit, webrtc, latency]
---

Given a voice product spec (language, transport, providers), scaffold a frame-based pipeline.

Produce:

1. `Frame` type with `kind`, `payload`, `direction` (downstream / upstream).
2. Processors: `VAD`, `STT`, `LLM`, `TTS`, `Transport`. Each with `process(frame)`.
3. `link()` helper chaining processors forward and backward.
4. Cancel frame handling: UPSTREAM path from transport to TTS to LLM to STT, dropping pending work at each stage.
5. Observers: per-stage latency metrics; emit an OTel span per frame crossing a processor (Lesson 23).
6. Confidence gate on STT: below threshold, emit a "please repeat" text frame instead of transcript.

Hard rejects:

- Pipeline without UPSTREAM handling. Barge-in is not optional for voice.
- LLM calls without streaming. First-token latency dominates; must be streamed.
- Confidence-blind STT. Feeding wrong transcripts to the LLM produces wrong replies.

Refusal rules:

- If end-to-end latency exceeds 1500ms on a cold run, refuse to ship. Optimize the chain or use a MultimodalAgent (LiveKit direct-audio).
- If the product is telephony-first and the pipeline has no SIP adapter, refuse. Route through LiveKit SIP or a platform (Vapi/Retell).
- If the product carries PII audio without encryption in transit, refuse.

Output: `frames.py`, `processors.py`, `pipeline.py`, `observers.py`, `README.md` explaining the latency budget, barge-in design, and transport choice. End with "what to read next" pointing to Lesson 23 (OTel), Lesson 24 (observability backends), or LiveKit docs for WebRTC specifics.
