---
id: scale-by-sqrt-dk
title: The scale factor in dot-product attention
card: coding
kind: code-reading
level: 1
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, screen, ml-depth]
tags: [attention, scaling, softmax-saturation]
minutes: 6
lessons: [phases/07-transformers-deep-dive/02-self-attention-from-scratch]
manuals: []
practice: [scaled-dot-product-attention]
cheatsheet: [transformers-attention]
related: [coding/softmax-shift-max, coding/causal-mask-off-by-one]
updated: 2026-11-03
---

Here is an attention function from a take-home submission:

```python
def attention(Q, K, V):
    scores = Q @ K.T / Q.shape[-1]
    return softmax(scores) @ V
```

The tests for shape pass and the tests for the attention weights fail. Find the bug and explain what the correct factor protects against.

## Short answer

The scores are divided by the key dimension instead of its square root. Dot products of random vectors grow with the dimension, so without the square root the softmax input is either too large, which saturates it and kills the gradient, or too small, which flattens every row toward uniform. The correct line divides by the square root of the last dimension of the keys.

## Full answer

### The fix

```python
def attention(Q, K, V):
    d_k = Q.shape[-1]
    scores = Q @ K.T / np.sqrt(d_k)
    return softmax(scores) @ V
```

### Why the square root

When the entries of a query and a key have unit variance, their dot product has a variance equal to the dimension. Its typical size is therefore the square root of the dimension. Dividing by that size brings the scores back to unit scale, where the softmax has useful gradients. Dividing by the dimension itself over-corrects and makes every row close to uniform, so the output is almost the mean of the values regardless of the query.

### Two neighbors of this bug

- No scale at all: at a head size of 64 the raw scores reach the tens and the softmax saturates to one hot rows.
- `K.T` on a batched tensor: `.T` reverses every axis, so a shape of batch by tokens by features becomes features by tokens by batch. With distinct sizes the matmul raises a shape error, and when the sizes happen to line up it mixes batches without an error. Swap only the last two axes.

### How the practice checks it

The practice task compares the weights, not only the output shape. A wrong scale changes every weight, so a reference weight matrix catches it at once.

## Follow-ups

- **Level 1:** What is the shape of the scores for one sequence? Expected: tokens by tokens, one row per query over all keys.
- **Level 2:** Why do shape tests pass with the wrong factor? Expected: scaling does not change shapes; only the values move.
- **Level 2:** How do you transpose the keys for a batched input? Expected: swap the last two axes only, for example with `swapaxes(-1, -2)`.

## Wrong answers

- "Any constant works, the model learns around it." The learned projections can compensate in training, but the practice checks a fixed reference, and in a trained model the wrong factor changes every head.
- "Divide by the sequence length." The growth comes from the feature dimension, not from the number of tokens.
- "Scaling is only for numerical overflow." The max shift inside softmax handles overflow; the scale keeps the softmax out of its saturated and flat regions.

## Taught in

The [self-attention lesson](../../../phases/07-transformers-deep-dive/02-self-attention-from-scratch/) explains the square-root scale factor, and the [attention practice](../../../practice/scaled-dot-product-attention/) checks the weights against a reference.
