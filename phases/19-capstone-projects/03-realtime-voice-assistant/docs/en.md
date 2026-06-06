# Capstone 03 — Real-Time Voice Assistant (ASR to LLM to TTS)

> A voice agent that feels right has end-to-end latency under 800ms, knows when you have stopped talking, handles barge-in, and can call a tool without stalling. Retell, Vapi, LiveKit Agents, and Pipecat all hit this bar in 2026. They do it with the same shape: a streaming ASR, a turn-detector, a streaming LLM, and a streaming TTS, all wired through WebRTC with aggressive latency budgets at every hop. Build one, measure WER and MOS and false-cutoff rate, and run it under packet loss.

**Type:** Capstone
**Languages:** Python (agent + pipeline), TypeScript (web client)
**Prerequisites:** Phase 6 (speech and audio), Phase 7 (transformers), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 17 (infrastructure)
**Phases exercised:** P6 · P7 · P11 · P13 · P14 · P17
**Time:** 30 hours

## Problem

Voice has been the fastest-moving AI UX category of 2025-2026. The technical ceiling dropped each quarter. OpenAI Realtime API, Gemini 2.5 Live, Cartesia Sonic-2, ElevenLabs Flash v3, LiveKit Agents 1.0, and Pipecat 0.0.70 all put sub-800ms first-audio-out within reach. The bar is not latency alone. It is the interaction feel: not cutting the user off, not getting cut off, recovering from a mid-sentence interruption, calling a tool mid-conversation without stalling the audio, surviving jittery mobile networks.

You cannot get there by stitching three REST calls. The architecture is pipelined streaming end to end. Build it and the failure modes become visible: a VAD tuned for phone audio firing on background TV, a turn-detector waiting for punctuation that never comes, a TTS that buffers 400ms before emitting. The capstone is to fix these one at a time under load and publish a latency-and-quality report.

## Concept

The pipeline has five streaming stages: **audio in** (WebRTC from browser or PSTN), **ASR** (streaming partial transcripts from Deepgram Nova-3 or faster-whisper), **turn detection** (VAD plus a small turn-detector model that reads partial transcripts for completion cues), **LLM** (streaming tokens as soon as the turn is judged complete), **TTS** (streaming audio out within ~200ms of the first LLM token).

Three cross-cutting concerns. **Barge-in**: when the user starts speaking while the agent is speaking, the TTS cancels and the ASR picks up immediately. **Tool use**: mid-conversation function calls (weather, calendar) must run on a side channel without stalling the audio; the agent pre-fills an acknowledgement token ("one second...") if latency exceeds 300ms. **Backpressure**: under packet loss, partial transcripts are held, VAD raises the speech-gate threshold, and the agent avoids speaking over an unacknowledged message.

The measurement bar is quantitative. WER under 8% on the Hamming VAD benchmark at 15 dB SNR. First-audio-out p50 under 800ms on 100 measured calls. False-cutoff rate under 3%. MOS above 4.2 on TTS. 50 concurrent calls on a single g5.xlarge. These numbers are the deliverable.

## Architecture

```
browser / Twilio PSTN
        |
        v
   WebRTC / SIP edge
        |
        v
  LiveKit Agents 1.0  (or Pipecat 0.0.70)
        |
   +----+--------------+--------------+-----------------+
   |                   |              |                 |
   v                   v              v                 v
  ASR              VAD v5         turn-detector     side-channel
(Deepgram         (Silero)          (LiveKit)        tools
 Nova-3 /         speech-gate    completion score    (weather,
 Whisper-v3)      per 20ms        on partials        calendar)
   |                   |              |
   +--------+----------+--------------+
            v
        LLM (streaming)
     GPT-4o-realtime / Gemini 2.5 Flash /
     cascaded Claude Haiku 4.5
            |
            v
        TTS streaming
     Cartesia Sonic-2 / ElevenLabs Flash v3
            |
            v
     audio back to caller
            |
            v
   OpenTelemetry voice traces -> Langfuse
```

## Stack

- Transport: LiveKit Agents 1.0 (WebRTC) plus Twilio PSTN gateway; Pipecat 0.0.70 as the alternate framework
- ASR: Deepgram Nova-3 (streaming, sub-300ms first partial) or faster-whisper Whisper-v3-turbo self-hosted
- VAD: Silero VAD v5 plus the LiveKit turn-detector (small transformer that reads partial transcripts)
- LLM: OpenAI GPT-4o-realtime for tight integration, Gemini 2.5 Flash Live, or cascaded Claude Haiku 4.5 (streaming completions, separate audio path)
- TTS: Cartesia Sonic-2 (lowest first-byte), ElevenLabs Flash v3, or open-source Orpheus for self-host
- Tools: FastMCP side-channel for weather/calendar/booking; agent pre-emits filler if tool takes >300ms
- Observability: OpenTelemetry voice spans, Langfuse voice traces with audio replay
- Deployment: single g5.xlarge (24GB VRAM) for self-hosted Whisper + Orpheus; hosted APIs for lowest latency

## Build It

1. **WebRTC session.** Stand up a LiveKit room and a web client that streams microphone audio. On the server, attach an agent worker that joins the room.

