---
id: why-scale-by-sqrt-dk
title: Why the attention scores are divided before the softmax
card: transformers
kind: concept
level: 1
roles: [inference-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [screen, ml-depth]
tags: [attention, softmax, scaling, gradients]
minutes: 6
lessons: [phases/07-transformers-deep-dive/02-self-attention-from-scratch, phases/07-transformers-deep-dive/03-multi-head-attention, phases/19-capstone-projects/33-multihead-self-attention]
manuals: []
practice: [scaled-dot-product-attention]
cheatsheet: [transformers-attention]
related: []
updated: 2026-11-03
---

In the attention formula the raw scores go through a division before the softmax. A new engineer calls the division a convention and removes it to save one multiply. What happens to training, and how would you show the effect in ten minutes?

## Short answer

A dot product of two vectors grows with their length, so without the division the scores grow with the key dimension. Large scores push the softmax into a region where one key takes almost all of the weight and the gradient to every other key is close to zero, so learning stalls. The division by `sqrt(d_k)` keeps the variance of the scores about constant for any head size. Show it with random Q and K at `d_k = 64`: print the score range and the softmax weights with and without the division.

## Full answer

### The size of a score

A score is the sum of `d_k` products. When the components of Q and K have unit variance, the sum has variance `d_k`, so a typical score is about `sqrt(d_k)` in size. At `d_k = 64` the raw scores sit in the range of tens. A softmax over scores in the tens puts almost all of its mass on the largest entry.

### Why the model stops learning

The gradient of the softmax with respect to a score is small when one weight is near one and the others are near zero. The attention layer then behaves like a fixed lookup. The loss plateaus, and nothing fails loudly. The lesson calls this regime one where "one entry has almost all the mass and the others are vanishingly small".

### The fix and its range

Divide the scores by `sqrt(d_k)` before the softmax:

```text
weights = softmax(Q @ K.T / sqrt(d_k))
output  = weights @ V
```

In multi-head attention the dimension under the root is the head width, `d_head = d_model / n_heads`, not the model width. Production models land `d_head` at 64 or 128. The scaling keeps the score variance constant at any width. The lesson's rule of thumb keeps heads at 32 or wider, because a narrower head sees too few dimensions, and below 256, because wider heads lose the benefit of many small specialists.

### The ten-minute demonstration

1. Draw Q and K from a standard normal with `d_k = 64`.
2. Print `(Q @ K.T).max()` with and without the division.
3. Print the largest softmax weight in one row for both cases. Without the division it sits near one.

## Follow-ups

- **Level 1:** What is the shape of the score matrix for a sequence of n tokens? Expected: (n, n), one row per query and one column per key.
- **Level 2:** Why does the missing division cause a silent failure instead of an exception? Expected: the softmax saturates, the gradients become tiny, and the loss plateaus with no error.
- **Level 2:** Does the division change what the layer can represent? Expected: no, the projections can absorb a constant; it changes the scale of the scores at initialization, which is where training happens or stalls.
- **Level 3:** With eight heads of width 64 in a model of width 512, which number goes under the root? Expected: 64, the head width, because each head computes its own softmax over its own scores.

## Wrong answers

- "The division keeps the attention weights summing to one." The softmax normalizes any scores to sum to one; the division controls their spread, not their sum.
- "A larger learning rate recovers the lost gradient." When the softmax is saturated the gradient carries almost no information about the other keys, and a larger step does not create information.
- "Scale the values instead of the scores." The values are summed after the weights are fixed, so their scale does not touch the softmax.

## Taught in

The [self-attention lesson](../../../phases/07-transformers-deep-dive/02-self-attention-from-scratch/) explains the saturation, the [multi-head lesson](../../../phases/07-transformers-deep-dive/03-multi-head-attention/) gives the head widths, and the [capstone attention block](../../../phases/19-capstone-projects/33-multihead-self-attention/) applies the scaling inside the batched block.
