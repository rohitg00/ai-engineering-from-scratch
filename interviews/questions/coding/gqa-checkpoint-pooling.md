---
id: gqa-checkpoint-pooling
title: Convert a multi-head checkpoint to grouped-query heads
card: coding
kind: estimate
level: 4
roles: [inference-engineer, applied-ai-engineer]
rounds: [coding, ml-depth]
tags: [gqa, kv-cache, checkpoint-conversion, memory]
minutes: 15
lessons: [phases/07-transformers-deep-dive/03-multi-head-attention]
manuals: []
practice: [grouped-query-attention]
cheatsheet: [attention-variants, inference-optimization]
related: [coding/gqa-repeat-not-tile, coding/split-heads-reshape]
updated: 2026-11-03
---

You have a trained model with 64 query heads and 64 key and value heads, and you want to serve it with 8 key and value heads to shrink the cache. Write the function that pools the key projection of the checkpoint into groups, say by what factor the cache memory for keys and values falls, and explain why the pooled model needs more training before it is usable.

## Short answer

Group `g` of the new projection is the mean of the consecutive heads `g r` to `g r + r - 1`, where `r` is the number of query heads per group, taken over the columns of the projection matrix. The cache holds keys and values for 8 heads instead of 64, so that memory falls by a factor of eight. The mean of several heads is not a head the model was trained with, so quality drops until a short continued training run adapts the query heads to their shared group.

## Full answer

### The pooling

```python
def mean_pool_kv_heads(w, n_heads, n_kv_heads):
    if n_heads % n_kv_heads:
        raise ValueError("query heads must be a multiple of kv heads")
    D, cols = w.shape
    d_head = cols // n_heads
    r = n_heads // n_kv_heads
    grouped = w.reshape(D, n_kv_heads, r, d_head)
    return grouped.mean(axis=2).reshape(D, n_kv_heads * d_head)
```

The reshape puts the groups first and the heads inside a group next, because the heads of one group are consecutive blocks of columns. Reshaping as `(D, r, G, d_head)` pools heads that are `G` apart, which gives a correct shape with the wrong groups. The mean, not the sum, keeps the scale of the projected keys close to the original, so the attention scores stay in range.

### The memory factor

The cache stores one key and one value vector per layer, per head, per token. The number of query heads does not enter. Going from 64 to 8 key and value heads divides the stored bytes per token by eight, which is the example the multi-head lesson gives for a large open model. Weights fall much less, because the query and output projections are unchanged and only the key and value projections shrink.

### Why it needs training

The query heads were trained against their own key heads. After pooling, eight query heads read one averaged key head that none of them saw in training. The lesson's lineage describes converting multi-head checkpoints to grouped-query checkpoints as a recipe with a continued training step; the pooling gives a starting point close to the original, and the uptraining recovers most of the quality. Serving the pooled weights directly works, but the eval must be rerun before shipping.

### What does not change

The head size, the query projection, the output projection and the attention function itself are the same. Only the key and value projections and the repeat inside attention change, so the rest of the loader and the block are untouched.

## Follow-ups

- **Level 3:** Why pool consecutive heads and not every eighth head? Expected: the attention reads group `h` floor-divided by `r` for query head `h`, so the pooled heads must be the ones that will share a group.
- **Level 4:** How does the cache saving change when the model is served with a longer context? Expected: it does not change as a factor; the saving is per token, so the absolute bytes saved grow with the number of tokens held.
- **Level 4:** The multi-head latent variant compresses keys and values into a low-rank latent. What does it trade for the extra saving? Expected: compute, because the latent must be projected back to full keys and values at attention time.

## Wrong answers

- "Pooling is lossless since the mean preserves the average key." The individual heads are lost; the queries were trained against them, so quality drops until the model is adapted.
- "The cache shrinks by the ratio of query heads to total heads." Only key and value heads live in the cache; the factor is the old count of key and value heads over the new count.
- "Sum the heads so no information is lost." The sum scales the keys by the group size and pushes the scores out of the range the softmax was trained for.

## Taught in

The [multi-head attention lesson](../../../phases/07-transformers-deep-dive/03-multi-head-attention/) gives the grouped-query lineage and the cache factor, and the [grouped-query practice](../../../practice/grouped-query-attention/) implements the pooling of a multi-head checkpoint.
