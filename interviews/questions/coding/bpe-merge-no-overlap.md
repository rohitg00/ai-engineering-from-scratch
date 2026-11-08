---
id: bpe-merge-no-overlap
title: A merge that lets two matches share a symbol
card: coding
kind: code-reading
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [coding, debugging]
tags: [bpe, tokenization, off-by-one]
minutes: 8
lessons: [phases/10-llms-from-scratch/01-tokenizers, phases/19-capstone-projects/30-bpe-tokenizer-from-scratch]
manuals: []
practice: [bpe-merge-step]
cheatsheet: [tokenization]
related: [coding/bpe-train-loop]
updated: 2026-11-03
---

This function rewrites one word after a BPE merge was chosen. On the word `(7, 7, 7)` with the pair `(7, 7)` it returns `(300, 300, 7)`. Find the bug and give the correct output.

```python
def apply_merge(symbols, pair, new_id):
    out = []
    i = 0
    while i < len(symbols):
        if i + 1 < len(symbols) and symbols[i] == pair[0] and symbols[i + 1] == pair[1]:
            out.append(new_id)
            i += 1
        else:
            out.append(symbols[i])
            i += 1
    return tuple(out)
```

## Short answer

After a match the scan moves one position instead of two, so the second symbol of the match is read again: it starts the next match or is copied to the output. Matches must not share a symbol. The correct result is `(300, 7)`: the first two sevens become one new id and the third seven stays.

## Full answer

### What the bug does

With a step of one after a match, the scan sees the pair at positions zero and one, emits the new id, and then looks at positions one and two, which also match. The word gains a symbol it never had, so the merged corpus is wrong and every later step counts pairs on corrupted words. Encoding at inference reuses the same function, so every text with a repeated symbol decodes to different bytes than it was given.

### The fix

```python
        if i + 1 < len(symbols) and symbols[i] == pair[0] and symbols[i + 1] == pair[1]:
            out.append(new_id)
            i += 2
```

Scan from left to right and continue after the second symbol of the match. The merge loop in the tokenizers chapter is exactly this, and the practice task has a mutant for the single step that fails on `[a, a, a]`.

### Why the left-to-right rule matters

Non-overlapping replacement from the left is a convention, and the training loop and the encoder must share it. If training merged from the left and the encoder merged from the right, the same word would get different ids in training and at inference. The merge table only works when both sides apply it the same way.

### A related check

The function returns a new tuple. It must not write into the caller's sequence, because the training loop still holds the old corpus while it builds the new one.

## Follow-ups

- **Level 2:** What does the same bug do to the pair counts of the next training step? Expected: it counts pairs that do not exist in the real corpus, so later merges are chosen on wrong numbers.
- **Level 2:** Give an input where the bug produces a correct answer. Expected: only a word with no match for the pair, such as `(7, 8, 7)` with `(7, 7)`; every match leaves an extra copy of its second symbol.
- **Level 3:** How does a round-trip test catch this bug? Expected: encode a string with a repeated byte, decode the ids, and compare the bytes; the extra merged symbol expands to more bytes than the input had.

## Wrong answers

- "Replace the pair with a string method on the joined symbols." Ids are integers, not characters, and joining them hides the boundaries between ids.
- "Match from the right instead." Either direction works alone, but training and inference must use the same one; left-to-right is the convention.
- "Return a list instead of a tuple to make it faster." The words are dictionary keys and must stay hashable.

## Taught in

The [tokenizers lesson](../../../phases/10-llms-from-scratch/01-tokenizers/) writes the merge loop with the two-position step, the [BPE from scratch lesson](../../../phases/19-capstone-projects/30-bpe-tokenizer-from-scratch/) explains the shared merge contract, and the [BPE practice](../../../practice/bpe-merge-step/) tests the overlap case.
