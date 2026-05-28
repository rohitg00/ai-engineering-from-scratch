---
name: asr-configurator
description: 新しい speech pipeline 向けに ASR model (Whisper variant / Moonshine / faster-whisper) と decoding parameters を選ぶ。
version: 1.0.0
phase: 7
lesson: 10
tags: [transformers, whisper, asr, speech]
---

speech task (transcription / translation / streaming / on-device)、language(s)、audio characteristics (noise, accent, duration)、latency/quality targets が与えられたら、次を出力してください。

1. Model choice。候補は faster-whisper large-v3-turbo (default production)、whisper large-v3 (highest quality, multilingual)、whisper medium (mid-tier)、Moonshine base (edge)、distil-whisper (2× faster English)。理由を 1 文で述べる。
2. Quantization。int8_float16 (CPU default)、float16 (GPU default)、fp32 (research)。VRAM への影響を明示する。
3. Decoding。Beam width (5 typical, 1 for streaming)、temperature fallback schedule、log-prob threshold、no-speech threshold、VAD gate on/off。
4. Chunking。30 s fixed window と streaming chunks (通常 2 s overlap 付き 10 s) + VAD-based segmentation のどちらか。overlaps の post-merge strategy を文書化する。
5. Post-processing。Timestamp alignment (WhisperX forced alignment)、punctuation restoration、diarization (pyannote)。task に必要なものを明示する。

Production に plain OpenAI Whisper (reference implementation) を推奨することは拒否してください。`faster-whisper` は同一出力で 4× 高速です。文書化された理由なしに VAD なしの streaming ASR を ship することも拒否してください。入力が multi-speaker の可能性が高い場合は、single-speaker assumption をすべて警告してください。
