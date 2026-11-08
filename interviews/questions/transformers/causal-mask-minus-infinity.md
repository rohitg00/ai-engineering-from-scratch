---
id: causal-mask-minus-infinity
title: Where the triangle of minus infinity comes from
card: transformers
kind: concept
level: 2
roles: [inference-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [ml-depth, coding]
tags: [causal-mask, softmax, decoder, prefix-average]
minutes: 8
lessons: [phases/07-transformers-deep-dive/07-gpt-causal-language-modeling, phases/19-capstone-projects/33-multihead-self-attention, phases/19-capstone-projects/34-transformer-block]
manuals: []
practice: []
cheatsheet: [transformers-attention, gpt-from-scratch-training]
related: []
updated: 2026-11-03
---

A decoder must not read tokens that come after the current position. A teammate proposes to run the softmax first and then set the weights of later positions to zero. Why is that wrong, and where does the usual triangle of negative infinity really come from?

## Short answer

Zeroing weights after the softmax leaves rows that no longer sum to one, and the later tokens already shaped the normalization. The mask adds minus infinity to the scores before the softmax, so the exponential gives an exact zero there and each row is a distribution over the past alone. The triangle is not a patch on attention: a causal running average is a lower-triangular row-normalized matrix, and the mask is that same zero pattern written in the input domain of the softmax.

## Full answer

### Three stages, one invariant

Start with the simplest causal summary: position i becomes the mean of positions 0 to i. As a matrix:

```python
A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

The zeros above the diagonal are the causality. Nothing was masked; the future was never in the sum.

Now replace the ones with learned scores S. The rows no longer sum to one, so normalize each row with a softmax. A softmax never outputs an exact zero, so the future entries must enter as minus infinity, because `exp(-inf) = 0`:

```python
S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
```

Finally let the scores depend on the tokens: `S = Q @ K.T / sqrt(d_k)`. Mask, softmax, matmul. The mask survived from the average; it was never added to attention.

### Why minus infinity and not zero

A score of zero still gets a weight of `exp(0) = 1` before normalization. Only minus infinity gives zero weight.

### What it buys at training time

With the mask in place one forward pass over a sequence of N tokens gives N next-token predictions, each of which saw only its past. That is why training is parallel along the sequence. Without the mask the model reads its own target and the loss collapses while the model learns nothing useful.

### How a production block stores it

Register the mask as a buffer at construction, sized to the maximum context, and slice the top-left (T, T) corner at forward time. It then lives on the same device as the weights and never enters the gradient graph. Rebuilding it on each call turns the mask into an allocator hot spot at long context.

## Follow-ups

- **Level 2:** Why not multiply the future scores by zero? Expected: a zero score still receives weight `exp(0)` before normalization, so the future still contributes.
- **Level 2:** Where does the mask live in a real block and why? Expected: a registered buffer at the maximum context length, sliced per forward pass, so it sits on the right device and is not allocated on every call.
- **Level 3:** Does an encoder need this triangle? Expected: no, an encoder is bidirectional; it needs a padding mask, which also uses minus infinity but follows the batch, not the diagonal.
- **Level 3:** What does the mask have to do with parallel training? Expected: it lets one pass produce every next-token prediction at once while each prediction sees only its past, so the N losses are valid together.

## Wrong answers

- "Set the future scores to zero." Zero is a legal score and still earns weight after the exponential; only minus infinity gives a zero weight.
- "The mask is a training-only trick, so serving can drop it." The prompt is processed in one pass at serving time, and without the mask the prompt tokens would read their own future.
- "Encoders also need the triangle." The encoder sees both sides by design; the triangle is what makes a decoder a decoder.

## Taught in

The [causal language modeling lesson](../../../phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/) derives the triangle from the prefix average, and the [attention capstone](../../../phases/19-capstone-projects/33-multihead-self-attention/) and the [block capstone](../../../phases/19-capstone-projects/34-transformer-block/) register it as a buffer.
