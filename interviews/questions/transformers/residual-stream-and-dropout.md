---
id: residual-stream-and-dropout
title: What the skip path does and where dropout may go
card: transformers
kind: concept
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [ml-depth, screen]
tags: [residual-stream, dropout, feed-forward, swiglu, block]
minutes: 8
lessons: [phases/07-transformers-deep-dive/05-full-transformer, phases/19-capstone-projects/34-transformer-block]
manuals: []
practice: []
cheatsheet: [transformers-attention]
related: [transformers/pre-norm-vs-post-norm]
updated: 2026-11-03
---

A transformer block has two skip paths, one around attention and one around the feed-forward network. What do they do for training, which of the two sublayers moves information between tokens, and why does a dropout layer placed on the skip path itself break something?

## Short answer

The skip path makes the gradient additive across depth, so its norm stays in scale through a twelve-layer stack instead of shrinking at every layer, and it lets each block learn a small update to a running representation instead of a full replacement. Only attention mixes tokens; the MLP applies the same two layers to every position on its own. Dropout belongs after the attention softmax, on the attention output before the residual add, and after the second linear of the MLP; on the skip path it breaks the identity that carries the gradient, and early stacks that did this trained brittly.

## Full answer

### The block as a function

A decoder block takes a tensor of shape `(batch, sequence, embedding)` and returns the same shape. Inside, two sublayers do the work:

```text
x = x + attention(norm(x))
x = x + mlp(norm(x))
```

Each line is an additive update to the stream that flows top to bottom through every block. The lesson calls that tensor the residual stream.

### Why the additive path matters

Without the skip path, gradients vanish past about six layers. With it, the gradient of the loss with respect to an early layer has a direct term that does not pass through the sublayers, so depth adds terms instead of multiplying attenuations. The second effect is representational: a block does not have to reproduce its input; it adds what it learned.

### Who talks to whom

Attention is the only place tokens exchange information. The MLP is position-wise: the same weights apply to every token independently, with a hidden width of four times the embedding width and a GELU in the classic block. The modern block uses SwiGLU, three matrices at about 2.6 times the width so that the parameter count matches the old four-times MLP, and it drops the bias terms.

### Dropout on the branches, never on the identity

Attention dropout after the softmax, residual dropout on the attention output, and residual dropout after the second linear of the MLP. Dropout applied to the identity term randomly removes part of it, and the gradient path that made depth tractable is no longer reliable.

## Follow-ups

- **Level 2:** Which sublayer would you remove if the model only needed per-token transformations? Expected: attention; the MLP never looks across positions.
- **Level 3:** Why does the modern FFN use an expansion of about 2.6 instead of 4? Expected: SwiGLU has three weight matrices, so 2.6 times the width matches the parameter count of the two-matrix MLP at 4 times.
- **Level 3:** Why do modern stacks drop the bias terms in the linear layers? Expected: the lesson reports a slight perplexity improvement and a smaller model.
- **Level 4:** A reviewer wants to regularize a small model by dropping out the identity term. Your answer? Expected: no; keep dropout on the branch outputs, because the additive identity is what lets the gradient reach early layers.

## Wrong answers

- "The skip path exists to keep the output shape equal to the input shape." The shape would match anyway; the skip path is about gradient flow and additive updates.
- "Dropout anywhere inside the block is equivalent." Dropout on the identity term damages the gradient path; dropout on the branch outputs does not.
- "The feed-forward network mixes information between tokens." It applies the same MLP to each position alone; mixing happens only in attention.

## Taught in

The [full transformer lesson](../../../phases/07-transformers-deep-dive/05-full-transformer/) names the six pieces of the block, and the [block capstone](../../../phases/19-capstone-projects/34-transformer-block/) explains the residual stream and the dropout placement.
