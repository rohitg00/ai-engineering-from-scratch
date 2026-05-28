---
name: audio-loader
description: 生の音声ファイルを対象モデルの期待に照らして検証し、安全にリサンプリングする。
version: 1.0.0
phase: 6
lesson: 01
tags: [audio, speech, preprocessing]
---

音声ファイル (path, channels, sample rate, bit depth, codec) と対象モデル (必要な sample rate と channel count を持つ ASR / TTS / classifier) が与えられたら、次を出力します。

1. Mismatches. ファイルが対象と一致しないすべての次元を列挙します (sr, channels, duration floor, clipping check)。
2. Resample plan. Source sr、target sr、resampling library (`torchaudio.transforms.Resample` または `librosa.resample`)、anti-aliasing filter type。
3. Channel plan. Mono fold strategy (mean vs left-only)、またはモデルが対応する場合は multichannel pass-through。
4. Normalization. Peak vs RMS normalization、dBFS target、clipping guard。
5. Validation snippet. ファイルを読み込み、変換を実行し、最終配列が `(target_sr, dtype, channel_count, range)` に一致することを assert する Python。

アンチエイリアシングフィルタなしのダウンサンプリングは拒否します。再構成フィルタなしで 2x を超えるアップサンプリングは拒否します。±0.999 を超える clipping peaks、または ±0.01 を超える DC offset を持つ入力ファイルはフラグします。
