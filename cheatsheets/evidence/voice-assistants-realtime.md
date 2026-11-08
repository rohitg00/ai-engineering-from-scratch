# Evidence: cheatsheets/voice-assistants-realtime.md

Abbreviations: L11 = phases/06-speech-and-audio/11-real-time-audio-processing, L12 = phases/06-speech-and-audio/12-voice-assistant-pipeline, L14 = phases/06-speech-and-audio/14-voice-activity-detection-turn-taking, L15 = phases/06-speech-and-audio/15-streaming-speech-to-speech-moshi-hibiki, A22 = phases/14-agent-engineering/22-voice-agents-pipecat-livekit, C03 = phases/19-capstone-projects/03-realtime-voice-assistant. d = docs/en.md, c = code/main.py, ts = code/ts.

## Cascaded voice pipeline (architecture, 8 nodes, 8 edges)
- Mic 16 kHz mono, 20 ms chunks: L12/d:14, L12/d:30
- VAD Silero speech gate: L12/d:31, C03/d:39-42
- Streaming STT, partial transcripts: L12/d:32, C03/d:19
- Turn detector, score above 0.6: C03/d:82
- LLM with tools, streams tokens: L12/d:33, C03/d:84
- Tool side channel, filler after 300ms: C03/d:21, C03/d:90
- Streaming TTS, first chunk within 200ms: C03/d:86
- Speaker, WebRTC jitter buffer: C03/d:86
- Edges mic to speaker: L12/d:26. Barge-in cancel from VAD to TTS: L12/d:36, C03/d:88

## Capstone scheduler, one turn (flow, 8)
1. IDLE to LISTENING on speech: C03/ts/src/orchestrator.ts:78-83
2. silenceRunMs += 20: C03/ts/src/orchestrator.ts:90-91
3. at 500 ms, turnCompletionScore(finalPartial): C03/ts/src/orchestrator.ts:92-93
4. score >= 0.6, WAITING, turnCompleteMs: C03/ts/src/orchestrator.ts:94-96
5. tool call fired, filler at 300 ms: C03/ts/src/orchestrator.ts:108-111, 123-125
6. tool returns at latencyMs 420, llmStartedAt + 140: C03/ts/src/orchestrator.ts:13, 127-130
7. ttsStartedAt + 180, first audio-out: C03/ts/src/orchestrator.ts:137, 143-146
8. barge-in in SPEAKING or THINKING, cancel TTS, re-arm ASR: C03/ts/src/orchestrator.ts:59-66, C03/c:136-141

## Latency budget per turn (defaults, 8)
- Mic to buffer 20 ms: L11/d:16
- VAD 10 ms: L11/d:17. Silero under 1 ms per frame: L11/d:34
- ASR (streaming) 150 ms: L11/d:18
- LLM (first token) 100 ms: L11/d:19
- TTS (first chunk) 100 ms: L11/d:20
- Render to speaker 20 ms: L11/d:21
- Total ~400 ms: L11/d:22. Above 500 ms feels robotic: L11/d:12
- First TTS audio within 800 ms on a laptop CPU: L12/d:22

## VAD and turn settings (defaults, 8)
- threshold 0.5, 0.3 sensitive, fewer first-word clips: L14/d:34
- minimum speech 250 ms, coughs or chair noise: L14/d:35
- silence hangover 500-800 ms, too short interrupts user: L14/d:36
- pre-roll 300-500 ms: L14/d:37
- energy gate -40 dBFS, fires on any noise: L14/d:26
- 20 ms frame, 320 samples at 16 kHz: L11/d:30
- ring buffer 32,000 samples, 2 s: L11/d:32
- turn commit 0.6 plus 500ms VAD silence: C03/d:82

## Silero VAD segments (annotated-code, 12 lines)
- code: L14/d:74-86
- 0.3 sensitive: L14/d:34. 250 ms coughs: L14/d:35. 500 hangover: L14/d:36. 300 pre-roll: L14/d:37

## Barge-in and the flush trick (annotated-code, 13 lines)
- barge-in loop: L12/d:123-131. Cancel on VAD during TTS: L12/d:36
- flush_on_end: L14/d:118-122. Flush forces immediate output: L14/d:41

## Run the lessons (command-table, 8)
- python3 code/main.py: L11/c:6
- python main.py, clean and barge-in sessions: C03/c:10, C03/c:211, C03/c:222
- pip install silero-vad: L12/d:138
- npm install: C03/ts/README.md:26
- npm start, two offline sessions and ws self-probe, exits 0: C03/ts/README.md:27
- npm start -- --serve: C03/ts/README.md:28
- npm test, node --test runner via tsx: C03/ts/README.md:29
- npm run typecheck, tsc --noEmit: C03/ts/README.md:30

## Core terms (concepts, 9)
- ring buffer, no allocations in hot path: L11/d:32
- jitter buffer, too small gaps, too large latency: L11/d:42
- pre-roll prevents first-word clip: L12/d:171, L14/d:37
- silence hangover after VAD returns to 0: L14/d:36, L14/d:164
- semantic endpoint looks at words, not just silence: L14/d:167
- flush trick, 500 ms buffer finishes in ~125 ms: L14/d:41
- filler when a tool takes more than 300ms: C03/d:21, C03/d:143
- DOWNSTREAM source to sink, audio in, speech out: A22/d:28, A22/d:121
- UPSTREAM cancel, metrics, barge-in: A22/d:29, A22/d:122

## Full-duplex Moshi, one 80 ms step (flow, 6)
1. Mimi 12.5 Hz x 8 codebooks: L15/d:24, L15/c:20
2. 7B Temporal Transformer, user tokens and own tokens: L15/d:29, L15/d:31-32
3. next text token, inner monologue: L15/d:33
4. 2-layer depth transformer, codebooks sequential: L15/d:38
5. decode_audio_mimi then play: L15/d:105-109
6. 160 ms theory (80 + 80), 200 ms on a single L4: L15/d:16

## Troubleshooting (troubleshooting, 8)
- first-word clip, threshold 0.3: L12/d:40. Pre-roll: L14/d:145
- talks over user, wire VAD to cancel-LLM: L12/d:41
- "Thanks for watching" on silent frames, VAD-gate: L12/d:42
- no AEC, TTS re-enters mic, WebRTC AEC3: L11/d:49
- too-short hangover interrupts, 500-800 ms, semantic turn detector: L14/d:143, L14/d:146
- TTS warm-up on first request, dummy run: L11/d:48
- sub-200 ms chunks, vocoder artifacts, 320 ms chunks: L11/d:142
- GIL starves audio thread, C-callback audio library: L11/d:46

## Glossary (glossary, 4)
- AEC subtracts speaker-to-mic path: L11/d:164
- TPR @ 5% FPR, 87.7% Silero, 50.0% WebRTC VAD: L14/d:49-50, L14/d:168
- MultimodalAgent direct audio, no text in the middle: A22/d:47, A22/d:125
- VoicePipelineAgent STT, LLM, TTS, text-level control: A22/d:48, A22/d:126

## Q&A (qa, 6)
- ~230 ms human turn latency, above 1500 ms broken: L11/d:12
- pipeline for tools, Moshi not trained for tool calling: L15/d:133, L15/d:145
- Whisper streaming is block-based, no flush: L14/d:125
- 450-600ms premium, 800-1200ms common: A22/d:73
- p50 first-audio-out under 800ms, false-cutoff under 3%: C03/d:115-116
- UPSTREAM cancel frames for barge-in: A22/d:60, A22/c:152
