---
id: read-the-tiled-softmax
title: Read the running softmax and find the fragile line
card: transformers
kind: code-reading
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [coding, ml-depth]
tags: [flash-attention, online-softmax, running-max, numerical-stability, code-reading]
minutes: 12
lessons: [phases/07-transformers-deep-dive/12-kv-cache-flash-attention]
manuals: []
practice: [flash-attention-online-softmax]
cheatsheet: [attention-variants]
related: [transformers/flash-attention-is-exact]
updated: 2026-11-03
---

Read this function from the lesson. It computes the attention output for one query against keys and values in blocks of four.

```python
def tiled_softmax_dot(q, K, V, tile=4):
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

Explain the role of `exp_old`, argue that the result equals the one-shot `softmax(qK^T) V`, and point at the input that makes this code produce a NaN.

## Short answer

The loop keeps a running maximum `m` and a running sum `s` over the blocks seen so far. When a block raises the maximum, `exp_old` is the exponential of the old maximum minus the new one, and it rescales the sum and the partial output so that every earlier term is expressed against the new maximum; a block that does not raise the maximum gives `exp_old` of one. At the end each weight is the exponential of its score minus the global maximum, divided by the global sum, which is exactly the stable softmax. The fragile input is a first block whose scores are all minus infinity, as a fully masked block would be: `new_m` stays minus infinity, and `exp_new` evaluates minus infinity minus minus infinity, which is NaN.

## Full answer

### The invariant

After each block, `out` holds the sum over all keys seen so far of `exp(score - m) * v`, and `s` holds the sum of `exp(score - m)`, both relative to the current `m`. The identity that makes the rescale correct is

```text
exp(score - m_new) = exp(score - m_old) * exp(m_old - m_new)
```

so multiplying the old accumulators by `exp(m_old - m_new)` moves them to the new reference point without touching any individual score again. The first block has no old reference, which is why `exp_old` is zero when `m` is still minus infinity: the empty accumulators contribute nothing.

### Why the final division is exact

Division by `s` happens once, at the end, with the global maximum in every exponential. That is the definition of a numerically stable softmax over the whole row, computed without ever holding the whole row. The working set is one block of keys and values and one output vector. The real kernel does this per block of queries, with blocks of keys and values streamed through on-chip memory, and writes each output tile once.

### The NaN

A causal kernel skips blocks that lie entirely above the diagonal; a kernel that applies the mask by setting scores to minus infinity must guard the case where every score in the block is minus infinity. Here `max(-inf, -inf, ...)` is minus infinity, and `exp(-inf - (-inf))` is NaN, which then poisons `s` and `out`. The guard: skip a block whose maximum is minus infinity, or test `new_m` before computing `exp_new`.

### What a reviewer tests

1. Equality with the one-shot softmax on random inputs, within floating-point tolerance.
2. A second block whose scores are all lower than the first block's maximum, so that the rescale path with `exp_old` equal to one is exercised.
3. A block whose scores are all higher, so that `exp_old` is less than one and the earlier terms shrink.
4. A fully masked first block, which must not produce NaN.

## Follow-ups

- **Level 3:** What does a smaller tile cost and buy? Expected: more rescale steps and more loop overhead against a smaller working set on chip; the real kernel picks the tile to fit on-chip memory.
- **Level 3:** Why is `exp_old` set to zero and not one on the first block? Expected: there is no earlier term to carry; the accumulators are empty, and `exp(-inf - new_m)` would be zero anyway for a finite `new_m`.
- **Level 4:** How does the causal mask change the loop in a production kernel? Expected: blocks fully above the diagonal are skipped rather than masked, and partially masked blocks apply minus infinity per entry before the maximum is taken.
- **Level 4:** Where does the backward pass get the softmax values it needs? Expected: it recomputes them from the stored row maximum and row sum instead of storing the N by N matrix.

## Wrong answers

- "`exp_old` is a decay factor like a learning rate." It is an exact change of reference point; the output is identical to the one-shot formula.
- "You could store the scores and normalize at the end." That stores the full row, which is the memory cost the kernel exists to avoid.
- "Each block should be normalized by its own sum." A per-block normalization breaks the global softmax; only the final division is correct.

## Taught in

The [KV cache and Flash Attention lesson](../../../phases/07-transformers-deep-dive/12-kv-cache-flash-attention/) gives this function as the tiled softmax build step.
