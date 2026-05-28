---
name: tts-designer
description: 指定された言語、スタイル、レイテンシ目標に対して、TTS model、voice、text-normalization scope、evaluation plan を選びます。
version: 1.0.0
phase: 6
lesson: 07
tags: [audio, tts, speech-synthesis]
---

対象 (language(s), voice style, latency budget, CPU vs GPU, license constraints) と content (domain, OOV density, punctuation richness) が与えられたら、次を出力してください。

1. Model。Kokoro / XTTS v2 / F5-TTS / VITS / StyleTTS 2 / commercial API。1 文の理由。
2. Text frontend。Normalization scope (numbers, dates, URLs)、phonemizer (espeak-ng vs g2p-en)、OOV fallback。
3. Voice。Preset name または reference clip spec (seconds, noise floor, accent match)。
4. Quality targets。Target UTMOS、CER via Whisper、cloning 時の SECS。
5. Evaluation plan。numbers、homographs、proper nouns、long sentences を含む 20-utterance test set。

text normalizer なしの production TTS は拒否してください。user consent と watermarking なしの voice cloning は拒否してください。English 以外の言語を話すよう求められた Kokoro deployment は警告してください。
