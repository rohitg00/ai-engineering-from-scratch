---
id: split-heads-reshape
title: Split heads with the right shape and the wrong numbers
card: coding
kind: code-reading
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, debugging]
tags: [multi-head-attention, reshape, transpose]
minutes: 8
lessons: [phases/07-transformers-deep-dive/03-multi-head-attention]
manuals: []
practice: [multi-head-split-merge]
cheatsheet: [transformers-attention]
related: [coding/output-projection-missing, coding/gqa-repeat-not-tile]
updated: 2026-11-03
---

A submission splits a tensor of shape batch, tokens, features into heads with one call:

```python
def split_heads(x, n_heads):
    B, T, D = x.shape
    return x.reshape(B, n_heads, T, D // n_heads)
```

The shape test passes and every attention test fails. Explain what the function actually did to the data and write the correct version.

## Short answer

The reshape alone reinterprets memory. It keeps the bytes in order and relabels them, so the head axis cuts across tokens and features instead of slicing the feature axis. The correct split reshapes to batch, tokens, heads, head size and then transposes the token and head axes, so that head `h` holds a contiguous block of `d_head` neighbor columns for every token.

## Full answer

### What the bug does

Row-major memory lists features of token zero, then features of token one, and so on. Reshaping straight to batch, heads, tokens, head size slices that flat list into equal pieces. The first "head" then holds the first `T` times `d_head` numbers, which are the complete feature vectors of the first few tokens, not a slice of every token. Shapes agree. Numbers are scrambled.

### The fix

```python
def split_heads(x, n_heads):
    B, T, D = x.shape
    if D % n_heads:
        raise ValueError("features must divide into heads")
    d_head = D // n_heads
    return x.reshape(B, T, n_heads, d_head).transpose(0, 2, 1, 3)


def merge_heads(x):
    B, H, T, d_head = x.shape
    return x.transpose(0, 2, 1, 3).reshape(B, T, H * d_head)
```

Reshape to batch, tokens, heads, head size first, which only splits the last axis. Then transpose so the head axis comes before the token axis. The merge is the same two operations in reverse. One reshape and one transpose, no loop; that is also what the framework version does under the hood.

### The strided variant of the bug

A second wrong version gives head `h` the columns `h`, `h + H`, `h + 2H` and so on. That slices the feature axis, so the per-head attention runs, but it does not match the convention that a head owns one contiguous block of columns, and a checkpoint trained with the standard layout no longer loads into it.

### How to test it

`merge_heads(split_heads(x, H))` must return `x` exactly, and `split_heads(x, H)[b, h, t, j]` must equal `x[b, t, h * d_head + j]`. The second check is the one that fails for both wrong versions.

## Follow-ups

- **Level 2:** Why does the round-trip test catch the plain reshape bug? Expected: `merge_heads` transposes the head and token axes before it reshapes, so it does not undo a plain reshape and the features come back in a different order; only a merge written as a plain reshape would hide the bug.
- **Level 2:** What does the scale factor become after the split? Expected: the square root of the head size, not of the full feature dimension.
- **Level 3:** After the split, how does attention run for all heads at once? Expected: as one batched matmul over the leading batch and head axes, so adding heads costs no extra kernel launches.

## Wrong answers

- "Reshape is the same as transpose for equal sizes." Reshape relabels memory in place; transpose reorders it.
- "Any split works as long as merge undoes it." The attention tests and any loaded checkpoint depend on each head owning one block of neighbor columns.
- "Loop over heads and slice columns." It is correct but slow; the reshape and transpose give the same result in two operations.

## Taught in

The [multi-head attention lesson](../../../phases/07-transformers-deep-dive/03-multi-head-attention/) gives the split and combine pair as a reshape followed by a transpose, and the [split and merge practice](../../../practice/multi-head-split-merge/) checks each element of the split.
