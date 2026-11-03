---
id: heads-are-nearly-free
title: What eight heads cost that one head does not
card: transformers
kind: concept
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [ml-depth, screen]
tags: [multi-head-attention, head-dimension, output-projection, fused-qkv]
minutes: 8
lessons: [phases/07-transformers-deep-dive/03-multi-head-attention, phases/19-capstone-projects/33-multihead-self-attention]
manuals: []
practice: [multi-head-split-merge]
cheatsheet: [transformers-attention, attention-variants]
related: [transformers/why-scale-by-sqrt-dk]
updated: 2026-11-03
---

You change an attention layer from one head to eight heads and keep the model width fixed. What happens to the parameter count, to the compute, and to what the layer can represent? And why do practitioners refuse to make heads narrower than about 32?

## Short answer

The parameters do not change: the four projections are still `d_model` by `d_model`, and the heads are only a reshape of the same matrices into slices of width `d_model / n_heads`. The compute stays about the same because the per-head attention runs as one batched matmul over the head axis. Each head can specialize on its own relation, and the output projection is where the heads mix. The lesson's rule of thumb keeps a head at a width of 32 or more, because a narrower head sees too few dimensions, and above 256 you lose the benefit of many small specialists, while the `sqrt` scaling itself keeps the score variance constant at any width.

## Full answer

### Split, attend, combine

```python
def split_heads(X, n_heads):
    n, d = X.shape
    d_head = d // n_heads
    return X.reshape(n, n_heads, d_head).transpose(1, 0, 2)

def combine_heads(H):
    h, n, d_head = H.shape
    return H.transpose(1, 0, 2).reshape(n, h * d_head)
```

Project X to Q, K and V, split each into heads, run scaled dot-product attention per head, stack the heads back and multiply by the output matrix `W_o`. The GPU sees the per-head scores as a single batched matmul of shape `(heads, N, d_head)` times `(heads, d_head, N)`. Adding heads adds batch entries, not weights.

### Why the output projection matters

The heads never talk during the attention step itself; they work on different subspaces. `W_o`, of shape `(d_model, d_model)`, is where their outputs mix. Without it the heads could only recombine through later layers and the block would be artificially constrained.

### What heads learn

Probing work from 2019 to 2024 found distinct roles: heads that attend to the previous token, copy heads, heads that track named entities, and induction heads, the pairs that detect an earlier occurrence of the current token and copy what followed it, which underlie in-context learning. One head would have to smear all of these into one softmax.

### Picking the head width

| Model size | d_model | n_heads | d_head |
|---|---|---|---|
| Small (about 125M) | 768 | 12 | 64 |
| Base (about 350M) | 1024 | 16 | 64 |
| Large (about 1B) | 2048 | 16 | 128 |
| Frontier (about 70B) | 8192 | 64 | 128 |

The head width lands at 64 or 128 almost every time. It is the unit of how much one head can see.

### The production implementation

One linear layer maps D to 3D and is sliced into Q, K and V. Three separate layers compute the same thing, because three matmuls by `(D, D)` weights equal one matmul by a stacked `(3D, D)` weight, but the fused layer launches one kernel instead of three.

## Follow-ups

- **Level 2:** Why is the fused QKV projection faster if the math is identical? Expected: one kernel launch and one matmul instead of three; the stacked weight gives the same result.
- **Level 3:** What goes wrong if you remove the output projection? Expected: the heads can only mix through later layers, so the block loses expressive power even though the shapes still work.
- **Level 3:** What is an induction head? Expected: a pair of heads that finds a previous occurrence of the current token and copies the token that followed it; the circuit behind in-context learning.
- **Level 4:** Grouped-query attention keeps the query heads and shrinks something else. What and why? Expected: the key and value heads, because only they live in the decode-time cache; fewer of them cut cache memory while the query heads keep quality.

## Wrong answers

- "More heads mean more parameters." The projections keep their size; the heads are a reshape of the same matrices.
- "Heads exchange information while they attend." They work on separate subspaces; mixing happens only in the output projection and in later layers.
- "Use as many heads as the width allows." Heads narrower than the lesson's rule of thumb of 32 see too little; the common widths are 64 and 128.

## Taught in

The [multi-head attention lesson](../../../phases/07-transformers-deep-dive/03-multi-head-attention/) builds the split and the width table, and the [attention capstone](../../../phases/19-capstone-projects/33-multihead-self-attention/) fuses the projection and explains the output matrix.
