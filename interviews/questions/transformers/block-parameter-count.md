---
id: block-parameter-count
title: Count the parameters of a decoder stack by hand
card: transformers
kind: estimate
level: 3
roles: [inference-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [ml-depth, screen]
tags: [parameter-count, feed-forward, swiglu, embeddings, estimation]
minutes: 10
lessons: [phases/07-transformers-deep-dive/05-full-transformer]
manuals: []
practice: []
cheatsheet: [transformers-attention]
related: [transformers/residual-stream-and-dropout]
updated: 2026-11-03
---

Count the parameters of a decoder stack with a model width of 4096, 32 layers and a SwiGLU feed-forward network at an expansion of 2.6. Then add an untied embedding and output head for a vocabulary of 128K. Where does the total land, and why is the published model of that size a little different?

## Short answer

Per block, attention takes `4 d^2` for the four projections and SwiGLU takes `3 d (r d)`, about `3 r d^2`. At the given width and expansion that is about 67M plus 131M, about 198M per block, and 32 blocks give about 6.3B. The untied embedding and head add about 1B, so the stack lands near the published 8B. The real model uses grouped-query attention, which shrinks the key and value projections, and a wider FFN at an expansion of 3.5, which moves parameters from attention to the FFN while the total stays close.

## Full answer

### The per-block arithmetic

```text
attention:  Q, K, V, O projections, each d x d        -> 4 d^2
FFN:        three matrices of d x (r d)               -> 3 r d^2
norms:      two vectors of length d                   -> negligible
```

With `d = 4096` and `r = 2.6`:

```text
4 * 4096^2        = about 67M
3 * 2.6 * 4096^2  = about 131M
per block         = about 198M
32 blocks         = about 6.3B
```

### The embeddings

An untied model has a token embedding of shape `(vocab, d)` and a separate head of the same size. At 128K by 4096 the pair adds about 1B. A tied model shares the matrix and saves half of that.

### Why the published number differs

Two architectural choices move the count without changing the total much:

1. **Grouped-query attention.** The key and value projections map `d` to `n_kv_heads * d_head` instead of `d` to `d`, so attention holds fewer than `4 d^2` parameters.
2. **A wider FFN.** The published model uses an expansion of about 3.5, so the FFN holds more than the `3 * 2.6 * d^2` counted above.

The total still lands near 8B. The FFN holds about two thirds of the block parameters in either version.

### What the count is for

Memory for the weights at a given data type, the bound on the cache budget that remains on the card, and a sanity check when a config file or a model card looks wrong.

## Follow-ups

- **Level 2:** Why are the norms negligible? Expected: each norm is one or two vectors of length d, thousands of parameters against millions per matrix.
- **Level 3:** How does grouped-query attention change the per-block count? Expected: the K and V projections shrink to `d` by `n_kv_heads * d_head`, so attention holds less than `4 d^2`.
- **Level 3:** Why does an expansion of 4 with two matrices equal an expansion of about 2.6 with three? Expected: `2 * 4 d^2 = 8 d^2` and `3 * 2.6 d^2` is about `8 d^2`; the modern block kept the parameter budget and changed the activation.
- **Level 4:** The team ties the embedding and the head. What changes in the count and what do you check? Expected: about half of the 1B disappears; check that the output logits still use the transpose of the embedding and that quality holds.

## Wrong answers

- "The parameter count grows with the sequence length." No weight depends on the sequence; the length changes activation memory and compute, not parameters.
- "The embedding is a rounding error." At 128K by 4096 it is about 1B, more than a tenth of the model.
- "Attention is where most of the parameters are." The FFN holds about two thirds of each block.

## Taught in

The [full transformer lesson](../../../phases/07-transformers-deep-dive/05-full-transformer/) does this count and explains the published difference.
