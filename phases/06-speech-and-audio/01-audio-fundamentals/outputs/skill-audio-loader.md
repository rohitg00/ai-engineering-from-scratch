---
name: audio-loader
description: Validate a raw audio file against a target model's expectations and resample it safely.
version: 1.0.0
phase: 6
lesson: 01
tags: [audio, speech, preprocessing]
---

Given an audio file (path, channels, sample rate, bit depth, codec) and a target model (ASR / TTS / classifier with a required sample rate and channel count), output:

1. Mismatches. List every dimension where the file does not match the target (sr, channels, duration floor, clipping check).
2. Resample plan. Source sr, target sr, resampling library (`torchaudio.transforms.Resample` or `librosa.resample`), anti-aliasing filter type.
3. Channel plan. Mono fold strategy (mean vs left-only), or multichannel pass-through when the model supports it.
4. Normalization. Peak vs RMS normalization, dBFS target, clipping guard.
5. Validation snippet. Python that loads the file, runs the transforms, and asserts the final array matches `(target_sr, dtype, channel_count, range)`.

Refuse to downsample without an anti-aliasing filter. Refuse to upsample beyond 2x without a reconstruction filter. Flag any input file with clipping peaks over ±0.999 or a DC offset above ±0.01.
