---
id: bpe-wordpiece-unigram
title: Three ways to build a subword vocabulary
card: tokenization-decoding
kind: tradeoff
level: 2
roles: [applied-ai-engineer, ai-data-engineer]
rounds: [ml-breadth, screen]
tags: [bpe, wordpiece, unigram, sentencepiece, vocabulary]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/19-subword-tokenization, phases/10-llms-from-scratch/01-tokenizers]
manuals: []
practice: []
cheatsheet: [tokenization]
related: [tokenization-decoding/bpe-training-loop]
updated: 2026-11-03
---

Three subword algorithms dominate: byte-pair encoding, WordPiece and Unigram. Contrast how each builds its vocabulary, tell me which one can give two different segmentations of the same word on purpose, and name the libraries you would reach for.

## Short answer

Byte-pair encoding merges the most frequent adjacent pair, bottom up. WordPiece also merges bottom up but scores a pair by the count of the merged piece over the product of the counts of its parts, so it prefers pairs that co-occur more than chance, and it marks continuation pieces with a double-hash prefix. Unigram works top down: it starts from a large candidate set, assigns each piece a probability, and prunes the pieces whose removal hurts the corpus likelihood least, which is why it can also sample alternative segmentations for regularization.

## Full answer

### The criteria side by side

```text
BPE merge criterion:        count(A, B)
WordPiece merge criterion:  count(AB) / (count(A) * count(B))
Unigram:                    prune the piece whose removal least lowers the corpus log-likelihood
```

The first asks which pair appears most. The second asks which pair appears together more often than you would expect from its parts. The third asks which pieces the corpus can best do without.

### Who uses what

| Algorithm | Direction | Marker | Used by |
|---|---|---|---|
| Byte-pair encoding | merge up | leading space kept on word-initial pieces | most decoder families, with vocabularies of 50,257, 128,256 and more |
| WordPiece | merge up by likelihood ratio | `##` for continuation pieces | the classic encoder with 30,522 tokens |
| Unigram | prune down | `▁` for a space when trained without pre-tokenization | an encoder-decoder family with 32,000 tokens |

### Sampling segmentations

A Unigram model is probabilistic at inference. It can return the most likely segmentation or sample another one, which gives subword regularization during training: the same word arrives in several forms and the model learns pieces more robustly. The merge-based algorithms are deterministic.

### Libraries

One library trains vocabularies for either the merge or the prune algorithm directly on raw text, encoding the space as a visible symbol and needing no pre-tokenization, which is why it is the default for multilingual work. A second, Rust-backed encoder is fast and matches the vocabularies of a widely used API family, but it only encodes. A third library trains and serves both algorithms in one place.

### Picking

Training a monolingual model: byte-pair encoding. Training multilingual: Unigram with a character coverage near 0.9995. Serving against an existing API vocabulary: the encoder-only library. Edge inference with a small model: Unigram with a smaller vocabulary.

## Follow-ups

- **Level 2:** What is subword regularization? Expected: training on sampled segmentations from a Unigram model so the same word appears in several forms.
- **Level 2:** What does the visible-space symbol buy? Expected: the space becomes an ordinary symbol, so the tokenizer needs no pre-tokenization and works for scripts without spaces.
- **Level 3:** Which algorithm and setting for a multilingual vocabulary? Expected: Unigram trained on raw text with character coverage near 0.9995, so rare scripts are kept rather than mapped to unknown.
- **Level 3:** Why can an encode-only library not train your tokenizer? Expected: it ships pre-built vocabularies and a fast encoder; the training step lives in the other two libraries.

## Wrong answers

- "WordPiece and byte-pair encoding give the same vocabulary on the same corpus." The criteria differ, so the merges differ; the likelihood ratio favors surprising pairs over merely frequent ones.
- "Unigram is deterministic like the merge algorithms." It is probabilistic and can sample segmentations on purpose.
- "The library that encodes the space as a symbol is itself an algorithm." It is a library that trains either the merge or the prune algorithm on raw text.

## Taught in

The [subword tokenization lesson](../../../phases/05-nlp-foundations-to-advanced/19-subword-tokenization/) contrasts the three algorithms and the libraries, and the [tokenizers lesson](../../../phases/10-llms-from-scratch/01-tokenizers/) gives the merge criteria and the vocabulary sizes.