2. **ASR streaming.** Feed 20ms PCM frames to Deepgram Nova-3 (or faster-whisper on GPU). Subscribe to partial and final transcripts. Log per-partial latency.

3. **VAD and turn detector.** Run Silero VAD v5 on the frame stream. On speech-end event, fire the LiveKit turn-detector against the latest partial transcript. Only commit to "turn complete" when VAD says silence for 500ms and the turn-detector scores completion > 0.6.

4. **LLM stream.** On turn complete, start the LLM call with the running conversation plus the final transcript. Stream tokens out. At the first token, hand off to TTS.

5. **TTS stream.** Cartesia Sonic-2 streams audio chunks back. The first chunk must leave the server within 200ms of the first LLM token. Emit chunks to LiveKit room; client plays through WebRTC jitter buffer.

6. **Barge-in.** When VAD detects new user speech while TTS is playing, cancel the TTS stream immediately, drop the remaining LLM output, and re-arm the ASR. Publish a `tts_canceled` span.

7. **Tool side channel.** Register weather and calendar as function-calling tools. When invoked, fire the call concurrently; if it does not resolve within 300ms, have the LLM emit "one second, let me check" as a filler; resume once the tool returns.

8. **Eval harness.** Record 100 calls. Compute WER (against a held-out transcript), false-cutoff rate (TTS cancelled while user was mid-sentence), first-audio-out p50, TTS MOS (human or NISQA), and a jitter-loss test (drop 3% of packets).

9. **Load test.** Drive 50 concurrent calls on a single g5.xlarge with a synthetic caller. Measure sustained first-audio-out p95.

## Use It

```
caller: "what is the weather in tokyo tomorrow"
[asr  ] partial @280ms: "what is the"
[asr  ] partial @540ms: "what is the weather"
[turn ] completion score 0.82 at @820ms; commit
[llm  ] first token @960ms
[tool ] weather.tokyo tomorrow -> 68/52 partly cloudy @1140ms
[tts  ] first audio-out @1040ms: "Tokyo tomorrow will be partly cloudy..."
turn latency: 1040ms user-stop -> audio-out
```

## Ship It

`outputs/skill-voice-agent.md` is the deliverable. Given a domain (customer support, scheduling, or kiosk), it stands up a LiveKit agent with the ASR/VAD/LLM/TTS pipeline tuned to the measurement bar. Rubric:

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | End-to-end latency | p50 first-audio-out under 800ms across 100 recorded calls |
| 20 | Turn-taking quality | False-cutoff rate under 3% on the Hamming VAD benchmark |
| 20 | Tool-use correctness | Mid-conversation tool calls that return the right data without stalling audio |
| 20 | Reliability under packet loss | WER and turn-taking stability with 3% packet drop injected |
| 15 | Eval harness completeness | Reproducible measurements with public config |
| **100** | | |

## Exercises

1. Swap Deepgram Nova-3 for faster-whisper v3 turbo on a g5.xlarge. Measure the latency and WER gap. Identify where CPU-vs-GPU decisions matter.

2. Add an interruption-arbitration policy: what does the agent do when the user barges in during a tool call? Compare three policies (hard cancel, finish-tool-then-stop, queue next turn).

3. Run an adversarial turn-detector test: give the user long pauses mid-sentence. Tune the VAD silence threshold and the turn-detector score threshold for lowest false-cutoff without blowing past 900ms.

4. Deploy the same agent on PSTN via Twilio. Compare PSTN first-audio-out to WebRTC. Explain the jitter-buffer and codec differences.

5. Add voice activity detection for non-English languages (Japanese, Spanish). Measure the Silero VAD v5 false-trigger rate versus language-specific fine-tunes.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Turn detection | "End of utterance" | Classifier that, given VAD silence and a partial transcript, decides the user is done speaking |
| Barge-in | "Interruption handling" | Canceling TTS mid-playback when VAD detects new user speech |
| First-audio-out | "Latency" | Time from user stops speaking to the first audio packet leaving the server |
| VAD | "Speech gate" | Model classifying audio frames as speech vs silence; Silero VAD v5 is the 2026 default |
| Jitter buffer | "Audio smoothing" | Client-side buffer that holds packets briefly to absorb network variance |
| Filler | "Acknowledgment token" | Short phrase the agent emits to avoid silence when a tool is slow |
| MOS | "Mean opinion score" | Perceptual speech quality rating; NISQA is the automated proxy |

## Further Reading

- [LiveKit Agents 1.0](https://github.com/livekit/agents) — reference WebRTC agent framework
- [Pipecat](https://github.com/pipecat-ai/pipecat) — alternate Python-first streaming agent framework
- [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) — reference for integrated speech models
- [Deepgram Nova-3 documentation](https://developers.deepgram.com/docs) — streaming ASR reference
- [Silero VAD v5](https://github.com/snakers4/silero-vad) — VAD reference model
- [Cartesia Sonic-2](https://docs.cartesia.ai) — low-latency TTS reference
- [Retell AI architecture](https://docs.retellai.com) — production voice agent architecture
- [Vapi.ai production stack](https://docs.vapi.ai) — alternate production reference
