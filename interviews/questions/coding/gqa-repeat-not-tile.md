---
id: gqa-repeat-not-tile
title: GQA that pairs query heads with the wrong group
card: coding
kind: code-reading
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [coding, ml-depth]
tags: [gqa, kv-heads, attention-variants]
minutes: 10
lessons: [phases/07-transformers-deep-dive/03-multi-head-attention]
manuals: []
practice: [grouped-query-attention]
cheatsheet: [attention-variants]
related: [coding/gqa-checkpoint-pooling, coding/split-heads-reshape]
updated: 2026-11-03
---

A GQA implementation repeats the key and value heads up to the query head count with this line, where `kv` has shape batch, groups, tokens, head size:

```python
kv_full = np.tile(kv, (1, n_heads // n_kv_heads, 1, 1))
```

The shapes match and the outputs are wrong for every configuration with more than one group. Explain which query head ends up with which group, and write the correct expansion.

## Short answer

Tiling repeats the whole block of groups, so query head `h` reads group `h` modulo the number of groups. The convention is that consecutive query heads share a group: head `h` reads group `h` floor-divided by the repeat factor. Repeat each group in place along the head axis instead of tiling the block.

## Full answer

### The two layouts

With four query heads and two groups the repeat factor is two. The correct expansion gives the sequence of groups `0, 0, 1, 1`: the first two query heads share group zero and the next two share group one. Tiling gives `0, 1, 0, 1`, so heads one and two swap partners. Every head still has a key and value tensor of the right shape, which is why no shape check fails, but half the heads attend with the wrong keys.

### The fix

```python
def repeat_kv(kv, n_heads):
    B, G, T, d_head = kv.shape
    if n_heads % G:
        raise ValueError("query heads must be a multiple of kv heads")
    r = n_heads // G
    return np.repeat(kv, r, axis=1)
```

`np.repeat` along the group axis copies each group `r` times next to itself, which produces the floor-division mapping. The divisibility check belongs here, because a non-integer repeat factor silently truncates and drops heads.

### Why the mapping is a convention and not a choice

The projection weights of a trained checkpoint were learned under one mapping. The multi-head lesson describes the lineage: multi-head attention with one group per head, multi-query attention with a single shared group, and the grouped form in between with the first `r` heads on group zero. A model converted from multi-head weights by pooling consecutive heads only works if attention reads the groups in the same consecutive order.

### Why it exists

Only `G` key and value heads live in the cache instead of `H`, so the cache shrinks by the factor `H / G` while quality stays close to standard multi-head attention. The lesson's example is a large open model that pairs 64 query heads against only 8 shared groups.

## Follow-ups

- **Level 3:** With one group, what does the function compute? Expected: multi-query attention; every query head shares the single key and value head.
- **Level 3:** Where does the scale factor come from after the repeat? Expected: the square root of the head size, the same as in multi-head attention; dividing by the square root of the full width is a separate common bug.
- **Level 4:** How does a framework avoid materializing the repeated copies? Expected: it broadcasts the group axis inside the attention kernel, or the attention call accepts fewer key and value heads directly, so memory holds only the groups.

## Wrong answers

- "Tile and repeat give the same result when the shapes match." They give different head-to-group assignments; only one matches the trained weights.
- "Average the groups and use one key tensor for all heads." That turns the model into multi-query attention with weights it was not trained for.
- "The mapping does not matter because attention is permutation invariant." Attention is invariant over keys within a head, not over which key head a query head reads.

## Taught in

The [multi-head attention lesson](../../../phases/07-transformers-deep-dive/03-multi-head-attention/) gives the grouped-query variant and its repeat, and the [grouped-query practice](../../../practice/grouped-query-attention/) checks the head-to-group mapping.
