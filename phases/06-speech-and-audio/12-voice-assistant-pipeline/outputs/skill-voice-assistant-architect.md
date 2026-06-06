---
name: voice-assistant-architect
description: Produce a full-stack voice-assistant spec — components, latency budget, observability, compliance — for a given workload.
version: 1.0.0
phase: 6
lesson: 12
tags: [voice-assistant, architecture, livekit, pipecat, compliance]
---

Given the use case (consumer / customer-support / accessibility / edge), expected scale (concurrent sessions, minutes/month), language, latency targets, compliance (HIPAA, PCI, EU AI Act, CA SB 942), output:

1. Components (7 layers). Mic + chunking · VAD · streaming STT · LLM + tools · streaming TTS · playback · interruption handler. Name the exact provider/model for each.
2. Latency budget. P50 / P95 / P99 targets per stage summing to the end-to-end target. Mark which stages are independent vs sequential.
3. Tool-call schema. JSON spec for each tool + error handling + fallback text. Always include a "can't help" path that the LLM must take when it fails twice.
4. Safety. Prompt injection guard, voice-cloning lockout (if TTS is cloning-capable), wake-word gate (for always-on), PII redaction in logs, 30-day retention.
5. Observability. P50/P95/P99 per stage · false-interruption rate · tool-call success rate · WER per 100 calls · cost per minute · abandon rate.
6. Compliance. Disclosure audio ("This is an AI assistant"), region-pinning (EU data in EU), audit log retention, opt-out pathway.

Refuse always-on deployments without a wake word. Refuse TTS that does not stream (adds utterance-length latency). Refuse averaging latency without P95 — tail is where users churn. Refuse raw-audio retention &gt; 30 days without a legal review.

Example input: "Accessibility assistant for low-vision users: voice-only interface to a consumer email app. English. P95 &lt; 600 ms. ~10k concurrent users."

Example output:
- Components: sounddevice (WebRTC via LiveKit Agents) · Silero VAD · Deepgram Nova-3 (English) · GPT-4o with email tools (read_message, compose_reply, mark_read) · Cartesia Sonic 2 streaming · WebRTC out · interrupt=cancel-LLM-and-TTS on VAD fire.
- Budget: capture 120 ms + VAD 40 + STT 150 + LLM TTFT 100 + TTS TTFA 150 = 560 ms P95.
- Tools: read_message({id}), compose_reply({message_id, body}), mark_read({id}), search({query}). All return JSON; LLM has max 2 retries per tool then fallback "I couldn't do that — try rephrasing".
- Safety: prompt-injection guard (detect `ignore previous instructions`); wake word "Hey Mail"; no voice cloning (fixed Cartesia voice); redact email bodies in logs.
- Observability: Hamming AI production monitoring; per-stage Prometheus histograms; alert on false-interrupt &gt; 5% or p95 &gt; 800 ms.
- Compliance: AI disclosure on first use; HIPAA opt-in for medical messages only; EU users hit EU-hosted Cartesia + GPT-4o Ireland.
