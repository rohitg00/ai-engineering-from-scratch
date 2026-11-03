---
id: kv-pool-users-fit
title: How many users fit in the KV pool
card: inference-serving
kind: estimate
level: 2
roles: [inference-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, system-design]
tags: [kv-cache, gpu-memory, capacity, max-model-len]
minutes: 10
lessons: [phases/07-transformers-deep-dive/12-kv-cache-flash-attention]
manuals: [vllm-101#s-count-the-memory-before-you-pick-a-gpu]
practice: []
cheatsheet: [serving-engines-compared]
related: [inference-serving/goodput-sets-the-cap]
updated: 2026-11-03
---

You serve `Qwen/Qwen3-8B` on one GPU with a maximum model length of 8,192 tokens. At startup the server prints a maximum concurrency of 2.94, and a manager asks if the GPU can serve only three users at a time. Your users send about 512 prompt tokens and get about 128 tokens back. How do you answer?

## Short answer

The startup number assumes that every user fills the full maximum model length, and real users hold much less. Count the KV bytes for one token, divide the KV pool by that number, and then divide the pool by the context that one user really holds. On the L4 in the vLLM manual, the pool of 24,096 tokens fits 37 users with 640 tokens each.

## Full answer

### Bytes for one token

Every token in a running request keeps its keys and values in GPU memory until the request ends:

```text
KV bytes per token = layers x KV heads x head size x 2 x bytes per value
```

The factor 2 counts the key and the value. `Qwen/Qwen3-8B` has 36 layers, 8 KV heads and a head size of 128. In BF16 a value takes 2 bytes, so one token takes 144 KiB. The KV heads decide this number, not the parameter count: `Qwen/Qwen3-30B-A3B-Instruct-2507` has more weights but takes 96 KiB for each token.

### From bytes to users

The server gives the KV cache the memory that is left after the weights and the startup profile. The pool line in the log gives the result in tokens:

```text
GPU KV cache size: 24,096 tokens, Maximum concurrency for 8,192 tokens per request: 2.94x
```

The 2.94 divides the pool by the full 8,192 tokens. A user with 512 prompt tokens and 128 output tokens holds 640 tokens at the end of the answer. The same pool holds 37 such users. During the load sweep the log showed 40 running requests with the cache 99.5 percent full, because users early in their answer hold fewer tokens.

### What to change if it is still too small

1. Lower the maximum model length to the longest context that users send. This keeps one long request from taking a large share of the pool. It does not add users here, because the pool stays the same.
2. Use an FP8 KV cache. It halves the bytes per token.
3. Use FP8 weights to free memory for the cache.
4. Use a GPU with more memory, or split the model across GPUs.

## Follow-ups

- **Level 2:** What happens to a request that needs more blocks than are free? Expected: it waits in the queue. A running request that needs a block when none is free is stopped and computed again later.
- **Level 2:** Why does the mixture-of-experts model use less KV memory per token than the dense model? Expected: it has fewer KV heads, and the KV heads, not the weights, set the bytes per token.
- **Level 3:** How do you check your count after a start? Expected: read the memory line and the pool line in the startup log, and compare them with the count from the model config.
- **Level 3:** What is the cost of the FP8 KV cache? Expected: a possible loss of quality, so measure it on your own eval before you ship it.

## Wrong answers

- "Divide the GPU memory by the model size." The weights are only one part. The users that fit depend on the KV pool and on the context per user.
- "The maximum concurrency in the log is the user limit." It assumes that each user fills the maximum model length, which real users do not.
- "More parameters always mean more KV memory per token." The bytes per token depend on the layers, the KV heads and the head size.

## Taught in

The [memory section of vLLM 101](../../../manuals/vllm-101/sections/2-1-count-the-memory-before-you-pick-a-gpu.md) counts the pool from the startup log, and the [KV cache lesson](../../../phases/07-transformers-deep-dive/12-kv-cache-flash-attention/) builds the cache.
