---
id: count-attention-ops-with-cache
title: Count the attention work for 100 generated tokens
card: transformers
kind: estimate
level: 1
roles: [inference-engineer, applied-ai-engineer]
rounds: [screen, ml-depth]
tags: [kv-cache, autoregressive, complexity, decoding]
minutes: 6
lessons: [phases/07-transformers-deep-dive/12-kv-cache-flash-attention, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling]
manuals: []
practice: [kv-cache-append]
cheatsheet: [inference-optimization]
related: [transformers/causal-mask-minus-infinity, inference-serving/kv-pool-users-fit]
updated: 2026-11-03
---

A decoder generates 100 tokens one at a time from an empty prompt. Count the token states each loop computes for the prefix: a naive loop, and a loop that caches the key and value vectors of earlier tokens. Then count the query-key comparisons that remain with the store, and name what the store deliberately leaves out.

## Short answer

The naive loop runs every prefix token through the layer again at every step, so it computes 1 plus 2 plus 3 and so on up to 100 token states, which is 5050 and grows with the square of the length. With the stored keys and values, each step computes the state of the new token only, 100 in total. The new query still meets every stored key, so the cached loop still makes 5050 query-key comparisons: the store removes the recomputed key and value vectors, not the comparisons. The store holds no queries, because a past token never asks a question again; only the newest token does.

## Full answer

### Why the prefix can be reused

Every hidden state of a prefix token is deterministic once it is computed, and the causal mask means it never depends on a later token. So the key and the value of token t are the same at step t plus one as they were at step t. Recomputing them is pure waste.

### The two loops

```text
naive:   step t recomputes t token states       -> 1 + 2 + ... + N = N (N + 1) / 2
cached:  step t computes one new token state    -> N
cached:  its one query meets t stored keys      -> N (N + 1) / 2 comparisons
```

For N equal to 100 the naive count is 5050 token states and the cached count is 100. The lesson's code runs a ten-token example and counts query-key comparisons instead: it prints the same count for both loops and confirms that the outputs match. At 100 tokens those comparisons total 5050 in both loops, so the attention step itself still grows with the length at each step. For a response of a few thousand tokens the naive count of token states is in the millions, most of them redundant.

### What is stored

Per layer and per head, two growing lists: the keys and the values of every token so far.

```python
class KVCache:
    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)
```

The memory grows linearly with the generated length; that is the price for not recomputing the prefix.

### Why queries are not stored

The query of a token is used once, at the step where that token is the newest one. After that, the token is only ever looked up, never looking. Storing queries would cost memory and buy nothing.

### What does not go away

Generation is still serial: step t needs the token from step t minus one. The lesson calls this the autoregressive tax. Training avoids it by processing the whole sequence in one masked pass; inference cannot.

## Follow-ups

- **Level 1:** What grows in memory as generation proceeds? Expected: the stored keys and values, per layer and per head, one entry per generated token.
- **Level 2:** Why is a prefix token's key still valid after new tokens arrive? Expected: the causal mask means its hidden state only ever depended on earlier tokens, so later tokens cannot change it.
- **Level 2:** You edit one word in the middle of the prompt. What happens to the store? Expected: everything from that position on is invalid and must be recomputed; the part before it stays valid.
- **Level 3:** When does attention become bound by memory traffic instead of arithmetic? Expected: when the N by N score matrix is large enough that moving it through memory dominates; the lesson puts that at about 2K tokens and beyond.

## Wrong answers

- "The store keeps the attention weights." It keeps keys and values; the weights are recomputed from the new query every step.
- "The store saves memory." It costs memory and saves compute; the trade is memory for the recomputed key and value vectors.
- "Queries must be stored too." A past token's query is never used again.

## Taught in

The [KV cache lesson](../../../phases/07-transformers-deep-dive/12-kv-cache-flash-attention/) counts both loops and the [causal language modeling lesson](../../../phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/) explains why generation is serial.
