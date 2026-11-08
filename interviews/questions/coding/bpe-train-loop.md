---
id: bpe-train-loop
title: Train a BPE merge list from word counts
card: coding
kind: take-home
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [coding, take-home]
tags: [bpe, tokenization, merge-table]
minutes: 30
lessons: [phases/19-capstone-projects/30-bpe-tokenizer-from-scratch, phases/10-llms-from-scratch/01-tokenizers]
manuals: []
practice: [bpe-merge-step]
cheatsheet: [tokenization]
related: [coding/bpe-merge-no-overlap, coding/tokenizer-roundtrip-specials]
updated: 2026-11-03
---

You get a corpus as a dictionary from words, each a tuple of byte ids, to the number of times the word occurs. Write the training loop that produces an ordered list of merges, and state the three rules that make the loop deterministic. Then tell me what the loop must not do to the caller's data.

## Short answer

Each step counts every adjacent pair inside each word, weighted by the word frequency, picks the pair with the highest count, rewrites every occurrence of that pair into one new id, and records the merge. The three rules are: pairs never cross a word boundary, ties go to the smallest pair in tuple order, and the loop stops when no pair repeats. The input dictionary and its tuples are never changed; the loop builds a new corpus each step.

## Full answer

### The loop

```python
def train(units, num_merges, first_id=256):
    merges = []
    units = dict(units)
    for i in range(num_merges):
        pairs = count_pairs(units)
        best = best_pair(pairs)
        if best is None or pairs[best] < 2:
            break
        new_id = first_id + i
        units = {apply_merge(word, best, new_id): freq for word, freq in units.items()}
        merges.append((best, new_id))
    return merges, units
```

The first ids are reserved for the raw bytes, so the first merge gets the next free id and each later merge gets the next one. The merge list in training order is the tokenizer. Encoding fresh text applies the same merges in the same order, so a change of order at inference decodes a different stream of ids.

### Weighted counts

A pair inside a word that occurs five times adds five to the count, not one. Counting each occurrence once makes rare long words outvote common short ones, and the merge order changes. Pairs do not cross from the end of one word to the start of the next; the word split is what keeps merges inside words and lets them generalize.

### Ties and the stop rule

Two pairs with the same count must resolve the same way on every run, so the smallest pair in tuple order wins. Without a fixed rule, dictionary order decides and two training runs on the same corpus produce different tokenizers. The loop stops early when the best count is below two, because a pair that occurs once does not compress anything and only spends vocabulary slots.

### Do not change the input

The caller's dictionary and tuples stay as they were. Clearing and refilling the dictionary in place, or rewriting tuples through a list, changes data the caller may still use. Each step builds a new dictionary from the merged words.

## Follow-ups

- **Level 2:** Why does the symbol count fall as training proceeds, and what does that do to the cost of a step? Expected: each merge shortens words, so the pair count over the corpus shrinks and later steps are cheaper.
- **Level 2:** What does the tie rule protect? Expected: reproducibility; the same corpus must give the same merge list on every machine.
- **Level 3:** Two words merge into the same tuple after a step. What must the new dictionary do? Expected: add their frequencies together instead of keeping only the last one.
- **Level 3:** How does the vocabulary size relate to the number of merges? Expected: the base byte block plus one id per merge, plus any reserved special ids.

## Wrong answers

- "Count each pair once per word." Frequency weighting is what makes common pairs win early.
- "Take the first pair with the maximum count." Dictionary order is not stable across inputs, so the tokenizer becomes irreproducible.
- "Keep merging until the budget is spent." A pair that appears once gains nothing and wastes vocabulary.

## Taught in

The [BPE from scratch lesson](../../../phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/) gives the training loop and the merge table contract, the [tokenizers lesson](../../../phases/10-llms-from-scratch/01-tokenizers/) walks a merge sequence by hand, and the [BPE practice](../../../practice/bpe-merge-step/) checks the tie rule and the stop rule.
