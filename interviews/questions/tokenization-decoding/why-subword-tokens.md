---
id: why-subword-tokens
title: Why models read subwords and start from bytes
card: tokenization-decoding
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [screen, ml-breadth]
tags: [tokenization, subword, byte-level-bpe, unknown-token, vocabulary]
minutes: 6
lessons: [phases/05-nlp-foundations-to-advanced/19-subword-tokenization, phases/10-llms-from-scratch/01-tokenizers]
manuals: []
practice: []
cheatsheet: [tokenization]
related: []
updated: 2026-11-03
---

Why does every current language model read subword tokens instead of whole words or single characters, and why do most of them build the vocabulary on top of raw bytes?

## Short answer

A word vocabulary cannot hold every word, so each new word becomes an unknown token and the model loses the signal. Characters never fail, but they make sequences several times longer and spend attention on spelling. Subwords keep common words whole and split rare words into meaningful pieces, and starting from the 256 byte values means any input in any script encodes with zero unknown tokens.

## Full answer

### The three options

| Level | Vocabulary | Failure |
|---|---|---|
| Word | huge, and still incomplete | unknown token for anything unseen; English alone has over a million word forms |
| Character | a few hundred | a 10-word sentence becomes about 50 tokens; the model relearns that t, h, e spell a word |
| Subword | 30K to 128K | none of the above; rare words split into pieces |

A rare word such as "unhappiness" is 11 character tokens or 3 subword pieces: un, happi, ness. The pieces carry meaning the model can reuse.

### Why bytes at the bottom

A byte-level vocabulary treats each of the 256 byte values as a base token and learns merges on top. Any string in any encoding is a byte sequence, so nothing is ever unknown, and no language needs special handling. A well-known 50,257-token vocabulary is exactly 256 bytes plus 50,000 merges plus one special token.

### Why it is architecture, not preprocessing

The tokenizer fixes what the model sees for its whole life. A vocabulary that splits a common word into four pieces wastes context and compute on every request, and the choice cannot be undone after training. Pricing is per token and latency is per token, so the tokenizer sits in the cost model too.

## Follow-ups

- **Level 1:** What does fertility measure? Expected: the average number of tokens per word; 1.0 is one token per word and higher means the model works harder for the same text.
- **Level 2:** Why does the unknown token disappear with byte-level vocabularies? Expected: every byte is itself a token, so any input decomposes into known tokens before any merge applies.
- **Level 2:** What does a tiny vocabulary cost at inference? Expected: longer sequences, so more forward passes per answer and less text per context window.
- **Level 3:** Why can you not fix a bad tokenizer after training? Expected: the embedding rows and every weight were trained against those ids; new ids have no learned meaning and old text would map differently.

## Wrong answers

- "Characters are the safest choice because nothing is ever unknown." Bytes give the same guarantee, and characters make every sequence several times longer.
- "A bigger word list solves the unknown problem." New words, misspellings, code and other languages keep appearing; no word list is complete.
- "A token is a word." A token can be a byte, a piece of a word, a word, or a short phrase, depending on the merges.

## Taught in

The [subword tokenization lesson](../../../phases/05-nlp-foundations-to-advanced/19-subword-tokenization/) compares the algorithms and the [tokenizers lesson](../../../phases/10-llms-from-scratch/01-tokenizers/) works the three options through on examples.
