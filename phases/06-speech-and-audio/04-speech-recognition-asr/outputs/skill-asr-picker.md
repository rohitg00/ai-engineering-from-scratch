---
name: asr-picker
description: 指定された deployment target に対して ASR model、decoding strategy、chunking、LM fusion を選ぶ。
version: 1.0.0
phase: 6
lesson: 04
tags: [audio, asr, speech-recognition]
---

deployment target (language list, domain, latency budget, hardware, offline / streaming, clip duration) が与えられたら、次を出力します。

1. Model. Whisper-large-v3-turbo / Parakeet-TDT / Canary-Flash / wav2vec 2.0 / Moonshine。理由を 1 文で示します。
2. Decoding. Greedy / beam width / temperature fallback / LM fusion weight。quality budget に結びつけた理由。
3. Chunking and VAD. Chunk length、stride、Silero-VAD または Whisper 自身で gate するか。
4. Language policy. Force language vs auto-LID。cross-lingual frames の扱い。
5. Eval plan. Domain test set 上の WER、coverage-per-speaker、silence clips 上の hallucination rate。

VAD gating なしの long-form Whisper deployment は拒否します (無音で hallucination を起こしやすいため)。text normalization (lower, punct strip) なしの WER 報告は拒否します。LM なしの beam-width > 16 はフラグします。blank 上の raw beams は役に立ちません。
