---
id: pre-norm-vs-post-norm
title: Why the norm moved in front of the sublayer
card: transformers
kind: tradeoff
level: 2
roles: [inference-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [ml-depth, coding]
tags: [pre-norm, post-norm, layer-norm, rmsnorm, warmup]
minutes: 8
lessons: [phases/07-transformers-deep-dive/05-full-transformer, phases/19-capstone-projects/34-transformer-block]
manuals: []
practice: [layer-norm-rms-norm]
cheatsheet: [transformers-attention]
related: []
updated: 2026-11-03
---

The 2017 paper placed the layer normalization after the residual add. Almost every model since about 2019 places it before the sublayer. What changed, how would you demonstrate the difference in one afternoon, and what does RMSNorm change on top of that?

## Short answer

Post-norm sends the gradient of the skip path through a normalization at every layer, so at depth the gradient shrinks and the run needs a warmup schedule to survive. Pre-norm keeps the skip path unnormalized, so the gradient reaches the embeddings cleanly and a deep stack trains without warmup tricks. Demonstrate it by stacking twelve layers of each variant with the same initialization and printing the gradient norm at the embedding after one backward pass. RMSNorm then drops the mean subtraction, one fewer operation, with the same stability in practice.

## Full answer

### The two placements

```text
pre-norm:   x + sublayer(LN(x))
post-norm:  LN(x + sublayer(x))
```

Same shapes, different training behavior. In the post-norm block the residual add is followed by the norm, so the signal that flows down the stack is normalized at each layer and the gradient that flows back must pass through every norm. At a depth of twelve and a learning rate of `3e-4` that gradient shrinks fast enough to need warmup. In the pre-norm block the norm sits inside the branch, before attention and before the MLP, and the skip path carries the raw signal.

### The afternoon experiment

1. Build a six-layer or twelve-layer stack with a `pre_ln` flag.
2. Feed the same random input to both variants with identical weights.
3. Run one backward pass and print the gradient norm at the embedding.

The pre-norm stack shows an embedding gradient about an order of magnitude larger than the post-norm stack at the same learning rate.

### What pre-norm needs that post-norm did not

A final norm before the output head. The residual stream is unnormalized in a pre-norm model, so the head needs one normalization at the end.

### RMSNorm

LayerNorm subtracts the mean and divides by the standard deviation. RMSNorm divides by the root mean square and skips the mean subtraction. It is one operation cheaper and is empirically at least as stable, which is why the modern block uses it.

### Where dropout goes

After the attention softmax, on the attention output before the residual add, and after the second linear of the MLP. Never on the skip path itself, because that breaks the additive identity that lets the gradient flow at depth.

## Follow-ups

- **Level 2:** Where exactly does the norm sit in a pre-norm block? Expected: inside each residual branch, before attention and before the MLP, plus one final norm before the head.
- **Level 3:** Why does a pre-norm model need a final norm when a post-norm model does not? Expected: the pre-norm skip path is unnormalized, so the head would see an unbounded stream without it.
- **Level 3:** Your six-layer post-norm model trains fine and the twenty-four-layer version diverges. Why? Expected: the skip-path gradient attenuates at every norm, and the effect compounds with depth; add warmup or switch to pre-norm.
- **Level 4:** What would convince you to keep LayerNorm instead of RMSNorm? Expected: a measured quality or stability difference on your own run; the lesson's evidence is that RMSNorm matches it while being cheaper.

## Wrong answers

- "The two placements compute the same function in a different order." The composition differs: one normalizes the stream, the other normalizes only the branch input.
- "Warmup is a learning-rate detail unrelated to the norm." The lesson ties the need for warmup directly to the post-norm gradient path.
- "RMSNorm needs the mean to be stable." It omits the mean on purpose and matches LayerNorm in practice.

## Taught in

The [full transformer lesson](../../../phases/07-transformers-deep-dive/05-full-transformer/) explains the move to pre-norm and RMSNorm, and the [block capstone](../../../phases/19-capstone-projects/34-transformer-block/) builds both variants and measures the gradient.
