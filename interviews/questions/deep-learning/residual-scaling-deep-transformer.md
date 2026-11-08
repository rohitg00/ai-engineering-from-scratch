---
id: residual-scaling-deep-transformer
title: Why a deep residual stack needs more than Kaiming
card: deep-learning
kind: concept
level: 3
roles: [inference-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [ml-depth, design-review]
tags: [weight-initialization, residual-connections, transformers, variance]
minutes: 12
lessons: [phases/03-deep-learning-core/08-weight-initialization]
manuals: []
practice: []
cheatsheet: [deep-learning-training]
related: [deep-learning/kaiming-factor-of-two, deep-learning/layernorm-not-batchnorm]
updated: 2026-11-03
---

A transformer with Kaiming-initialized weights trains without trouble at 20 layers and diverges at 126 layers with the same recipe. Nothing else changed. Explain why depth breaks it even with a variance preserving initialization, and what the GPT-2 style fix does.

## Short answer

Kaiming keeps the variance constant through each sub-layer, but a residual block adds the sub-layer's output back onto its input, and the variance of a sum of independent terms adds. With N residual additions the stream's variance grows in proportion to N, so a deeper stack carries a larger residual signal, and the attention logits and feed-forward activations built from it grow with it. The GPT-2 fix scales the weights of the layers that write into the residual stream by 1 over the square root of 2N, so the accumulated variance stays the same at any depth.

## Full answer

### Two kinds of variance preservation

Kaiming answers one question: how to draw weights so that a matrix multiply followed by a ReLU returns a signal with the same variance it received. It knows nothing about what happens next. In a residual block the next thing is an addition:

```text
x = x + sublayer(x)
```

If the sub-layer output has about the same variance as x and is roughly independent of it, the sum has about twice the variance. Each block adds again. After N additions the stream has grown in proportion to N. The lesson states this directly: each addition increases variance, and with N residual layers the variance grows proportionally to N.

### Why it shows up as depth

At 20 layers the growth is a modest factor and the optimizer copes. At 126 layers, the depth the lesson cites for a 405B parameter model, the stream is large enough at initialization that the softmax inside attention and the activations in the feed-forward blocks run far from their intended range, and the first updates are oversized. Without a correction, the lesson says, the residual stream would grow without bound through the stack.

### The fix

GPT-2 scales the weights of the residual projections, the layers that write into the stream, by 1 over the square root of 2N, where N is the number of layers. The 2 counts the two writes per layer, one from attention and one from the feed-forward block. The sum of 2N contributions each scaled by that factor has the same variance as one, so the stream stays in range at any depth. The lesson notes that the 405B model uses a similar scheme and that a transformer built from scratch must add this scaling itself.

### How to confirm before you change anything

Push random tokens through the untrained model and log the residual stream magnitude at each layer. Growth with depth confirms the diagnosis. Run it again with the scaling and the curve should be flat. The lesson's exercise does exactly this over 50 layers.

## Follow-ups

- **Level 3:** Why does Kaiming not account for this? Expected: it preserves variance through a matrix multiply followed by ReLU; it knows nothing about the addition that follows.
- **Level 3:** Why 2N and not N? Expected: each transformer layer writes into the stream twice, once from attention and once from the feed-forward block, so N layers make 2N additions.
- **Level 4:** How would you confirm the diagnosis before changing the initialization? Expected: push random input through the untrained model and log the residual stream magnitude per layer; growth with depth confirms it, and the scaled version should be flat.
- **Level 4:** Does a Pre-LN layout remove the need for the scaling? Expected: it normalizes what enters each sub-layer and helps stability, but the additions into the stream sit outside the norm, so the lesson still applies the scaling to the writers.

## Wrong answers

- "Deeper models just need a smaller learning rate." A smaller rate slows the growth of the weights; it does nothing about the variance that accumulates in the forward pass at initialization.
- "Kaiming is variance preserving, so depth cannot be the issue." It preserves variance through each sub-layer, not through the sum of a sub-layer and its input.
- "Divide the residual stream by N at the output." The fix has to act where the variance accumulates; scaling the writers keeps every intermediate layer in range, not only the last one.

## Taught in

The [weight initialization lesson](../../../phases/03-deep-learning-core/08-weight-initialization/) explains residual variance growth and the GPT-2 scaling scheme.
