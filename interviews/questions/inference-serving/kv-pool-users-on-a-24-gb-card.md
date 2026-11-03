---
id: kv-pool-users-on-a-24-gb-card
title: How many users fit in a 24,096-token pool
card: inference-serving
kind: estimate
level: 2
roles: [inference-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, system-design]
tags: [kv-cache, capacity, max-model-len, l4]
minutes: 8
lessons: []
manuals: [vllm-101#s-count-the-memory-before-you-pick-a-gpu, vllm-101#s-serve-long-contexts-and-hybrid-models, sglang-101#s-quantization]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

You serve Qwen/Qwen3-8B in BF16 on one L4 with 24 GB of memory. The startup log prints a KV pool of 24,096 tokens and the line `Maximum concurrency for 8,192 tokens per request: 2.94x`. Your traffic sends about 512 prompt tokens and asks for 128 output tokens. How many users can run at once, and what does the 2.94 tell you?

## Short answer

Divide the pool by the tokens that one user holds at the end of a request, not by the maximum model length. A request of 512 prompt tokens and 128 output tokens holds 640 tokens, so the 24,096-token pool fits about 37 users at their full length. The 2.94 assumes that every user fills the 8,192-token limit, which real users do not.

## Full answer

### Count the bytes first

KV bytes per token = layers x KV heads x head size x 2 x bytes per value. For Qwen/Qwen3-8B that is 36 x 8 x 128 x 2 x 2 bytes, which is 144 KiB. A pool of 24,096 tokens at 144 KiB is 3.31 GiB of cache. The pool is what is left after the weights and the startup profile.

### Turn tokens into users

```text
users that fit = KV pool in tokens / (prompt tokens + output tokens per user)
```

At 640 tokens per user, 24,096 tokens hold about 37 users at their full length. The 2.94 in the log is the same pool divided by the 8,192-token limit of the server. During the manual's load sweep the log showed 40 running requests with the cache 99.5 percent full. Users early in their answer hold fewer tokens, so more of them run than the full-length count says.

### What the count does not tell you

If you do not set `--max-model-len`, vLLM takes the length from the model config. For Qwen/Qwen3-8B that is 40,960 tokens. One request at that length needs 5.6 GiB of KV cache. On a 24 GB card the 16.4 GB of weights can leave room for less than one such request, and the start fails. Set the limit to the longest prompt plus answer that your users send. The pool stays the same size; the limit only stops one request from claiming all of it.

### The same card on SGLang

SGLang sized 24,094 tokens for itself on the same card. At 64 users its BF16 server ran at most 38 requests, with token usage at 0.99 and 26 requests in the queue. The FP8 server on the same card had a pool of 142,369 tokens and ran all 64 requests at token usage 0.29 with an empty queue. The pool, not the weights, set the user count.

### Four ways to fit more, in order of cost

1. Lower the maximum model length to the longest real request. This does not grow the pool.
2. Use an FP8 KV cache. It halves the bytes per token.
3. Use FP8 weights. They free memory for the cache.
4. Use a GPU with more memory, or split the model.

## Follow-ups

- **Level 2:** A teammate says the card holds two users because the log says 2.94x. What do you tell them? Expected: the log divides the pool by the maximum model length; a real request holds 640 tokens, so about 37 fit, and the log showed 40 running.
- **Level 3:** The pool is full and requests queue. Which change grows the pool and which does not? Expected: an FP8 KV cache halves the bytes per token and FP8 weights free memory, so both grow the pool; a lower maximum model length leaves the pool the same size and only stops one request from taking all of it.
- **Level 4:** Why did the log show 40 running requests in a pool that holds 37 full-length requests? Expected: a request takes blocks as it grows, so a request early in its answer holds fewer than 640 tokens; the running count can pass the full-length count until most requests near their end.

## Wrong answers

- "The weights decide how many users fit." The weights are a fixed cost; the KV cache grows with every running token, so the pool in tokens decides the users.
- "Lower --max-model-len to fit more users." The pool stays the same size; a lower limit only stops one long request from claiming the whole pool and lets the start check pass.
- "Divide the pool by the prompt length." A request also holds its output tokens until it ends, so divide by prompt plus output, 640 here, not by 512.

## Taught in

[Count the memory before you pick a GPU](../../../manuals/vllm-101/sections/2-1-count-the-memory-before-you-pick-a-gpu.md) and [the SGLang quantization section](../../../manuals/sglang-101/sections/4-3-quantization.md) size the same pool on the same card, and [the long context section](../../../manuals/vllm-101/sections/2-6-serve-long-contexts-and-hybrid-models.md) covers the model length.
