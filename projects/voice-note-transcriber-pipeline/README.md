# Voice Note Transcriber Pipeline

Turn a selected WAV into a transcript, WebVTT captions and an audio review page. You build PCM decoding, acoustic activity detection, a real HTTP recognition adapter and portable exports with audio hashes.

Python 3.10 or newer. The required core uses standard libraries. Learn bytes and context managers first, then sample rate, channels and an injected provider callable.

```bash
python3 scripts/project_test.py voice-note-transcriber-pipeline --init my-voice-pipeline
python3 scripts/project_test.py voice-note-transcriber-pipeline --stage 1 --path my-voice-pipeline --strict
python3 scripts/project_test.py voice-note-transcriber-pipeline --all --solution --strict
cd projects/voice-note-transcriber-pipeline/solution
python3 pipeline.py --input fixtures/repair-note.wav --transcript-file fixtures/reference.json --out voice-output
```

Open voice-output/index.html to play the embedded audio and seek to a cue. The directory also contains audio.wav, captions.vtt and transcript.json. Keep the VTT beside the page for its download link.

The original repair note was synthesized locally with the operating system's generic voice. Its companion transcript is supplied author text bound to the WAV's SHA256. The offline demo checks the pipeline with that speech fixture; it does not perform or claim speech recognition.

## Transcribe your own audio

Use an explicit OpenAI-compatible audio/transcriptions endpoint that accepts multipart file and model fields:

```bash
python3 pipeline.py --input YOUR_NOTE.wav --endpoint http://127.0.0.1:8080/v1/audio/transcriptions --model YOUR_MODEL --out voice-output
```

The selected audio is uploaded only in endpoint mode. TRANSCRIPTION_API_KEY supplies authentication if your endpoint requires it. Remote recognizers require HTTPS; HTTP is accepted only for localhost and explicit loopback IP addresses. URL credentials and redirects are rejected. The adapter sends actual WAV bytes, checks response text, bounds request time and response size, and propagates non-timeout failures. Tests inspect its multipart request using controlled responses; they do not measure a live recognizer's accuracy.

The core accepts mono signed 16-bit PCM WAV, up to 20 MB through the CLI. If you already use FFmpeg, convert a phone recording explicitly before running it:

```bash
ffmpeg -i YOUR_NOTE.m4a -ac 1 -ar 16000 -c:a pcm_s16le YOUR_NOTE.wav
```

FFmpeg is optional and is not installed by this project. Whole-clip recognition is the default. --segment opts into RMS-based activity splitting, which can omit quiet speech or include loud background noise. These timestamps describe selected segments, not word alignments.

## Review and correct

Edit the text fields in an exported transcript.json while keeping its audio hash, then rerender without contacting a recognizer:

```bash
python3 pipeline.py --input YOUR_NOTE.wav --review-file EDITED_TRANSCRIPT.json --out corrected-output
```

Finite ordered cues must stay inside the audio duration. Unsupported encodings, overlapping spans, empty text and a mismatched audio hash fail visibly.

1. [Decode the audio clock](stages/01-pcm/docs/en.md)
2. [Measure acoustic activity](stages/02-activity/docs/en.md)
3. [Send WAV through a recognizer](stages/03-transcribe/docs/en.md)
4. [Export and review captions](stages/04-captions/docs/en.md)

[Python WAV API](https://docs.python.org/3/library/wave.html) and [WebVTT specification](https://www.w3.org/TR/webvtt1/). The implementations, spoken sentence and tests are original.
