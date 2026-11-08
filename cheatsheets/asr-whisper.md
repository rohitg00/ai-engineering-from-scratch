---
id: asr-whisper
title: Speech Recognition and Whisper
code: SR
subtitle: Decode CTC, run and tune Whisper, gate with VAD, and ship a WAV to captions pipeline.
hue: 265
sources: phases/06-speech-and-audio/04-speech-recognition-asr, phases/06-speech-and-audio/05-whisper-architecture-finetuning, phases/07-transformers-deep-dive/10-audio-transformers-whisper, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking, projects/voice-note-transcriber-pipeline
source_hash: 778a930fb3a9e490
---

## Tasks in code
type: task-table
from: phases/06-speech-and-audio/04-speech-recognition-asr/code/main.py, phases/06-speech-and-audio/04-speech-recognition-asr/docs/en.md, phases/06-speech-and-audio/05-whisper-architecture-finetuning/code/main.py, phases/06-speech-and-audio/05-whisper-architecture-finetuning/docs/en.md, phases/07-transformers-deep-dive/10-audio-transformers-whisper/code/main.py, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/code/main.py
span: 2

| Task | Code |
|---|---|
| Greedy CTC decode | `ctc_greedy(frame_probs)` |
| Beam CTC decode | `ctc_beam(frame_probs, beam_width=8)` |
| Word error rate | `wer(ref, hyp)` |
| Plan chunks for a 10 min clip | `chunk_schedule(600.0, chunk_s=30.0, stride_s=5.0)` |
| Turn-end state machine | `TurnDetector(silence_hangover_ms=500, min_speech_ms=250)` |
| LoRA on attention | `LoraConfig(r=16, lora_alpha=32, target_modules=["q_proj", "v_proj"])` |

## Whisper inside
type: architecture
from: phases/07-transformers-deep-dive/10-audio-transformers-whisper/docs/en.md, phases/06-speech-and-audio/05-whisper-architecture-finetuning/docs/en.md

```arch
node | audio | 1,1 | Audio | 16 kHz, pad or clip to 30 s | client
node | mel | 2,1 | Log-mel | 80 mels x 3000 frames | process
node | stem | 3,1 | Conv stem | kernel 3, stride 2 | process
node | enc | 4,1 | Encoder | 1500 timesteps | model
node | prompt | 3,2 | Task tokens | language, task, timestamps | store
node | dec | 4,2 | Decoder | causal self-attn + cross-attn | model
node | text | 2,2 | BPE tokens | 51,865-token vocab | client
edge | audio | mel |
edge | mel | stem |
edge | stem | enc | 1500
edge | enc | dec | cross-attn
edge | prompt | dec | prefix
edge | dec | text |
```

## Transcribe with Whisper
type: annotated-code
lang: python
from: phases/06-speech-and-audio/05-whisper-architecture-finetuning/docs/en.md

```python
import whisper
model = whisper.load_model("large-v3-turbo")
result = model.transcribe("clip.wav",
    language="en",                     # stops LID drift
    task="transcribe",                 # or <|translate|> to English
    temperature=0.0,                   # no sampling fallback
    condition_on_previous_text=False)  # prevents runaway repetition
print(result["text"])
for seg in result["segments"]:         # start, end, text per segment
    print(seg["start"], seg["end"], seg["text"])
```

## Faster runtimes and VAD
type: annotated-code
lang: python
from: phases/07-transformers-deep-dive/10-audio-transformers-whisper/docs/en.md, phases/06-speech-and-audio/05-whisper-architecture-finetuning/docs/en.md, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md
span: 2

```python
from faster_whisper import WhisperModel
model = WhisperModel("large-v3-turbo", compute_type="int8_float16")  # 4x faster
segments, info = model.transcribe("meeting.wav", vad_filter=True)    # VAD gate
from silero_vad import load_silero_vad, get_speech_timestamps
vad = load_silero_vad()
segments = get_speech_timestamps(audio, vad, sampling_rate=16000, threshold=0.5,
    min_speech_duration_ms=250, min_silence_duration_ms=500, speech_pad_ms=300)
```

## ASR formulations
type: concepts
from: phases/06-speech-and-audio/04-speech-recognition-asr/docs/en.md, phases/06-speech-and-audio/05-whisper-architecture-finetuning/docs/en.md, phases/07-transformers-deep-dive/10-audio-transformers-whisper/docs/en.md

- **CTC**: per-frame tokens plus a blank. No internal LM. Fast.
- **Greedy CTC**: collapse repeats, drop blanks. `a a _ _ a b b _ c` gives `a a b c`.
- **RNN-T**: predictor plus joiner. Streamable, with an internal LM.
- **Attention enc-dec**: best offline quality. Cannot stream without engineering.
- **WER**: $(S + D + I) / N$. Above 20% is unusable. Below 5% is human parity.
- **Turbo**: 4-layer decoder (from 32). 8× faster, <1% WER hit.
- **Prompt**: `<|startoftranscript|>` `<|en|>` `<|transcribe|>` or `<|translate|>`, then `<|notimestamps|>`.

## Defaults
type: defaults
from: phases/06-speech-and-audio/05-whisper-architecture-finetuning/docs/en.md, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md, projects/voice-note-transcriber-pipeline/solution/pipeline.py

