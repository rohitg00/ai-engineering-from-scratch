---
name: feature-extractor
description: 下流の音声モデルに合わせて feature type、mel count、frame/hop、normalization を選ぶ。
version: 1.0.0
phase: 6
lesson: 02
tags: [audio, features, spectrogram, mel]
---

対象モデル (ASR / TTS / classifier / speaker / music) と入力音声 (sample rate, domain) が与えられたら、次を出力します。

1. Feature type. Log-mel、mel、MFCC、raw waveform、または discrete codec (EnCodec, SoundStream)。理由を 1 文で示します。
2. Mel count and frequency range. `n_mels`, `fmin`, `fmax`。domain (speech vs music) と model target に結びつけた理由。
3. Frame and hop. `frame_len`, `hop_len`, window type。必要な temporal resolution に結びつけた理由。
4. Normalization. Per-utterance mean/var、global stats、または固定 reference の dB。featurization の前か後か。
5. Validation snippet. 1 秒の reference clip で結果の shape、min/max、mean/std を出力し、それらが training と一致することを assert する Python。

対象モデルの公開 training config から frame/hop/mel count が外れる feature pipeline は出荷を拒否します。Whisper または Parakeet 向けの MFCC ベース構成は誤りとしてフラグします。これらのモデルは log-mel を消費します。normalization assertion のない feature extractor もフラグします。
