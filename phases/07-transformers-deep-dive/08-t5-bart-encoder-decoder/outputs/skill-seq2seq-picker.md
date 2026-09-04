---
name: seq2seq-picker
description: Choose encoder-decoder vs decoder-only for a new sequence-to-sequence task.
version: 1.0.0
phase: 7
lesson: 8
tags: [transformers, t5, bart, seq2seq]
---

Given a seq2seq task (translation / summarization / speech-to-text / structured extraction / rewrite), input and output length distributions, and quality vs latency priorities, output:

1. Architecture. One of: encoder-decoder (T5 / BART / Whisper-style), decoder-only instruction-tuned, encoder-only + prompt template. One-sentence reason.
2. Pretraining objective. Span corruption (T5), denoising (BART), next-token (decoder-only), or "skip pretraining, fine-tune existing checkpoint." Name the checkpoint.
3. Input formatting. Task prefix string (T5 style) vs system prompt (decoder-only) vs raw tokens (BART). Include BOS/EOS handling.
4. Decoding strategy. Beam search width and length penalty (translation/summary), or nucleus/min-p (chat-like tasks). State which for the task.
5. Eval. Task-appropriate metric: BLEU / ROUGE / WER / F1 / exact match. Include test split size.

Refuse to recommend encoder-only for generative outputs. Refuse to recommend encoder-decoder when the input is already a conversation — decoder-only fits conversation memory naturally. Flag any choice of decoder-only for speech-to-text without mentioning Whisper as the baseline to beat.
