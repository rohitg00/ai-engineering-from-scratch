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

A decoder generates 100 tokens one at a time from an empty prompt. Count the attention operations against the prefix for a naive loop and for a loop that keeps the keys and values of earlier tokens. Then tell me what that store deliberately leaves out.

## Short answer

The naive loop recomputes attention over the whole prefix at every step, so the work is 1 plus 2 plus 3 and so on up to 100, which is 5050 operations and grows with the square of the length. With the stored keys and values, each step runs only the new token's query against what is already there, 100 operations in total, linear in the length. The store holds no queries, because a past token never asks a question again; only the newest token does.

## Full answer

### Why the prefix can be reused

Every hidden state of a prefix token is deterministic once it is computed, and the causal mask means it never depends on a later token. So the key and the value of token t are the same at step t plus one as they were at step t. Recomputing them is pure waste.

### The two loops

```text
naive:   step t attends over t tokens        -> 1 + 2 + ... + N = N (N + 1) / 2
cached:  step t attends with one new query    -> N
```

For N equal to 100 the naive count is 5050 and the cached count is 100. The lesson's code prints both and confirms that the outputs match. For a 4K-token response the naive approach costs about 16M attention operations, most of them redundant.

### What is stored

Per layer and per head, two growing lists: the keys and the values of every token so far.

```python
class KVCache:
    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)
```

The memory grows linearly with the generated length; that is the price for the linear compute.

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
- "The store saves memory." It costs memory and saves compute; the trade is linear memory for linear time.
- "Queries must be stored too." A past token's query is never used again.

## Taught in

The [KV cache lesson](../../../phases/07-transformers-deep-dive/12-kv-cache-flash-attention/) counts both loops and the [causal language modeling lesson](../../../phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/) explains why generation is serial.