| Setting | Default | Note |
|---|---|---|
| `temperature` | 0.0 | Override the fallback chain |
| `condition_on_previous_text` | False | Stops the hallucination cascade |
| `no_speech_threshold` | 0.6 | Silence detection |
| Silero `threshold` | 0.5 | 0.3 is sensitive |
| `min_speech_duration_ms` | 250 | Rejects coughs and chair noise |
| Silence hangover | 500-800 ms | Shorter interrupts, longer feels sluggish |
| Pre-roll buffer | 300-500 ms | Keeps the first word |

## Run the project
type: annotated-code
lang: bash
from: projects/voice-note-transcriber-pipeline/README.md
span: 2

```bash
python3 scripts/project_test.py voice-note-transcriber-pipeline --init my-voice-pipeline
python3 scripts/project_test.py voice-note-transcriber-pipeline --all --solution --strict
cd projects/voice-note-transcriber-pipeline/solution
python3 pipeline.py --input fixtures/repair-note.wav --transcript-file fixtures/reference.json --out voice-output
ffmpeg -i YOUR_NOTE.m4a -ac 1 -ar 16000 -c:a pcm_s16le YOUR_NOTE.wav  # mono 16-bit PCM
python3 pipeline.py --input YOUR_NOTE.wav --endpoint <url> --model YOUR_MODEL --out voice-output
```

## Project pipeline
type: flow
from: projects/voice-note-transcriber-pipeline/solution/pcm.py, projects/voice-note-transcriber-pipeline/solution/activity.py, projects/voice-note-transcriber-pipeline/solution/transcribe.py, projects/voice-note-transcriber-pipeline/solution/provider.py, projects/voice-note-transcriber-pipeline/solution/captions.py, projects/voice-note-transcriber-pipeline/solution/pipeline.py

1. **decode_wav**: mono, 16-bit, uncompressed only. Samples divide by 32768.
2. **activity**: only with `--segment`. RMS per `frame_ms=20` frame, `threshold=0.02`, merge gaps of `gap_ms=40`, drop spans under `min_ms=40`.
3. **transcribe**: `encode_wav` each span. Retry a `TimeoutError` up to `retries=1`. Each row keeps `audio_sha256` and `attempts`.
4. **http_recognizer**: multipart `model` and `file` fields. Response limit 1 MB. Timeout 30 s.
5. **captions**: `WEBVTT` header. Cue times `stamp()` as hh:mm:ss.mmm. Overlaps fail.
6. **export_transcript**: writes transcript.json, captions.vtt, audio.wav and index.html.

## Project flags
type: command-table
from: projects/voice-note-transcriber-pipeline/solution/pipeline.py, projects/voice-note-transcriber-pipeline/README.md

| Command | What it does |
|---|---|
| `--input <wav>` | Mono 16-bit PCM WAV, 20 MB at most |
| `--out <dir>` | Output folder, default `voice-output` |
| `--transcript-file <json>` | Offline reference text bound to the audio SHA256 |
| `--endpoint <url>` | Uploads the WAV to an audio/transcriptions endpoint |
| `--segment` | RMS activity split before recognition |
| `--review-file <json>` | Rerenders an edited transcript.json |

## Troubleshooting
type: troubleshooting
from: phases/06-speech-and-audio/04-speech-recognition-asr/docs/en.md, phases/06-speech-and-audio/05-whisper-architecture-finetuning/docs/en.md, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md, projects/voice-note-transcriber-pipeline/solution/pcm.py, projects/voice-note-transcriber-pipeline/solution/provider.py, projects/voice-note-transcriber-pipeline/README.md

| Symptom | Cause | Fix |
|---|---|---|
| "Thanks for watching!" on silence | No VAD | VAD-gate before you call Whisper |
| Noisy clip comes out in Japanese | Auto LID drift | Force `language="en"` |
| One error repeats in later windows | Previous text cascade | `condition_on_previous_text=False` |
| Text in the padding of a 2 s clip | Pad to 30 s | `pad=False` or VAD-gate |
| Near-random output | librosa mels, wrong stats | `whisper.audio.log_mel_spectrogram` |
| Agent cuts the user off | Hangover too short | 500-800 ms hangover, semantic endpoint |
| "16-bit mono PCM required" | Stereo or compressed input | Convert with `ffmpeg -ac 1 -ar 16000` |
| "Remote endpoints require HTTPS" | HTTP to a remote host | Use HTTPS. HTTP is for loopback only |

## Questions
type: qa
from: phases/06-speech-and-audio/04-speech-recognition-asr/docs/en.md, phases/06-speech-and-audio/05-whisper-architecture-finetuning/docs/en.md, phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md

- **When to freeze the encoder?** With less than 10 hours of data. Tune only the decoder.
- **How much data to fine-tune?** 10 to 100 hours of target-domain audio with transcripts.
- **Why CTC beam over greedy?** Beam search allows LM fusion. CTC has no internal LM.
- **What is the flush trick?** On end of speech, flush the STT. A 500 ms buffer ends in ~125 ms.
- **Energy VAD in production?** No. It fires on any noise above -40 dBFS.
