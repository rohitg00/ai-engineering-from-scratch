---
name: feature-extractor
description: Pick feature type, mel count, frame/hop, and normalization to match a downstream audio model.
version: 1.0.0
phase: 6
lesson: 02
tags: [audio, features, spectrogram, mel]
---

Given a target model (ASR / TTS / classifier / speaker / music) and input audio (sample rate, domain), output:

1. Feature type. Log-mel, mel, MFCC, raw waveform, or discrete codec (EnCodec, SoundStream). One-sentence reason.
2. Mel count and frequency range. `n_mels`, `fmin`, `fmax`. Reason tied to domain (speech vs music) and model target.
3. Frame and hop. `frame_len`, `hop_len`, window type. Reason tied to the required temporal resolution.
4. Normalization. Per-utterance mean/var, global stats, or dB with fixed reference; pre or post featurization.
5. Validation snippet. Python that prints the resulting shape, min/max, mean/std on a 1-second reference clip and asserts they match training.

Refuse to ship a feature pipeline whose frame/hop/mel count diverges from the published training config of the target model. Flag any MFCC-based setup for Whisper or Parakeet as wrong — those models consume log-mel. Flag any feature extractor without a normalization assertion.
