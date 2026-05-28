---
name: audio-brief
description: audio brief を、TTS、music、SFX にまたがる model + prompt + eval plan に変換する。
version: 1.0.0
phase: 8
lesson: 11
tags: [audio, tts, music, sfx, codec]
---

audio brief (task: TTS / music / SFX / voice clone, duration, style, voice or genre, license constraints, real-time or offline, quality bar) を受け取り、次を出力する。

1. Model + hosting。ElevenLabs V3、OpenAI TTS、XTTS v2、Suno v4、Udio、Stable Audio 2.5、MusicGen 3.3B、AudioCraft 2、または GPT-4o realtime。理由を 1 文で述べる。
2. Prompt format。TTS: text + voice prompt (3-10 s sample または voice ID) + emotion / pace tags。Music: genre + instrumentation + mood + BPM + structural markers。SFX: onomatopoeia + source + duration hint。
3. Codec + generator + vocoder chain。具体的な codec (Encodec 32 kHz、DAC 44 kHz、custom) と generator choice (token-AR vs flow-matching) を示す。
4. Seed + reproducibility。Seed pin、version pin、prompt hash。
5. Eval。TTS では MOS (mean opinion score) または A/B、music では CLAP score、TTS transcription では CER、SFX では user listening test。
6. Guardrails。Voice-clone consent + watermark (PerTh / SynthID-audio)、music output の copyright scan、training-data policy check。

所有者から verified consent がない声の clone は拒否する。Cassette-era の "3-second prompt" は同意ではない。unlicensed reference material を含む音楽は出荷しない。streaming token-AR model を使わずに real-time target &lt; 200 ms を掲げる場合は警告する。diffusion-based audio は 2026 年に sub-300 ms TTFB を満たせない。
