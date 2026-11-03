---
id: read-split-and-combine-heads
title: One reshape is right and one scrambles the heads
card: transformers
kind: code-reading
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, ml-depth]
tags: [multi-head-attention, reshape, transpose, shapes, code-reading]
minutes: 8
lessons: [phases/07-transformers-deep-dive/03-multi-head-attention, phases/19-capstone-projects/33-multihead-self-attention]
manuals: []
practice: [multi-head-split-merge]
cheatsheet: [transformers-attention]
related: [transformers/heads-are-nearly-free]
updated: 2026-11-03
---

Two versions of a head split landed in review. `X` has shape `(n, d)` with `n` tokens and `d` features.

```python
def split_a(X, n_heads):
    n, d = X.shape
    d_head = d // n_heads
    return X.reshape(n, n_heads, d_head).transpose(1, 0, 2)

def split_b(X, n_heads):
    n, d = X.shape
    d_head = d // n_heads
    return X.reshape(n_heads, n, d_head)
```

Both return a tensor of shape `(n_heads, n, d_head)` and both run without error. Which one is right, what does the other one do to the data, and what test would have caught it?

## Short answer

The first version is the right one: `split_a` groups the `d` features of each token into `n_heads` slices of width `d_head` and then moves the head axis to the front. `split_b` reads the same memory in the wrong order: it cuts the flat buffer into `n_heads` equal chunks and calls each chunk a head, so one head now holds runs of consecutive tokens, a chunk can end inside a token, and the columns no longer line up with the projection that produced them. The test is the round trip: combining the split must return `X` exactly, and head `h` must equal the column slice `X[:, h * d_head:(h + 1) * d_head]`.

## Full answer

### What the shapes mean

After the projection, each token's `d` features are the concatenation of `n_heads` groups of `d_head` features. A head is a column slice across every token. The reshape `(n, n_heads, d_head)` keeps each token's row intact and only regroups its columns; the transpose then puts the head axis first so that the per-head attention becomes a batched operation over heads.

### Why the wrong version still runs

Both tensors have `n * d` elements, so NumPy and PyTorch are happy to reinterpret the memory. A reshape of a contiguous array does not move data; it only changes how the flat buffer is indexed. `split_b` therefore cuts the buffer into `n_heads` equal chunks. When `n` is divisible by `n_heads`, head zero holds the first `n / n_heads` tokens with all of their features; otherwise a chunk ends inside a token. The scores inside that head compare the wrong vectors, and the model trains to something, which is why this bug can survive for weeks.

### The combine must be the exact inverse

```python
def combine_heads(H):
    h, n, d_head = H.shape
    return H.transpose(1, 0, 2).reshape(n, h * d_head)
```

Transpose back first, then reshape. Reshaping directly from `(h, n, d_head)` to `(n, h * d_head)` makes the same mistake in reverse, and the output projection sees scrambled features.

### The production shape contract

With a batch dimension the intermediate tensors are `(B, H, T, d_head)`. The head dimension sits next to the batch so that the accelerator treats the per-head attention as `B * H` independent problems, and `d_head` stays last so that `Q @ K.transpose(-2, -1)` contracts it. The constraint is `D % H == 0`.

### Tests that catch it

1. `combine_heads(split_heads(X)) == X`.
2. `split_heads(X)[h] == X[:, h * d_head:(h + 1) * d_head]` for every head.
3. Single-head attention on the slice equals the head's output from the batched path.

## Follow-ups

- **Level 2:** Why does a reshape never raise here? Expected: it only reinterprets a buffer with the same number of elements; the data is not checked for meaning.
- **Level 2:** Why must `d_head` stay the last axis? Expected: the score matmul contracts the last axis of Q with the second-to-last of the transposed K.
- **Level 3:** How does grouped-query attention reuse this code? Expected: split K and V into `n_kv_heads` heads and repeat each along the head axis `n_heads // n_kv_heads` times to match Q.
- **Level 3:** A model trained with the wrong split reaches a decent loss. Why does that not clear the bug? Expected: the projections learned to work with the scrambled layout, but the heads no longer correspond to subspaces of the input and any pretrained weights or exported checkpoints will be wrong.

## Wrong answers

- "Reshape and transpose are interchangeable when the shapes match." A reshape reinterprets memory and a transpose moves axes; the order decides which elements land together.
- "If it runs and the loss falls, it is correct." The loss falls for the wrong layout too; only the round-trip and slice tests prove the layout.
- "Each head needs its own weight matrix, so the split is irrelevant." The heads are slices of one projection; the split is what defines them.

## Taught in

The [multi-head attention lesson](../../../phases/07-transformers-deep-dive/03-multi-head-attention/) gives the split and combine pair, and the [attention capstone](../../../phases/19-capstone-projects/33-multihead-self-attention/) sets the batched shape contract.
