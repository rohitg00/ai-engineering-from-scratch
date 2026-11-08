---
id: tokenizer-roundtrip-specials
title: A byte-level tokenizer with protected special tokens
card: coding
kind: take-home
level: 4
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [coding, take-home]
tags: [bpe, special-tokens, round-trip, pre-tokenization]
minutes: 45
lessons: [phases/19-capstone-projects/30-bpe-tokenizer-from-scratch, phases/10-llms-from-scratch/02-building-a-tokenizer]
manuals: []
practice: [bpe-merge-step]
cheatsheet: [tokenization]
related: [coding/bpe-train-loop, coding/bpe-merge-no-overlap]
updated: 2026-11-03
---

Design and implement a tokenizer for a small language model: train it on a corpus, encode fresh text, decode ids back, and reserve two special tokens for document boundaries and padding. State the guarantees the test suite must pin, and explain how the special tokens survive both training and inference without ever being merged.

## Short answer

The base symbols are the 256 raw bytes, so every input has an encoding before any merge and decoding always terminates in bytes. Training runs on pre-tokenized chunks that never contain the special strings, so no merge can produce or consume a special id. At inference a matcher splits the text on the special strings first, maps each one to its reserved id, and runs the merge table on the text between them in training order. The suite pins the round trip on unseen text, on text with multi-byte characters, and on text that contains a literal special string with the flag off.

## Full answer

### The pipeline

1. Normalize the text to one Unicode form so that the same visible word gets the same bytes.
2. Split on the special strings when the caller allows them, and map each match to its reserved id.
3. Pre-tokenize the remaining text into chunks at whitespace and punctuation boundaries.
4. Apply the merge table to each chunk's bytes in training order, with non-overlapping left-to-right replacement.
5. Concatenate the ids.

Decoding reverses steps two to five: expand each id to its bytes, where a merged id expands to the bytes of its two parents and a reserved special id expands to the UTF-8 bytes of its string, and decode the byte string. Normalization is not reversible. A decomposed accent comes back as the composed character, so the round trip is exact only for text that is already in the normalized form.

### Why pre-tokenization

Without the split, merges cross word boundaries and the vocabulary fills with common phrases that do not generalize. The split keeps merges inside a word. The chunk boundaries also stop a merge from spanning the end of one word and the start of the next at inference, which is how training and inference stay consistent.

### Special tokens

The ids after the byte block are reserved by hand. The training loop never sees the special strings, because the corpus is split and the strings are removed before pair counting, so no merge target can be a special id and no merge can include one. At inference the encoder takes a flag. With the flag off, the characters of a special string are ordinary bytes and tokenize as such. With the flag on, the exact string maps to its reserved id and is not subject to any merge. The matcher tries longer special strings first so that one string that contains another is matched whole.

### The guarantees to pin

| Guarantee | Test |
|---|---|
| Round trip on unseen text | encode then decode returns the exact bytes of the normalized input |
| Multi-byte characters | a sentence with a four-byte emoji round-trips |
| Literal special string, flag off | the string decodes back as text, not as a boundary |
| Special string, flag on | exactly one id, the reserved one, appears |
| Merge order | the same merge list gives the same ids on repeated encodes |
| Reserved range | no merge in the table has a special id as a parent or a child |

### The compression curve

The number of ids for a held-out sentence falls as the merge budget grows. Training with a target vocabulary of 300 and then of 600 ids on the lesson corpus shows the drop directly; that curve is the measurement that justifies the vocabulary size.

## Follow-ups

- **Level 3:** Why are the first 256 ids reserved for bytes rather than for the characters of the corpus? Expected: any input, including text in scripts the corpus never had, can then be encoded without an unknown token.
- **Level 4:** Where do chat template markers fit in this design? Expected: they are special tokens like the boundary token, matched exactly before the merges, with fixed ids that the model was trained on; a wrong template puts the input outside the training distribution.
- **Level 4:** How do you protect a deployed model from a tokenizer that drifts? Expected: hash the merge table and the special-token map, and check the hash in the pipeline before training and before serving; a different table decodes different ids.

## Wrong answers

- "Add the special tokens to the corpus so the model learns them." Then they can be merged with neighbors and stop being single ids.
- "Match special strings after the merges." The merges have already split the string into byte pieces, so the matcher never sees it.
- "Decode by looking up a string per id in a dictionary." Ids are bytes, and a multi-byte character can be split across ids; concatenate bytes first, then decode.

## Taught in

The [BPE from scratch lesson](../../../phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/) gives the byte floor, the reserved specials and the round-trip tests, the [production tokenizer lesson](../../../phases/10-llms-from-scratch/02-building-a-tokenizer/) adds normalization, pre-tokenization and exact matching of special strings, and the [BPE practice](../../../practice/bpe-merge-step/) is the merge step inside it.
