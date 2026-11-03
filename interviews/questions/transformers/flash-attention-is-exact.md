---
id: flash-attention-is-exact
title: Is a tiled attention kernel an approximation
card: transformers
kind: concept
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [ml-depth, design-review]
tags: [flash-attention, tiling, memory-bound, running-softmax, hbm]
minutes: 10
lessons: [phases/07-transformers-deep-dive/12-kv-cache-flash-attention]
manuals: []
practice: [flash-attention-online-softmax]
cheatsheet: [attention-variants, inference-optimization]
related: [transformers/count-attention-ops-with-cache]
updated: 2026-11-03
---

A colleague refuses to enable Flash Attention on a quality-sensitive model because "approximate attention changes the outputs". Is it an approximation? Explain what the kernel changes and what it keeps, with the memory argument that motivated it.

## Short answer

It is exact. The kernel tiles the computation so the full N by N score matrix never lands in the GPU's main memory; each tile is scored, exponentiated and accumulated in on-chip memory with a running maximum and a running sum, and the final normalization matches the single-pass softmax up to floating-point reordering. What changes is the memory traffic: three round trips to main memory become one write per output tile, and the footprint drops from N squared to N. The numbers that leave the kernel are the same as standard attention.

## Full answer

### Why standard attention is slow

```text
S = Q @ K^T       read Q and K, write an N x N matrix
P = softmax(S)    read N x N, write N x N
O = P @ V         read N x N and V, write N x d
```

Three round trips through high-bandwidth memory. On the reference accelerator that memory moves about 3 TB/s while the on-chip memory moves about 30 TB/s, so every round trip is a factor-of-ten slowdown against keeping the data on chip. From about 2K tokens, attention becomes memory-bound before it becomes compute-bound, and classic kernels underuse the hardware by 4 to 10 times.

### The tiling

```text
for each block of Q (about 128 x 128):
    load the Q tile on chip
    for each block of K, V:
        load the K and V tiles on chip
        scores for the tile
        running softmax aggregation
        accumulate into the output tile
    write the output tile once
```

The score matrix exists only one tile at a time. The backward pass recomputes some values instead of storing them, which is a second memory win.

### Why the result is exact

The softmax needs the global maximum and the global sum over a row, and the kernel only sees one tile at a time. It keeps a running pair, maximum and sum, and whenever a new tile raises the maximum it rescales the earlier sum and the earlier partial output by the exponential of the old maximum minus the new one. At the end every term is expressed against the same global maximum and divided by the same global sum. The lesson's description is "bit-identical output to standard attention", with the caveat that 16-bit arithmetic is not associative, so reordering can move the last bits.

### Versions

| Version | Year | Change | Speedup on the reference hardware |
|---|---|---|---|
| Flash 1 | 2022 | tiled on-chip kernel | 2 times on the earlier accelerator |
| Flash 2 | 2023 | better parallelism, causal-first ordering | 3 times on the same |
| Flash 3 | 2024 | asynchrony and FP8 on the newer accelerator | 1.5 to 2 times |
| Flash 4 | 2026 | five-stage pipeline for the latest generation | inference-first, forward pass only at launch |

### What to tell the colleague

Run the two kernels on the same inputs and compare the outputs. The difference is at the level of 16-bit rounding, the same noise you get from a different batch size, not a change to the model.

## Follow-ups

- **Level 3:** Why does the kernel keep a running maximum and not just a running sum? Expected: numerical stability; exponentials of raw scores overflow, so every exponential is taken relative to the maximum seen so far and rescaled when it changes.
- **Level 3:** Why recompute values during training instead of storing the softmax output? Expected: storing it would mean materializing the N by N matrix, which is the thing the kernel avoids.
- **Level 4:** The newest version is forward-only at launch. What does that mean for your stack? Expected: serving can use it, training keeps the previous version until the backward kernel ships.
- **Level 4:** Is the output identical across batch sizes? Expected: not bit for bit, because the reduction order changes in 16-bit arithmetic; that is a determinism question, not an approximation.

## Wrong answers

- "It drops small attention weights to save work." Nothing is dropped; every key contributes through the running sum.
- "It only helps at very long context." It helps whenever attention is memory-bound, and the lesson reports 2 to 4 times on the earlier accelerator for ordinary lengths.
- "It reduces the FLOPs of attention." The arithmetic is the same; the saving is in memory traffic.

## Taught in

The [KV cache and Flash Attention lesson](../../../phases/07-transformers-deep-dive/12-kv-cache-flash-attention/) explains the tiling, the running softmax and the version table.
