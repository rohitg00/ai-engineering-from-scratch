---
id: merge-order-at-encode
title: Why the encoder replays the merge list in order
card: tokenization-decoding
kind: concept
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [coding, ml-depth]
tags: [bpe, merge-rank, encoding, determinism, tokenizer]
minutes: 8
lessons: [phases/10-llms-from-scratch/01-tokenizers, phases/19-capstone-projects/30-bpe-tokenizer-from-scratch, phases/05-nlp-foundations-to-advanced/19-subword-tokenization]
manuals: []
practice: [bpe-merge-step]
cheatsheet: [tokenization]
related: [tokenization-decoding/bpe-training-loop]
updated: 2026-11-03
---

At encode time a BPE tokenizer holds the complete merge table. Why does it have to replay the merges in the order they were learned, and what goes wrong when two merges could fire at the same spot?

## Short answer

Encoding must reproduce what training did to the same text, and training saw the merges one at a time in that order. If merge one created "th" and merge five created "the" from "th" plus "e", then "the" can only form after "th" exists. When two merges could apply at one position, the one with the lower rank, learned earlier, wins; change that rule and the same text yields different ids, so the model sees a distribution of ids it was never trained on.

## Full answer

### The naive encoder

```python
def encode_bpe(word, merges):
    symbols = list(word) + ["</w>"]
    for a, b in merges:
        i = 0
        while i < len(symbols) - 1:
            if symbols[i] == a and symbols[i + 1] == b:
                symbols = symbols[:i] + [a + b] + symbols[i + 2:]
            else:
                i += 1
    return symbols
```

It walks the whole table for every word, so the cost is the word length times the number of merges. Correct for a merge table trained on characters, and slow.

### The rank-based encoder

The capstone version starts from the byte split and repeats: find the applicable merge with the lowest rank anywhere in the current sequence, apply it, and scan again, until no merge in the table applies. Production encoders keep the same semantics with a rank lookup and a priority queue of candidate pairs, which runs in close to linear time.

### Why the rule is the contract

The training loop and the encoder share the merge table, and that sharing is the whole contract. Training merged the most frequent pair first, so an input that contains both halves of an early merge was always merged that way in the training data. An encoder that prefers a later merge, or the longest piece, produces a segmentation the model never saw. Nothing crashes; the ids are simply different.

### What special tokens do here

Reserved strings such as the end-of-text marker are matched exactly before the merge loop runs and mapped to fixed ids. They never take part in a merge, so no table order can split or join them.

## Follow-ups

- **Level 2:** Why is the naive loop slow? Expected: it scans the full merge table for every word, so the cost grows with the table size times the word length.
- **Level 3:** How do production encoders get close to linear time? Expected: a rank lookup for each adjacent pair and a priority queue that always surfaces the lowest-ranked applicable merge.
- **Level 3:** Two tokenizers were trained on different corpora to the same vocabulary size. Do they give the same ids? Expected: no; different corpora give different merge tables and different ranks.
- **Level 3:** What test pins the order? Expected: encode a held-out word and compare with recorded ids; the capstone's tests also pin the round trip and the special-token reservation.

## Wrong answers

- "Greedily take the longest token in the vocabulary that matches." That is a different algorithm and gives a different segmentation from the training run.
- "Order does not matter because merges commute." A later merge depends on the symbols that earlier merges created, so they do not commute.
- "Sort the merges by token length." Length is not rank; a long piece may have been learned early and a short one late.

## Taught in

The [tokenizers lesson](../../../phases/10-llms-from-scratch/01-tokenizers/) explains the ordered table, the [BPE capstone](../../../phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/) implements the rank-based encoder, and the [subword lesson](../../../phases/05-nlp-foundations-to-advanced/19-subword-tokenization/) gives the naive loop and its cost.
