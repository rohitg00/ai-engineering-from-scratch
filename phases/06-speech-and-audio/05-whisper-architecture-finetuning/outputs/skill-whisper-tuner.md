---
name: whisper-tuner
description: 指定された言語、ドメイン、レイテンシ予算に対して、Whisper のファインチューニングまたは推論パイプラインを設計します。
version: 1.0.0
phase: 6
lesson: 05
tags: [audio, whisper, asr, fine-tuning, lora]
---

対象 (language set, domain, clip length distribution, latency budget, hardware) とデータ (hours available, quality) が与えられたら、次を出力してください。

1. Variant。Tiny / Base / Small / Medium / Large-v3 / Turbo。理由。
2. Runtime。vanilla / faster-whisper / whisperx / whisper-streaming。理由。
3. Fine-tune plan。Full-FT vs LoRA (`r`, `target_modules`)、freeze-encoder policy、epoch count。
4. Inference guards。VAD (Silero または Whisper's own)、`temperature=0`、`condition_on_previous_text=False`、`no_speech_threshold`。
5. Evaluation。Domain WER target、text normalization rules、silence clips での hallucination-rate check。

VAD なしで任意の音声に Whisper をデプロイすることは拒否してください。runaway guard なしで multi-chunk jobs に `condition_on_previous_text=True` を設定することは拒否してください。Whisper の tokenizer または mel pipeline を差し替える fine-tune は警告してください。
