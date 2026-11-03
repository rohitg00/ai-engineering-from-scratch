---
id: causal-mask-off-by-one
title: A causal mask that blocks the token itself
card: coding
kind: code-reading
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, debugging]
tags: [attention, causal-mask, decoder]
minutes: 8
lessons: [phases/07-transformers-deep-dive/02-self-attention-from-scratch]
manuals: []
practice: [scaled-dot-product-attention]
cheatsheet: [transformers-attention]
related: [coding/scale-by-sqrt-dk, coding/loss-shift-flatten]
updated: 2026-11-03
---

A decoder's attention returns a zero vector in the first row of every sequence. The mask code is:

```python
def causal_mask(T):
    return np.triu(np.ones((T, T), dtype=bool), k=0)

weights = softmax(scores)
weights[mask] = 0
out = weights @ V
```

Two things are wrong. Find both and explain what each one does to the output.

## Short answer

The mask uses a diagonal offset of zero, so every token blocks itself and the first token has no allowed key, which leaves an empty row. The mask is also applied after the softmax, so the rows no longer sum to one. Build the mask with an offset of one, and set the blocked scores to a very negative value before the softmax.

## Full answer

### Bug one: the diagonal

A causal mask lets position `i` see positions zero through `i`, itself included. `np.triu` with `k=0` keeps the diagonal in the blocked set. For the first query every key is blocked, so this code sets the whole first row of weights to zero and the first output row is zero. If you only move the mask before the softmax and fill with negative infinity, that row has nothing to normalize and the division produces NaN. Use `k=1` so the diagonal stays visible.

### Bug two: masking after the softmax

Setting weights to zero after normalization leaves each row summing to less than one, by exactly the mass that the future keys received. The output then shrinks and the model trains against a moving scale. The mask must act on the scores before the softmax, by setting blocked entries to a very negative value, so that their exponentials are zero and the remaining entries renormalize.

### The corrected code

```python
def causal_mask(T):
    return np.triu(np.ones((T, T), dtype=bool), k=1)

scores = np.where(mask, -1e9, scores)
weights = softmax(scores)
out = weights @ V
```

### Why both bugs can pass a shape test

Neither bug changes a shape. Only a check of the weights, or a check that the first output row is not zero, exposes them. The practice task checks the causal weights against a reference and includes the first row.

## Follow-ups

- **Level 2:** Why a very negative number and not negative infinity? Expected: infinity works in most frameworks, but a fully masked row then produces NaN, while a finite value keeps the arithmetic defined.
- **Level 2:** How does the mask interact with the batch dimension? Expected: the mask is tokens by tokens and broadcasts across batches and heads; it is built once per sequence length.
- **Level 3:** The same model is used for prefill and then one token at a time. Does the mask change? Expected: at decode time the single query sees every cached key, so no mask is needed for that step; the causal rule was already applied when those keys were produced.
- **Level 3:** A padding mask and a causal mask must both apply. How do you combine them? Expected: combine the boolean masks with a logical or before the scores are masked, so a padded key is blocked for every query.

## Wrong answers

- "Set the blocked weights to zero and renormalize the rows." It works numerically but doubles the work; masking the scores before the softmax does the renormalization for free.
- "The first token should attend to nothing." The first token must attend to itself; an empty row has no valid distribution.
- "Use a lower-triangular ones matrix as the mask." A ones matrix marks the allowed entries, so it must be inverted before it is used as a blocked-entry mask.

## Taught in

The [self-attention lesson](../../../phases/07-transformers-deep-dive/02-self-attention-from-scratch/) asks for the mask as its first exercise, and the [attention practice](../../../practice/scaled-dot-product-attention/) tests the first row of the masked weights.
