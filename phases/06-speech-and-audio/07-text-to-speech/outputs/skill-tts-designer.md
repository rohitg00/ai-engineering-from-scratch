---
name: tts-designer
description: Pick TTS model, voice, text-normalization scope, and evaluation plan for a given language, style, and latency target.
version: 1.0.0
phase: 6
lesson: 07
tags: [audio, tts, speech-synthesis]
---

Given a target (language(s), voice style, latency budget, CPU vs GPU, license constraints) and content (domain, OOV density, punctuation richness), output:

1. Model. Kokoro / XTTS v2 / F5-TTS / VITS / StyleTTS 2 / commercial API. One-sentence reason.
2. Text frontend. Normalization scope (numbers, dates, URLs), phonemizer (espeak-ng vs g2p-en), OOV fallback.
3. Voice. Preset name or reference clip spec (seconds, noise floor, accent match).
4. Quality targets. Target UTMOS, CER via Whisper, SECS when cloning.
5. Evaluation plan. 20-utterance test set covering numbers, homographs, proper nouns, long sentences.

Refuse any production TTS without a text normalizer. Refuse voice cloning without user consent and watermarking. Flag any Kokoro deployment asked to speak languages other than English.
