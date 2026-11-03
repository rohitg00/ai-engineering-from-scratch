---
id: attention-shape-bug
title: Attention runs, and the context has the wrong shape
card: transformers
kind: debug
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [debugging, coding]
tags: [attention, shapes, broadcasting, encoder-decoder, testing]
minutes: 8
lessons: [phases/05-nlp-foundations-to-advanced/10-attention-mechanism, phases/07-transformers-deep-dive/02-self-attention-from-scratch]
manuals: []
practice: [scaled-dot-product-attention]
cheatsheet: [transformers-attention]
related: [transformers/query-key-value-lookup]
updated: 2026-11-03
---

An attention module between an encoder and a decoder runs without any exception, but the model's accuracy slowly falls behind the reference implementation. When you print the context tensor, its second dimension is the encoder length instead of the decoder length. Walk me through the diagnosis.

## Short answer

A module that runs and still produces the wrong shape is a broadcast bug, and a silent broadcast is the worst attention bug because it degrades accuracy instead of crashing. Write the expected shapes first: scores and weights are batch by decoder length by encoder length, and the context is batch by decoder length by the encoder state width. Then find the matmul whose operands were swapped or not transposed, fix it with one transpose or reshape, and add asserts on the shapes and on the weights summing to one.

## Full answer

### The shape table

| Tensor | Shape |
|---|---|
| Encoder states H | (T_enc, d_h); d_h is twice the hidden size for a bidirectional encoder |
| Decoder state s | (d_s,) |
| Score for one encoder position | scalar |
| Weights after the softmax | (T_enc,) for one decoder step |
| Context vector | (d_h,), the same shape as one encoder state |

Batched over decoder steps, the weights are `(batch, T_dec, T_enc)` and the context is `(batch, T_dec, d_h)`.

### How the wrong shape appears

The context is `weights @ H`. If the code built the scores as `H @ H.T` because the query tensor was replaced by the encoder states, the shapes still multiply and the result has the encoder length where the decoder length belongs. Nothing raises. Downstream layers broadcast or reshape the tensor and the loss keeps falling, just more slowly.

### The diagnosis steps

1. Print the shape of every intermediate tensor and compare with the table.
2. Check the score formula. For the additive form the projection vector collapses an attention-dimension vector to a scalar; for the dot form the query and the key must have the same width, and a bidirectional encoder doubles the key width, so the dot form fails unless a matrix W sits between them.
3. Check which decoder state feeds the query. One classic formulation uses the state before the current step and the other uses the state after it. Mixing them gives subtly wrong gradients that are very hard to see.
4. Fix with one transpose, reshape or projection. Refuse any fix that only silences the mismatch by broadcasting.

### The regression test

```text
assert output.shape == (batch, T_dec, d_h)
assert weights.shape == (batch, T_dec, T_enc)
assert weights.sum(dim=-1) is close to 1
```

The third line catches a softmax taken over the wrong axis, which is the other silent bug in this layer.

## Follow-ups

- **Level 2:** Which single test catches most attention bugs? Expected: the weights have shape batch by decoder length by encoder length and sum to one along the last axis.
- **Level 2:** The score matrix comes out square in the encoder dimension. What happened? Expected: the keys were scored against themselves; the query tensor was replaced by the encoder states.
- **Level 3:** Why does the plain dot score fail with a bidirectional encoder? Expected: the encoder state is twice the hidden width, so it no longer matches the decoder state; use the general form with a matrix between them.
- **Level 3:** Why is the state convention a gradient problem and not a shape problem? Expected: both states have the same shape, so nothing fails; the gradient flows to the wrong step and the model learns a slightly wrong alignment.

## Wrong answers

- "Reshape the output to the expected shape and continue." The values inside are wrong; a reshape only hides the mismatch.
- "Lower the learning rate; the model is just unstable." The run is not unstable; it is computing the wrong quantity.
- "Add a mask to fix the shape." A mask changes which positions get weight, not the layout of the tensor.

## Taught in

The [attention mechanism lesson](../../../phases/05-nlp-foundations-to-advanced/10-attention-mechanism/) gives the shape table and the shape-debugging prompt, and the [self-attention lesson](../../../phases/07-transformers-deep-dive/02-self-attention-from-scratch/) gives the projections.
