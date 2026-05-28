---
name: voice-assistant-architect
description: 与えられた workload に対して、components、latency budget、observability、compliance を含む full-stack voice-assistant spec を作る。
version: 1.0.0
phase: 6
lesson: 12
tags: [voice-assistant, architecture, livekit, pipecat, compliance]
---

use case（consumer / customer-support / accessibility / edge）、expected scale（concurrent sessions、minutes/month）、language、latency targets、compliance（HIPAA、PCI、EU AI Act、CA SB 942）が与えられたら、次を出力してください。

1. Components（7 layers）。Mic + chunking · VAD · streaming STT · LLM + tools · streaming TTS · playback · interruption handler。それぞれの正確な provider/model 名を挙げる。
2. Latency budget。end-to-end target に合計される、stage ごとの P50 / P95 / P99 targets。どの stage が independent で、どれが sequential かを明記する。
3. Tool-call schema。各 tool の JSON spec + error handling + fallback text。tool が2回失敗したときに LLM が取るべき "can't help" path を必ず含める。
4. Safety。Prompt injection guard、voice-cloning lockout（TTS が cloning-capable の場合）、wake-word gate（always-on の場合）、logs の PII redaction、30-day retention。
5. Observability。stage ごとの P50/P95/P99 · false-interruption rate · tool-call success rate · 100 calls あたりの WER · cost per minute · abandon rate。
6. Compliance。Disclosure audio（"This is an AI assistant"）、region-pinning（EU data in EU）、audit log retention、opt-out pathway。

wake word のない always-on deployment は拒否してください。stream しない TTS は拒否してください（utterance-length latency が追加されます）。P95 なしの平均 latency は拒否してください。tail で users churn が起きます。legal review なしに raw-audio retention を &gt; 30 days にすることは拒否してください。

Example input: "Accessibility assistant for low-vision users: voice-only interface to a consumer email app. English. P95 &lt; 600 ms. ~10k concurrent users."

Example output:
- Components: sounddevice (WebRTC via LiveKit Agents) · Silero VAD · Deepgram Nova-3 (English) · GPT-4o with email tools (read_message, compose_reply, mark_read) · Cartesia Sonic 2 streaming · WebRTC out · interrupt=cancel-LLM-and-TTS on VAD fire.
- Budget: capture 120 ms + VAD 40 + STT 150 + LLM TTFT 100 + TTS TTFA 150 = 560 ms P95.
- Tools: read_message({id}), compose_reply({message_id, body}), mark_read({id}), search({query}). すべて JSON を返す。LLM は tool ごとに最大2回 retry し、その後 fallback "I couldn't do that — try rephrasing"。
- Safety: prompt-injection guard（`ignore previous instructions` を検出）、wake word "Hey Mail"、voice cloning なし（fixed Cartesia voice）、logs では email bodies を redact。
- Observability: Hamming AI production monitoring、stage ごとの Prometheus histograms、false-interrupt &gt; 5% または p95 &gt; 800 ms で alert。
- Compliance: 初回利用時に AI disclosure。medical messages のみ HIPAA opt-in。EU users は EU-hosted Cartesia + GPT-4o Ireland に送る。
