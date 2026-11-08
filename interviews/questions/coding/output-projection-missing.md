---
id: output-projection-missing
title: Attention heads that never mix
card: coding
kind: debug
level: 3
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, debugging, ml-depth]
tags: [multi-head-attention, output-projection, softmax-axis]
minutes: 10
lessons: [phases/07-transformers-deep-dive/03-multi-head-attention]
manuals: []
practice: [multi-head-split-merge]
cheatsheet: [transformers-attention]
related: [coding/split-heads-reshape, coding/gqa-repeat-not-tile]
updated: 2026-11-03
---

A multi-head attention forward passes the split and merge tests but fails the end-to-end test against a reference, and a trained checkpoint loaded into it generates nonsense:

```python
def multi_head_attention(x, w_q, w_k, w_v, w_o, n_heads):
    Q, K, V = split_heads(x @ w_q, n_heads), split_heads(x @ w_k, n_heads), split_heads(x @ w_v, n_heads)
    d_head = Q.shape[-1]
    scores = Q @ K.swapaxes(-1, -2) / np.sqrt(d_head)
    weights = softmax(scores, axis=-2)
    return merge_heads(weights @ V), weights
```

Find both defects and explain what each one does to the model.

## Short answer

The softmax normalizes over the query axis instead of the key axis, so each column sums to one and a query's weights no longer form a distribution over the keys. The output projection is also missing: the merged heads are returned without the multiplication by `w_o`, which is the only place where heads exchange information. Normalize over the last axis and multiply the merged result by the output matrix.

## Full answer

### Defect one: the softmax axis

Scores have shape batch, heads, queries, keys. Each query row must become a distribution over the keys, so the softmax runs over the last axis. Over the second-to-last axis each key column sums to one across queries instead, and the weighted sum of values no longer means "what this token attends to".

### Defect two: the output projection

Each head computes attention in its own subspace and the heads never interact during the attention computation itself. The concatenation followed by the output matrix is where the heads mix. Without it, the model's output is a stack of independent per-head results, the next layer sees a different function than the one the weights were trained for, and a loaded checkpoint produces noise.

### The corrected function

```python
def multi_head_attention(x, w_q, w_k, w_v, w_o, n_heads):
    Q = split_heads(x @ w_q, n_heads)
    K = split_heads(x @ w_k, n_heads)
    V = split_heads(x @ w_v, n_heads)
    d_head = Q.shape[-1]
    scores = Q @ K.swapaxes(-1, -2) / np.sqrt(d_head)
    weights = softmax(scores, axis=-1)
    return merge_heads(weights @ V) @ w_o, weights
```

### Why the reshape tests passed

Both defects live after the split and before the merge, or after the merge. The reshape helpers are correct, and the shapes of the final output match the reference because `w_o` is square. Only a value comparison against a reference, or a real checkpoint, exposes them.

### Why the scale is still right

The division uses the head size, not the full width. That part of the submission is correct; dividing by the square root of the full width is a third common error that the practice also tests.

## Follow-ups

- **Level 3:** Why does the output projection have shape full width by full width? Expected: it maps the concatenation of all heads, which has the full width, back to the model width, and it is the one matrix that reads from every head.
- **Level 3:** Which test would you add to catch the missing projection early? Expected: a case where `w_o` is not the identity, so the projected and unprojected outputs differ.
- **Level 4:** A probing study finds one head attends to the previous token. Where in this code does that head's result reach the residual stream? Expected: only through its block of columns in the concatenation and the rows of `w_o` that read it; `w_o` decides how much of that head the next layer sees.

## Wrong answers

- "The softmax axis does not matter because the scores are symmetric." Scores are query by key and not symmetric; the two normalizations differ for every real input.
- "Skip the output projection to save parameters; the merge already recombines the heads." The merge only concatenates; without the projection the heads never interact.
- "Use the identity for the output projection when a checkpoint lacks one." A trained checkpoint always has one; a missing tensor means the name map is wrong.

## Taught in

The [multi-head attention lesson](../../../phases/07-transformers-deep-dive/03-multi-head-attention/) explains that heads only mix through the output projection, and the [split and merge practice](../../../practice/multi-head-split-merge/) checks the softmax axis and the projection.
