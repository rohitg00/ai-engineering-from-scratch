---
id: pre-tokenization-regex
title: What the split before the merges is for
card: tokenization-decoding
kind: concept
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [coding, ml-depth]
tags: [pre-tokenization, regex, bpe, whitespace, word-boundaries]
minutes: 8
lessons: [phases/10-llms-from-scratch/02-building-a-tokenizer, phases/19-capstone-projects/30-bpe-tokenizer-from-scratch, phases/05-nlp-foundations-to-advanced/19-subword-tokenization]
manuals: []
practice: []
cheatsheet: [tokenization]
related: [tokenization-decoding/bpe-training-loop]
updated: 2026-11-03
---

Before any merge runs, a production tokenizer cuts the text into chunks with a regular expression. Show me what the classic pattern does to `Hello, world! Don't stop.` and explain why the cut exists at all, given that the merges could run on the raw stream.

## Short answer

The pattern cuts the sentence into eight chunks, `Hello`, `,`, ` world`, `!`, ` Don`, `'t`, ` stop` and `.`: each word after the first keeps the space in front of it, contractions split at the apostrophe, and punctuation stands alone. The merges then run inside each chunk and can never join symbols across a chunk boundary. Without the cut, training learns merges that span words, the vocabulary fills with whole phrases, and the pieces generalize worse to new text.

## Full answer

### The pattern

```text
'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+
```

In order: common contraction endings, a word with an optional leading space, a run of digits with an optional leading space, a run of punctuation, and whitespace. The `\p{L}` and `\p{N}` classes need the third-party `regex` module; the standard library falls back to ASCII classes, which is wrong for multilingual text.

### Why the leading space travels with the word

` hello` and `hello` are different tokens. Keeping the space on the word means a word-initial piece and a word-internal piece stay distinct, and the decoder can rebuild the spacing from the tokens alone. The same reason forces every caller to be explicit about whether a prefix space is added at the start of a prompt.

### Why cut at all

The merge loop is greedy on frequency. In a raw stream the pair "e" followed by a space followed by "t" is frequent, so the loop would happily learn a piece that ends one word and starts the next. Such pieces do not transfer: the next text has different word pairs. Cutting first keeps every merge inside a word, which is where the regularities that generalize live.

### The other design

A tokenizer that works on raw text treats the space as an ordinary symbol and lets the merge or prune algorithm find the boundaries. It needs no language rules and handles scripts without spaces, and it allows cross-word pieces, which can compress a little better and read a little worse.

### The capstone's version

A small split on whitespace and punctuation. It is enough to keep merges inside words for a small training set, and the rest of the pipeline stays the same.

## Follow-ups

- **Level 2:** Why does a prompt that starts without a space tokenize differently from one that starts with a space? Expected: the space is part of the word-initial token, so the first word maps to a different id; set the prefix-space behavior explicitly.
- **Level 3:** Why does the `regex` module matter for this pattern? Expected: the Unicode letter and number classes cover scripts beyond ASCII, which the standard library's engine lacks.
- **Level 3:** What is the trade in skipping the cut and running on raw text? Expected: no language rules and good behavior for scripts without spaces, against cross-word pieces that compress slightly better and are less interpretable.
- **Level 3:** A tokenizer file is unchanged but ids differ between two machines. What in this stage can cause it? Expected: one machine fell back to the ASCII pattern because the `regex` module was missing, so the chunks differ.

## Wrong answers

- "Pre-tokenization is just splitting on spaces." The pattern also handles contractions, digits, punctuation and runs of whitespace, and it keeps the space attached to the word.
- "The cut is cosmetic; the merges would find the same pieces." Without the cut the merges cross word boundaries and the vocabulary fills with phrases.
- "Attach punctuation to the word it follows." Then `world!` and `world` are different pieces, and the vocabulary pays for every punctuation variant.

## Taught in

The [tokenizer build lesson](../../../phases/10-llms-from-scratch/02-building-a-tokenizer/) gives the pattern and its output, the [BPE capstone](../../../phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/) explains why merges stay inside words, and the [subword lesson](../../../phases/05-nlp-foundations-to-advanced/19-subword-tokenization/) lists the whitespace pitfall.
