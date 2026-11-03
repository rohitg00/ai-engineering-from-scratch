---
id: bpe-training-loop
title: One step of byte-pair training and what it leaves behind
card: tokenization-decoding
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [screen, coding]
tags: [bpe, merge-table, training, pair-counting, determinism]
minutes: 6
lessons: [phases/10-llms-from-scratch/01-tokenizers, phases/19-capstone-projects/30-bpe-tokenizer-from-scratch, phases/05-nlp-foundations-to-advanced/19-subword-tokenization]
manuals: []
practice: [bpe-merge-step]
cheatsheet: [tokenization]
related: [tokenization-decoding/why-subword-tokens]
updated: 2026-11-03
---

Walk me through one training step of byte-pair encoding on a small corpus, and tell me what the trained artifact actually is.

## Short answer

Start with every word split into base symbols, bytes or characters. Count every adjacent pair across the corpus, weighted by how often each word appears, merge the most frequent pair into one new symbol with the next free id, rewrite every occurrence, and repeat until the vocabulary reaches the target size. The artifact is the ordered list of merges; the vocabulary follows from it, and the same list applied in the same order is what encoding uses later.

## Full answer

### A worked step

Corpus: "lower" 5 times, "lowest" 2 times, "newest" 6 times.

```text
l o w e r      (x5)
l o w e s t    (x2)
n e w e s t    (x6)

pair counts: (w,e): 13   (e,s): 8   (s,t): 8   (l,o): 7   (o,w): 7   (n,e): 6   (e,r): 5
merge (w,e) -> we

l o we r       (x5)
l o we s t     (x2)
n e we s t     (x6)
```

Recount, and the next step sees (we,s) and (s,t) tied at 8. The lesson's implementation breaks ties by sorting on the pair itself, so two runs over the same corpus produce the same table. After enough steps "west" exists as one symbol.

### The three facts the loop encodes

1. Frequency weighting makes the pairs of common words win early.
2. A pre-split on whitespace and punctuation keeps merges inside a word. A word-end marker also keeps "low" as a whole word distinct from "low" as the start of "lower".
3. The merge list is ordered. Encoding applies merges in training order, so the order is part of the artifact.

### Byte level

With bytes as the base, the first 256 ids are the byte values and merge k gets id 256 plus k. The cost of one step is linear in the corpus as a list of symbol sequences, and the sequences shrink as merges land, so a million words to ten thousand ids runs in seconds.

### What you ship

The merge table and the special-token table. The vocabulary of byte strings can be rebuilt from them.

## Follow-ups

- **Level 1:** Why weight pairs by word frequency instead of counting each distinct word once? Expected: the merges should serve the text the model will see, and common words appear many times.
- **Level 2:** Why must a tie in pair counts be broken deterministically? Expected: two training runs on the same corpus must produce the same table, or the same text would get different ids.
- **Level 2:** What happens to the encoded length of a sentence as the target vocabulary grows from 300 to 600? Expected: it falls, because more merges cover longer pieces; that curve is the compression curve.
- **Level 3:** Why split the corpus into words before you count pairs? Expected: without it, merges cross word boundaries and the vocabulary fills with whole phrases that do not generalize.

## Wrong answers

- "BPE picks the pair that makes the most meaningful piece." It picks the most frequent pair; meaning is a side effect, and the likelihood-based variant is a different algorithm.
- "The vocabulary is the artifact; the merge list can be discarded." Encoding needs the merges in order; the vocabulary alone does not say how to split new text.
- "All merges are chosen at once from the initial pair counts." Each merge changes the counts, so the loop recounts after every step.

## Taught in

The [tokenizers lesson](../../../phases/10-llms-from-scratch/01-tokenizers/) works the example, the [BPE capstone](../../../phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/) builds the loop with deterministic ties, and the [subword lesson](../../../phases/05-nlp-foundations-to-advanced/19-subword-tokenization/) names the three facts.
