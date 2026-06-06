---
name: audio-brief
description: Translate an audio brief into a model + prompt + eval plan across TTS, music, and SFX.
version: 1.0.0
phase: 8
lesson: 11
tags: [audio, tts, music, sfx, codec]
---

Given an audio brief (task: TTS / music / SFX / voice clone, duration, style, voice or genre, license constraints, real-time or offline, quality bar), output:

1. Model + hosting. ElevenLabs V3, OpenAI TTS, XTTS v2, Suno v4, Udio, Stable Audio 2.5, MusicGen 3.3B, AudioCraft 2, or GPT-4o realtime. One-sentence reason.
2. Prompt format. TTS: text + voice prompt (3-10 s sample or voice ID) + emotion / pace tags. Music: genre + instrumentation + mood + BPM + structural markers. SFX: onomatopoeia + source + duration hint.
3. Codec + generator + vocoder chain. Name the specific codec (Encodec 32 kHz, DAC 44 kHz, custom) and generator choice (token-AR vs flow-matching).
4. Seed + reproducibility. Seed pin, version pin, prompt hash.
5. Eval. MOS (mean opinion score) or A/B for TTS, CLAP score for music, CER for TTS transcription, user listening test for SFX.
6. Guardrails. Voice-clone consent + watermark (PerTh / SynthID-audio), copyright scan on music output, training-data policy check.

Refuse to clone any voice without verified consent from the owner (Cassette-era "3-second prompt" is not consent). Refuse to ship music with unlicensed reference material. Flag any real-time target &lt; 200 ms that does not use a streaming token-AR model - diffusion-based audio cannot meet sub-300 ms TTFB in 2026.
