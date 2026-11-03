---
id: gqa-mla-cache-tradeoff
title: Pick the attention variant for a 70B decoder
card: transformers
kind: tradeoff
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [ml-depth, system-design]
tags: [grouped-query-attention, multi-query-attention, latent-attention, kv-cache]
minutes: 10
lessons: [phases/07-transformers-deep-dive/03-multi-head-attention, phases/07-transformers-deep-dive/12-kv-cache-flash-attention]
manuals: []
practice: [grouped-query-attention]
cheatsheet: [attention-variants]
related: [transformers/heads-are-nearly-free, inference-serving/kv-pool-users-fit]
updated: 2026-11-03
---

You are choosing the attention variant for a new 70B-class decoder: full multi-head, multi-query, grouped-query, or MLA with its compressed latent. What does each one do to the memory that decoding holds per token, and what do you give up with each?

## Short answer

All four keep the same number of query heads; they differ in how many key and value heads exist, and only the keys and values are stored during decoding. Multi-query shares one key-value head across every query head, the smallest cache and some quality loss. Grouped-query uses a group of key-value heads, cuts the cache by `n_heads / n_kv_heads` and keeps nearly full quality, which is why it is the default. Latent attention compresses keys and values to a low-rank vector and decompresses at attention time, so it saves even more memory and pays extra FLOPs.

## Full answer

### The lineage

| Variant | Query heads | Key-value heads | Cache cost |
|---|---|---|---|
| Multi-head | N | N | full |
| Multi-query | N | 1 | smallest, quality loss |
| Grouped-query | N | G, for example N / 8 | shrinks by N / G |
| Multi-head latent | N | compressed to a low-rank latent | smaller still, more compute |

### What the cache holds

Per layer and per token, the stored bytes are `2 * n_kv_heads * d_head * dtype_size`, where the 2 counts the key and the value. The query of a past token is never needed again, so it is not stored. A 70B-class model with 80 layers, a head size of 128 and 8 key-value heads in a 16-bit type holds 4096 bytes per token per layer, about 10 GiB for a 32K context and 40 GiB at 128K. The same model with 64 key-value heads would hold 8 times more, about 80 GiB at 32K. That is the whole memory of a large accelerator spent on one request.

### The quality side

Grouped-query keeps the query heads, so each head still asks its own question; it only shares the answers it can look up. The published work converts trained multi-head checkpoints to grouped-query with a fine-tune and reports nearly full quality. Multi-query shares a single answer set across all heads and loses more. Latent attention trades compute for memory: the latent must be projected back to keys and values on every step.

### Grouped-query in code

Only the key and value projections change. They produce `n_kv_heads` heads, and each is repeated to match the query heads:

```python
def gqa_project(X, W, n_kv_heads, n_heads):
    kv = split_heads(X @ W, n_kv_heads)
    repeat = n_heads // n_kv_heads
    return np.repeat(kv, repeat, axis=0)
```

At inference only the `n_kv_heads` copies live in the cache, not the repeated ones.

### The pick

For a 70B decoder with long contexts to serve, grouped-query with a small group is the safe default. Latent attention is the choice when memory is the binding constraint and you accept the compute cost and the engineering.

## Follow-ups

- **Level 2:** Which numbers set the stored bytes per token? Expected: layers, key-value heads, head size and bytes per value, times 2 for the key and the value; the parameter count does not enter.
- **Level 3:** Why does latent attention cost more compute per step? Expected: the stored latent has to be projected back to full keys and values at every decode step before the scores are computed.
- **Level 3:** Can you move an existing multi-head checkpoint to grouped-query? Expected: yes, the grouped-query paper converts trained checkpoints and fine-tunes; measure quality on your own eval before you ship.
- **Level 4:** The product wants 128K contexts at batch size one on a 40 GB card. Which variant and what else? Expected: grouped-query alone already fills the card at 128K, so latent attention or a smaller key-value type, and the weights still need their own memory.

## Wrong answers

- "Grouped-query reduces the compute of attention." The scores are still computed for every query head; the saving is in the stored keys and values.
- "Multi-query is free." It shares one answer set across all heads and the lesson records a quality loss.
- "The cache size follows the parameter count." It follows the key-value heads, the layers, the head size and the data type.

## Taught in

The [multi-head attention lesson](../../../phases/07-transformers-deep-dive/03-multi-head-attention/) gives the variants and the grouped-query code, and the [KV cache lesson](../../../phases/07-transformers-deep-dive/12-kv-cache-flash-attention/) does the memory arithmetic.
