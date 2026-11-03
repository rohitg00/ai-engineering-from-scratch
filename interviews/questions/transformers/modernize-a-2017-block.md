---
id: modernize-a-2017-block
title: Review a 2017-style block against today's defaults
card: transformers
kind: design
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [design-review, ml-depth]
tags: [transformer-block, rmsnorm, swiglu, rope, grouped-query-attention, design-review]
minutes: 12
lessons: [phases/07-transformers-deep-dive/05-full-transformer, phases/07-transformers-deep-dive/14-build-a-transformer-capstone, phases/07-transformers-deep-dive/04-positional-encoding]
manuals: []
practice: [layer-norm-rms-norm, rope]
cheatsheet: [transformers-attention]
related: [transformers/pre-norm-vs-post-norm, transformers/residual-stream-and-dropout]
updated: 2026-11-03
---

You inherit a decoder block written in the 2017 style: layer normalization after the residual add, a ReLU feed-forward network at four times the width, sinusoidal absolute positions summed into the input, bias terms on every linear layer, and full multi-head attention. Review it against what production decoders ship today and justify each change you ask for.

## Short answer

Move the normalization in front of each sublayer and switch it to RMSNorm; replace the ReLU network with SwiGLU at about 2.6 times the width so that its three matrices match the old parameter count; replace the sinusoid with rotation of the queries and keys; drop the biases; and use grouped-query attention to shrink the decode-time cache. Every change is one function substitution and the tensor shapes do not move. The evidence: pre-norm trains deep without warmup tricks, SwiGLU gains about half a point of perplexity in the published model papers, rotation gives relative position and a knob for long context, and grouped-query cuts cache memory by the ratio of query heads to key-value heads.

## Full answer

### The review table

| Component | As written | Ask for | Why |
|---|---|---|---|
| Normalization | LayerNorm after the add | RMSNorm before the sublayer | pre-norm trains deep stacks without warmup; RMSNorm drops the mean subtraction at equal stability |
| FFN activation | ReLU | SwiGLU | about 0.5 point of perplexity in the published comparisons |
| FFN expansion | 4 with two matrices | about 2.6 with three matrices | same parameter budget |
| Position | sinusoid on the embedding | rotation of Q and K | relative position for free and a base to scale for long context |
| Attention | full multi-head | grouped-query, or latent | fewer key-value heads in the cache, nearly full quality |
| Bias terms | yes | no | slight perplexity gain and a smaller model |

### What stays

The skeleton: embedding, a stack of blocks that each add attention and an FFN to the residual stream, a final norm and a head. The shift-by-one cross-entropy. The causal mask. The capstone architecture in the lesson is exactly this skeleton with the modern pieces plugged in, and its head is tied to the token embedding.

### How to land the changes safely

1. Make each substitution behind a flag and confirm the output shape after every swap, the way the lesson's build step does.
2. Train the old and the new block on a small copy task for a fixed number of steps and compare the loss; the lesson's exercise uses 100 steps of a toy task.
3. Use the fused attention call from the framework so that a tiled kernel is dispatched when the inputs allow it.
4. Keep a final norm before the head, which pre-norm requires and post-norm did not.

### What needs a retrain

All of these change the function the block computes, so a checkpoint trained with the old block cannot adopt them by editing code. Grouped-query is the exception the literature treats specially: a trained multi-head checkpoint can be converted and fine-tuned.

## Follow-ups

- **Level 3:** Why is the SwiGLU expansion about 2.6 and not 4? Expected: three matrices instead of two, chosen so that the total parameters match the old network.
- **Level 3:** Which of the six changes can be applied to an existing checkpoint without retraining? Expected: none cleanly; grouped-query can be converted with a fine-tune, the rest change the function and need training.
- **Level 4:** What would you refuse to change in the review? Expected: the residual skeleton, the causal mask and the next-token loss; the modern block refined the pieces, not the frame.
- **Level 4:** The team wants to keep the sinusoid because it has no parameters. Your answer? Expected: rotation also has no parameters, applies inside attention, encodes relative distance and extends to longer contexts by scaling its base.

## Wrong answers

- "RMSNorm is a cheaper approximation that costs accuracy." The lesson records it as at least as stable with one fewer operation.
- "SwiGLU doubles the feed-forward parameters." At about 2.6 times the width its three matrices match the old two-matrix count.
- "Pre-norm removes the need for any final normalization." It adds the need: the residual stream is unnormalized, so the head needs a final norm.

## Taught in

The [full transformer lesson](../../../phases/07-transformers-deep-dive/05-full-transformer/) gives the 2017 against 2026 table, the [capstone](../../../phases/07-transformers-deep-dive/14-build-a-transformer-capstone/) assembles the modern block, and the [positional encoding lesson](../../../phases/07-transformers-deep-dive/04-positional-encoding/) covers the rotation.
