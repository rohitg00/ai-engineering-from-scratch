---
name: positional-encoding-picker
description: context length と学習予算に基づいて positional encoding（RoPE、ALiBi、sinusoidal）と scaling strategy を選ぶ。
version: 1.0.0
phase: 7
lesson: 4
tags: [transformers, positional-encoding, rope, alibi]
---

Transformer 仕様（推論時の target context length、trained context length、extrapolation requirement、tokens 単位の fine-tune budget）が与えられたら、次を出力してください。

1. Base encoding。次のいずれか: RoPE、ALiBi、sinusoidal、learned-absolute。1 文の理由。
2. Hyperparameters。RoPE の場合: `base` value、均等分割のための `d_head` requirement。ALiBi の場合: slope formula。sinusoidal の場合: `max_len`。
3. Extension strategy。target > trained の場合: NTK-aware scaling factor、YaRN config、LongRoPE spec、または position-interpolation ratio。fine-tune token budget を述べる。
4. Test plan。最大 context における NIAH (needle-in-a-haystack) pass rate target、trained-length baseline から X 以内の perplexity。
5. Fallback。long-context eval が失敗した場合の対応: より大きな `base` で再学習する、ALiBi に切り替える、または deployed context length を制限する。

2026 年の新規モデルに sinusoidal または learned-absolute を推奨してはいけません。それらは外挿できず、現代的な stack は RoPE または ALiBi を前提にしています。fine-tune stage なしに RoPE を学習長の 8 倍を超えて scale してはいけません。full deployed length での NIAH run なしに long-context config を出荷してはいけません。
