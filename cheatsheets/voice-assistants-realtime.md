---
id: voice-assistants-realtime
title: Real-Time Voice Assistants
code: RT
subtitle: VAD, turn detection, barge-in, latency budgets and full-duplex speech for a voice agent that answers in time.
hue: 285
sources: phases/06-speech-and-audio/11-real-time-audio-processing, phases/06-speech-and-audio/12-voice-assistant-pipeline, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking, phases/06-speech-and-audio/15-streaming-speech-to-speech-moshi-hibiki, phases/14-agent-engineering/22-voice-agents-pipecat-livekit, phases/19-capstone-projects/03-realtime-voice-assistant
source_hash: bd10481585db3e17
---

## Cascaded voice pipeline
type: architecture
from: phases/06-speech-and-audio/12-voice-assistant-pipeline/docs/en.md, phases/19-capstone-projects/03-realtime-voice-assistant/docs/en.md

```arch
node | mic | 1,1 | Mic | 16 kHz mono, 20 ms | client
node | vad | 2,1 | VAD | Silero, speech gate | process
node | stt | 3,1 | Streaming STT | partial transcripts | model
node | turn | 4,1 | Turn detector | score above 0.6 | model
node | llm | 4,2 | LLM with tools | streams tokens | model
node | tool | 3,2 | Tool side channel | filler after 300ms | process
node | tts | 2,2 | Streaming TTS | first chunk in 200ms | model
node | spk | 1,2 | Speaker | WebRTC jitter buffer | client
edge | mic | vad | frames
edge | vad | stt | speech
edge | stt | turn | partials
edge | turn | llm | commit
edge | llm | tool | call
edge | llm | tts | tokens
edge | tts | spk | audio
edge | vad | tts | barge-in cancel
```

## Capstone scheduler, one turn
type: flow
from: phases/19-capstone-projects/03-realtime-voice-assistant/code/ts/src/orchestrator.ts, phases/19-capstone-projects/03-realtime-voice-assistant/code/main.py

1. **IDLE**: the first speech frame moves the state to LISTENING.
2. **LISTENING**: each silent frame adds 20 ms to `silenceRunMs`.
3. **LISTENING**: at 500 ms of silence, `turnCompletionScore` reads the last partial.
4. **WAITING**: a score of 0.6 or more commits the turn and sets `turnCompleteMs`.
5. **THINKING**: the tool call fires. At 300 ms the agent says "one second, let me check".
6. **THINKING**: the tool returns at 420 ms. The first LLM token comes 140 ms later.
7. **SPEAKING**: the first audio out comes 180 ms after the first LLM token.
8. **Barge-in**: speech in THINKING or SPEAKING cancels TTS and re-arms ASR.

## Latency budget per turn
type: defaults
from: phases/06-speech-and-audio/11-real-time-audio-processing/docs/en.md, phases/06-speech-and-audio/12-voice-assistant-pipeline/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Mic to buffer | 20 ms | One frame |
| VAD | 10 ms | Silero runs under 1 ms per frame |
| ASR (streaming) | 150 ms | Partial transcripts |
| LLM (first token) | 100 ms | Stream the tokens |
| TTS (first chunk) | 100 ms | Start before the full reply |
| Render to speaker | 20 ms | One frame |
| Total | ~400 ms | Above 500 ms feels robotic |
| First TTS audio, laptop CPU | 800 ms | Phase 6 capstone target |

## VAD and turn settings
type: defaults
from: phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md, phases/06-speech-and-audio/11-real-time-audio-processing/docs/en.md, phases/19-capstone-projects/03-realtime-voice-assistant/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Silero threshold | 0.5 | 0.3 is sensitive. Fewer first-word clips |
| Minimum speech | 250 ms | Rejects coughs and chair noise |
| Silence hangover | 500-800 ms | Too short cuts the user off |
| Pre-roll buffer | 300-500 ms | Keeps the first word |
| Energy gate | -40 dBFS | Fires on any noise above it |
| Frame size | 20 ms | 320 samples at 16 kHz |
| Ring buffer | 32,000 samples | 2 s at 16 kHz |
| Turn commit (capstone) | 0.6 | Plus 500ms of VAD silence |

## Silero VAD segments
type: annotated-code
lang: python
from: phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md

```python
from silero_vad import load_silero_vad, get_speech_timestamps
vad = load_silero_vad()
audio = torch.tensor(waveform_16k, dtype=torch.float32)
segments = get_speech_timestamps(
    audio, vad, sampling_rate=16000,
    threshold=0.5,  # 0.3 is sensitive
    min_speech_duration_ms=250,  # drops coughs
    min_silence_duration_ms=500,  # silence hangover
    speech_pad_ms=300,  # pre-roll pad
)
for s in segments:
    print(f"{s['start']/16000:.2f}s - {s['end']/16000:.2f}s")
```

## Barge-in and the flush trick
type: annotated-code
lang: python
from: phases/06-speech-and-audio/12-voice-assistant-pipeline/docs/en.md, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md

```python
tts_task = asyncio.create_task(tts_loop())
while True:
    chunk = await mic.get()
    if vad(chunk):  # user speaks during TTS
        tts_task.cancel()  # stop the reply
        await speaker.stop()
        await new_turn()  # restart STT
        break

def flush_on_end(stt_client, audio_buffer):
    stt_client.send_audio(audio_buffer)
    stt_client.send_flush()  # forces output now
    return stt_client.recv_transcript(timeout_ms=150)
```

