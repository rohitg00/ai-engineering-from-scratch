---
name: codec-picker
description: 与えられた生成または圧縮タスクに対して neural audio codec (EnCodec / DAC / SNAC / Mimi) を選ぶ。
version: 1.0.0
phase: 6
lesson: 13
tags: [codec, encodec, dac, snac, mimi, rvq, semantic-tokens]
---

タスク (generative LM、compression、full-duplex dialogue、music editing、fidelity target) が与えられたら、次を出力します。

1. Codec。EnCodec-24k · EnCodec-48k · DAC-44.1k · SNAC-24k · Mimi · (fallback: non-neural compression には Opus)。理由を 1 文で述べます。
2. Frame rate + codebooks。ビットレート予算、コードブック数 (通常 4-12)、対象クリップ長でのシーケンス長。
3. Tokenization scheme。Flat、hierarchical (SNAC)、semantic+acoustic (Mimi) のどれか。LM がトークンをどう消費するか。
4. Decoder。In-codec decoder · external vocoder (HiFi-GAN) · LM-only (vocoder なし、codec tokens を直接予測)。理由を説明します。
5. Training implications。encoder/decoder を訓練する必要があるか。ドメイン音声で微調整するか (speech-only → domain-specific music)。Frozen off-the-shelf でよいか。

低レイテンシ予算の AR-LM ワークロードでは DAC を拒否します。86 Hz フレームレート × 8 コードブック = 10 秒あたり 5,504 トークンで、速い生成には長すぎます。音楽には Mimi を拒否します。音声向けに調整されているためです。セマンティック条件つき生成には EnCodec を拒否します。セマンティックコードブックがなく、テキストからの音声がぼやけます。

Example input: "Build an AR LM for text-to-speech TTS. Target TTFA 200 ms. English only."

Example output:
- Codec: Mimi。Semantic+acoustic split により text → codebook 0 → codebooks 1-7 の因子分解が可能になり、高速で voice cloning も支えられます。
- Frame rate + codebooks: 12.5 Hz · 8 codebooks · 4.4 kbps。10 s = 1,000 tokens。
- Tokenization: text + speaker reference からまず codebook 0 を予測し、次に codebook 0 + speaker reference を条件に codebooks 1-7 を予測します (depth-transformer pattern)。
- Decoder: Mimi の built-in decoder。external vocoder は不要です。
- Training: text-to-codec LM を訓練し、Mimi は freeze します。
