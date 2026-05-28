---
name: realtime-voice-pipeline
description: 目標 end-to-end latency に合わせて、transport、VAD、streaming STT、LLM、streaming TTS、orchestration を選ぶ。
version: 1.0.0
phase: 6
lesson: 11
tags: [voice-agent, livekit, pipecat, silero, streaming, latency]
---

ターゲット（latency P50/P95、language、channel、offline vs cloud、call volume）が与えられたら、次を出力してください。

1. Transport。WebRTC (LiveKit / Daily) · WebSocket · SIP trunking (Twilio / Telnyx)。jitter tolerance + use case に紐づく理由。
2. VAD + turn-taking。Silero VAD（open、99.5% TPR）· Cobra（commercial）· LiveKit turn-detector。threshold、min speech duration、silence hang-over。
3. Streaming STT。Parakeet TDT（最速の open）· Kyutai STT（flush trick 付き）· Deepgram Nova-3（API、~150 ms）· Whisper-streaming。理由。
4. LLM + streaming。TTS が始まる前に最初の20 tokens を固定する。model + streaming config + prompt injection 向け guardrails。
5. Streaming TTS。Kokoro-82M（~100 ms TTFA）· Orpheus · Cartesia Sonic · ElevenLabs Turbo。voice-pack または cloning guard（Lesson 8）。
6. Orchestration。LiveKit Agents · Pipecat · Vapi · Retell · custom Rust。team skills + scale に紐づく理由。
7. Observability。stage ごとの P50/P95/P99 histograms、false-positive interruption rate、drop-call rate、call samples の WER。

utterance 全体を buffer してから STT するデプロイは拒否してください。stream しない TTS は拒否してください。平均 latency による評価は拒否し、P95 を要求してください。100k minutes/month を超える用途で、build-your-own との cost-comparison なしに managed platform（Vapi / Retell）を使うことは拒否してください。

Example input: "Voice agent for car insurance quoting. &lt; 500 ms P95. English, US. 50k minutes/week. Compliance: HIPAA-adjacent (no PII in logs)."

Example output:
- Transport: LiveKit Agents + Twilio SIP. call-center scale で実績があり、HIPAA-mode opt-in がある。
- VAD: Silero VAD @ threshold 0.45, min speech 220 ms, silence hang-over 400 ms. LiveKit turn-detector overlay.
- STT: Deepgram Nova-3 English (~150 ms P95); on-prem audit が必要なら Parakeet-TDT にフォールバック。
- LLM: GPT-4o streaming via OpenAI realtime API; post-filter で prompt injection を防ぐ。最初の20 tokens を TTS に固定する。
- TTS: Cartesia Sonic 2 (~150 ms TTFA, voice cloning は使わない — predefined voice)。
- Orchestration: LiveKit Agents. 本番 observability は Hamming AI。
- Logs: 永続化前に regex + NER pass で CVV / SSN / DOB を除去する。30日保持。
