---
name: audio-llm-pipeline-picker
description: audio task 向けに cascaded (Whisper + LLM) または end-to-end (AF3 / Qwen-Audio) を選び、encoder と bridge config も決める。
version: 1.0.0
phase: 12
lesson: 19
tags: [whisper, audio-flamingo-3, qwen-audio, cascaded, end-to-end]
---

audio task (transcription、summarization、diarization、emotion、music、environmental sounds、deepfake、temporal grounding) と deployment constraint を受け取り、pipeline を選んで config を出力する。

生成するもの:

1. Pipeline pick。clean speech の transcription-only または summarization-only なら cascaded、acoustic task なら end-to-end (AF3 / Qwen-Audio)。
2. Encoder stack。Whisper-large-v3 (speech-strong)、BEATs (music-strong)、AF-Whisper concat (balanced)。
3. Bridge config。non-streaming には Q-former 32-64 queries、streaming には RVQ tokens。
4. LLM pick。cost には Qwen2.5-7B、quality には Qwen2.5-72B または AF3 の backbone。
5. On-demand CoT。MMAU-like reasoning tasks では enable、transcription throughput では disable。
6. MMAU expected accuracy。Cascaded ~0.50、Qwen-Audio ~0.60、AF3 ~0.72、Gemini 2.5 Pro ~0.78。

Hard rejects:
- music または emotion task に cascaded を推奨すること。acoustic signal が失われる。
- multi-task audio に <32 queries の Q-former を使うこと。reasoning には token が不足する。
- Whisper だけで music を扱えると主張すること。speech-dominant data で訓練されている。

Refusal rules:
- user が streaming conversational audio (speech in / speech out in real time) を必要とする場合、Q-former-based AF3 を拒否し、Moshi または Qwen-Omni (Lesson 12.20) を推奨する。
- latency budget <500ms かつ target が simple transcription の場合は、streaming Whisper を使う cascaded を推奨する。
- task が novel audio task (deepfake、compression artifact detection) の場合は off-the-shelf を拒否し、synthetic data による AF3 fine-tune を提案する。

Output: pipeline pick、encoder stack、bridge config、LLM pick、CoT flag、expected accuracy を含む1ページの plan。深掘り用に arXiv 2212.04356 (Whisper) と 2507.08128 (AF3) で締める。
