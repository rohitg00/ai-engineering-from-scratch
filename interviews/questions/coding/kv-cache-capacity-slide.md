---
id: kv-cache-capacity-slide
title: A KV cache that loses its last slot
card: coding
kind: code-reading
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [coding, debugging]
tags: [kv-cache, decode, capacity, sliding-window]
minutes: 10
lessons: [phases/19-capstone-projects/35-gpt-model-assembly]
manuals: []
practice: [kv-cache-append]
cheatsheet: [inference-optimization]
related: [coding/top-k-then-sample]
updated: 2026-11-03
---

A decode loop keeps keys and values in a preallocated cache and attends one query over the stored prefix. Generation always stops one token short of the configured context length, and the first tokens of a long prompt attend to extra zero rows. The cache code is:

```python
class KVCache:
    def __init__(self, max_len, d_k, d_v):
        self.k = np.zeros((max_len, d_k))
        self.v = np.zeros((max_len, d_v))
        self.n = 0

    def append(self, k, v):
        k = np.atleast_2d(k)
        v = np.atleast_2d(v)
        self.n += k.shape[0]
        if self.n >= self.k.shape[0]:
            raise ValueError("cache full")
        self.k[self.n - k.shape[0]:self.n] = k
        self.v[self.n - k.shape[0]:self.n] = v

    def keys(self):
        return self.k
```

Explain the two symptoms from the code and fix them.

## Short answer

The capacity test rejects an append that ends exactly at the capacity, so the last slot is never used and generation stops one token early. The counter is also updated before the test, so a refused append leaves the length wrong. The accessor returns the whole buffer rather than the filled prefix, so attention sees the empty zero rows. Check that the length plus the new steps does not exceed the capacity before touching the counter, and return views of the first `n` rows.

## Full answer

### Defect one: the boundary

An append that fills the cache to its capacity is valid. The test must refuse only when the new length would exceed the capacity. With the strict comparison the last row is dead, and a generation loop that sizes the cache from the context length stops one token short.

### Defect two: the counter

Adding to the length before the check means a failed append leaves the cache claiming steps it never stored. The next call then writes past the real data or refuses a valid append. The rule from the practice is that a refused append changes nothing.

### Defect three: the view

`keys()` returns every row of the buffer, filled or not. The query then attends over zero rows that carry weight after the softmax, which dilutes the output for short prefixes. Return the first `n` rows only.

### The corrected class

```python
    def append(self, k, v):
        k = np.atleast_2d(k)
        v = np.atleast_2d(v)
        if k.shape[0] != v.shape[0]:
            raise ValueError("keys and values differ in steps")
        if self.n + k.shape[0] > self.k.shape[0]:
            raise ValueError("cache full")
        self.k[self.n:self.n + k.shape[0]] = k
        self.v[self.n:self.n + k.shape[0]] = v
        self.n += k.shape[0]

    def keys(self):
        return self.k[:self.n]

    def values(self):
        return self.v[:self.n]
```

The copy into the buffer also protects the cache from later changes to the caller's arrays.

### How this meets the generation loop

The assembly lesson's generator keeps the active window inside the context length by dropping the oldest tokens when the prompt plus the generated tokens would exceed it. A cache with a fixed capacity needs the same rule one level down: either refuse the append and let the loop slide the window, or evict the oldest rows. The practice pins the refusing version so the boundary is explicit.

## Follow-ups

- **Level 3:** What does the decode step do with the stored keys? Expected: it scores one query against every stored key, divides by the square root of the key size, takes a softmax and weights the stored values.
- **Level 3:** A second bug writes every append at row zero. What is the symptom? Expected: new steps overwrite old ones, so attention only ever sees the latest append and the model loses its context.
- **Level 4:** Where does a paged cache change this design? Expected: the capacity becomes a pool of fixed-size blocks shared by requests, so an append that needs a new block can wait or preempt instead of failing the request.

## Wrong answers

- "Use greater-or-equal so the cache never overflows." It also rejects the exact fill and wastes the last slot.
- "Return the full buffer; the zero rows have no effect." Zero keys still get softmax weight and pull the output toward the zero values.
- "Update the count first so the slice indices are simpler." A refused append then corrupts the length.

## Taught in

The [GPT assembly lesson](../../../phases/19-capstone-projects/35-gpt-model-assembly/) bounds generation to the context length with a sliding window, and the [KV cache practice](../../../practice/kv-cache-append/) pins the capacity rule and the filled-prefix views.