## Run the lessons
type: command-table
from: phases/06-speech-and-audio/11-real-time-audio-processing/code/main.py, phases/06-speech-and-audio/12-voice-assistant-pipeline/docs/en.md, phases/19-capstone-projects/03-realtime-voice-assistant/code/main.py, phases/19-capstone-projects/03-realtime-voice-assistant/code/ts/README.md

| Command | What it does |
|---|---|
| `python3 code/main.py` | Runs the simulator of a lesson |
| `python main.py` | Capstone scheduler, clean and barge-in calls |
| `pip install silero-vad` | Real VAD in place of the stub |
| `npm install` | Installs the TypeScript client |
| `npm start` | Two offline sessions and a ws probe, exits 0 |
| `npm start -- --serve` | Keeps the ws server up |
| `npm test` | node --test runner via tsx |
| `npm run typecheck` | Runs `tsc --noEmit` |

## Core terms
type: concepts
from: phases/06-speech-and-audio/11-real-time-audio-processing/docs/en.md, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md, phases/19-capstone-projects/03-realtime-voice-assistant/docs/en.md, phases/14-agent-engineering/22-voice-agents-pipecat-livekit/docs/en.md

- **Ring buffer**: fixed circular buffer. No allocations in the hot path.
- **Jitter buffer**: reorders late packets. Too small gives gaps. Too large adds latency.
- **Pre-roll**: audio kept before VAD fires. It prevents the first-word clip.
- **Silence hangover**: the wait after VAD returns to 0, before end of turn.
- **Semantic endpoint**: a classifier that reads the words, not only the silence.
- **Flush trick**: flush the STT at end of speech. 500 ms of look-ahead ends in ~125 ms.
- **Filler**: a short phrase when a tool takes more than 300ms.
- **DOWNSTREAM**: Pipecat frames from source to sink, audio in and speech out.
- **UPSTREAM**: Pipecat control frames, such as cancel, metrics and barge-in.

## Full-duplex Moshi, one 80 ms step
type: flow
from: phases/06-speech-and-audio/15-streaming-speech-to-speech-moshi-hibiki/docs/en.md, phases/06-speech-and-audio/15-streaming-speech-to-speech-moshi-hibiki/code/main.py

1. **Mimi**: encodes user audio at 12.5 Hz with 8 codebooks.
2. **Temporal Transformer**: 7B parameters. Reads the user tokens and its own last tokens.
3. **Temporal Transformer**: emits the next text token, the inner monologue.
4. **Depth Transformer**: 2 layers. Predicts the 8 codebooks one after the other.
5. **Client**: `decode_audio_mimi` turns the tokens into audio and plays it.
6. **Budget**: 80 ms frame plus 80 ms acoustic delay is 160 ms. 200 ms on one L4 GPU.

## Troubleshooting
type: troubleshooting
from: phases/06-speech-and-audio/12-voice-assistant-pipeline/docs/en.md, phases/06-speech-and-audio/11-real-time-audio-processing/docs/en.md, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| First word is missing | VAD starts a beat too late | Threshold 0.3 and a pre-roll |
| Bot talks over the user | LLM keeps going after interrupt | Wire VAD to cancel the LLM |
| "Thanks for watching" on silence | Whisper on silent frames | Always VAD-gate |
| ASR hears the bot voice | No echo cancellation | WebRTC AEC3 |
| Agent cuts user off mid-sentence | Hangover too short | 500-800 ms and a turn detector |
| Slow first reply | TTS warm-up on first request | Warm it with a dummy run |
| Audible vocoder artifacts | Sub-200 ms TTS chunks | 320 ms chunks |
| Glitches under load | GIL starves the audio thread | C-callback audio library |

## Glossary
type: glossary
from: phases/06-speech-and-audio/11-real-time-audio-processing/docs/en.md, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md, phases/14-agent-engineering/22-voice-agents-pipecat-livekit/docs/en.md

- **AEC**: echo cancellation. Subtracts the speaker to mic path.
- **TPR @ 5% FPR**: VAD benchmark point. Silero 87.7%, WebRTC VAD 50.0%.
- **MultimodalAgent**: LiveKit class. Audio in, audio out, no text in the middle.
- **VoicePipelineAgent**: LiveKit class. STT, LLM, TTS with text-level control.

## Q&A
type: qa
from: phases/06-speech-and-audio/11-real-time-audio-processing/docs/en.md, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md, phases/06-speech-and-audio/15-streaming-speech-to-speech-moshi-hibiki/docs/en.md, phases/14-agent-engineering/22-voice-agents-pipecat-livekit/docs/en.md, phases/19-capstone-projects/03-realtime-voice-assistant/docs/en.md

- **How fast do humans take turns?** About 230 ms. Above 1500 ms feels broken.
- **Pipeline or Moshi?** Use a pipeline for tools. Moshi is not trained for tool calling.
- **Why no flush with Whisper streaming?** It is block-based and always waits for chunks.
- **What is end-to-end premium?** 450 to 600 ms. 800 to 1200 ms is common.
- **What is the capstone bar?** First-audio-out p50 under 800ms, false-cutoff under 3%.
- **What does barge-in need in Pipecat?** UPSTREAM cancel frames back to TTS and LLM.
