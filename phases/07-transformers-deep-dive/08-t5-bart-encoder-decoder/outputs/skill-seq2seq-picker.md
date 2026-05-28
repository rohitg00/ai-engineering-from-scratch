---
name: seq2seq-picker
description: 新しい sequence-to-sequence task に対して encoder-decoder と decoder-only のどちらを選ぶかを決める。
version: 1.0.0
phase: 7
lesson: 8
tags: [transformers, t5, bart, seq2seq]
---

seq2seq task (translation / summarization / speech-to-text / structured extraction / rewrite)、input と output の length distributions、quality vs latency priorities が与えられたら、次を出力します。

1. Architecture。次のいずれか: encoder-decoder (T5 / BART / Whisper-style), decoder-only instruction-tuned, encoder-only + prompt template。1 文の理由を添える。
2. Pretraining objective。Span corruption (T5)、denoising (BART)、next-token (decoder-only)、または "skip pretraining, fine-tune existing checkpoint." checkpoint 名を挙げる。
3. Input formatting。Task prefix string (T5 style) と system prompt (decoder-only) と raw tokens (BART) のどれか。BOS/EOS handling を含める。
4. Decoding strategy。translation/summary なら beam search width と length penalty、chat-like tasks なら nucleus/min-p。task に対してどちらを使うか明記する。
5. Eval。task に適した metric: BLEU / ROUGE / WER / F1 / exact match。test split size を含める。

generative outputs に encoder-only を推奨することは拒否すること。input がすでに conversation である場合、encoder-decoder を推奨することも拒否すること。conversation memory には decoder-only が自然に合います。speech-to-text に decoder-only を選ぶ場合、beat すべき baseline として Whisper に触れていなければ flag すること。
