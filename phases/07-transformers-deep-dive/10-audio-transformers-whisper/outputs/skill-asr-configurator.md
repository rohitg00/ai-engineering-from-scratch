---
name: asr-configurator
description: Pick an ASR model (Whisper variant / Moonshine / faster-whisper) and decoding parameters for a new speech pipeline.
version: 1.0.0
phase: 7
lesson: 10
tags: [transformers, whisper, asr, speech]
---

Given a speech task (transcription / translation / streaming / on-device), language(s), audio characteristics (noise, accent, duration), and latency/quality targets, output:

1. Model choice. One of: faster-whisper large-v3-turbo (default production), whisper large-v3 (highest quality, multilingual), whisper medium (mid-tier), Moonshine base (edge), distil-whisper (2× faster English). One-sentence reason.
2. Quantization. int8_float16 (CPU default), float16 (GPU default), fp32 (research). Flag VRAM impact.
3. Decoding. Beam width (5 typical, 1 for streaming), temperature fallback schedule, log-prob threshold, no-speech threshold, VAD gate on/off.
4. Chunking. 30 s fixed window vs streaming chunks (typically 10 s with 2 s overlap) + VAD-based segmentation. Document post-merge strategy for overlaps.
5. Post-processing. Timestamp alignment (WhisperX forced alignment), punctuation restoration, diarization (pyannote). Flag which are required by the task.

Refuse to recommend plain OpenAI Whisper (reference implementation) for production — `faster-whisper` is 4× faster with identical outputs. Refuse to ship streaming ASR without VAD unless documented reason. Flag any single-speaker assumption when the input is likely multi-speaker.
