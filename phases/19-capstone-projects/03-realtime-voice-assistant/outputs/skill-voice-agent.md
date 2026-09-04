---
name: voice-agent
description: Build a real-time voice agent with sub-800ms first-audio-out, barge-in handling, and mid-conversation tool use.
version: 1.0.0
phase: 19
lesson: 03
tags: [capstone, voice, webrtc, livekit, pipecat, asr, tts, streaming]
---

Given a domain (customer support, scheduling, retail assistant), deploy a WebRTC voice agent that keeps end-to-end first-audio-out under 800ms while handling barge-in, tool calls, and packet loss.

Build plan:

1. Stand up a LiveKit Agents 1.0 room with a web client that streams microphone audio. Add a Twilio PSTN gateway for phone coverage.
2. Run streaming ASR (Deepgram Nova-3 hosted or faster-whisper Whisper-v3-turbo on a g5.xlarge). Subscribe to partial and final transcripts.
3. Run Silero VAD v5 on 20ms frames. On speech-end, score the latest partial with the LiveKit turn-detector; commit to turn-complete only when VAD silence >= 500ms and completion score >= 0.6.
4. Stream the LLM (GPT-4o-realtime, Gemini 2.5 Flash Live, or cascaded Claude Haiku 4.5). Hand the first token to TTS within 200ms.
5. Stream TTS (Cartesia Sonic-2 or ElevenLabs Flash v3). First audio chunk must leave the server within 200ms of first LLM token.
6. Barge-in: when VAD detects new user speech during SPEAKING or THINKING, cancel TTS, drop remaining LLM output, re-arm ASR. Publish a `tts_canceled` span.
7. Tool side-channel: run function calls concurrently; if latency > 300ms, emit an acknowledgment filler so the audio stream never stalls.
8. Record 100 calls. Measure WER against held-out transcripts, false-cutoff rate on the Hamming VAD benchmark, first-audio-out p50, NISQA MOS, and behavior under 3% packet drop.
9. Load-test 50 concurrent calls on a single g5.xlarge with a synthetic caller; report sustained first-audio-out p95.

Assessment rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | End-to-end latency | p50 first-audio-out under 800ms across 100 recorded calls |
| 20 | Turn-taking quality | False-cutoff rate under 3% on the Hamming VAD benchmark |
| 20 | Tool-use correctness | Mid-conversation tool calls return correct data without stalling audio |
| 20 | Reliability under packet loss | WER and turn-taking stability with 3% packet drop injected |
| 15 | Eval harness completeness | Reproducible measurements with public config |

Hard rejects:

- Non-streaming pipelines (batch ASR, batch TTS) cannot hit the latency target.
- Any barge-in policy that does not cancel the TTS buffer immediately. Delayed cancellation produces the worst user-experience regressions.
- Tool calls that synchronously block the LLM stream. They must run on a side channel.

Refusal rules:

- Refuse to deploy without a VAD or a turn-detector. Fixed-timeout turn-taking produces unacceptable cutoff rates.
- Refuse to report MOS without documenting whether it is human-rated or NISQA-proxied.
- Refuse to report "p50 latency under X" without at least 100 recorded calls and publishing the call traces.

Output: a repo containing the LiveKit agent worker, the PSTN gateway config, the 100-call eval harness, a public Langfuse voice dashboard, a side-by-side comparison with one hosted competitor (Retell, Vapi, or OpenAI Realtime API directly), and a write-up on the three largest turn-taking failures you observed and the detector tuning that fixed each.
