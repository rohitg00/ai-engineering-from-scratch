---
id: the-kv-cache-trap
title: The model is 35 GB now, so it fits
card: gpu-memory-quantization
kind: concept
level: 1
roles: [inference-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-breadth]
tags: [kv-cache, gpu-memory, quantization, capacity]
minutes: 5
lessons: [phases/17-infrastructure-and-production/09-production-quantization]
manuals: [vllm-101#s-count-the-memory-before-you-pick-a-gpu, sglang-101#s-kv-bytes-per-token-and-the-kv-pool]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

A teammate says: we quantized the 70B model to 4-bit, so it is 35 GB now and it fits on one 80 GB card with room to spare. What is missing from that sentence?

## Short answer

The KV cache. Weight quantization shrinks the weights, and the cache for the running requests is a separate budget that stays in BF16 or FP8 and grows with every token in flight; at 128 concurrent requests with a 2k context the lesson puts it near 20 GB for a 70B model, plus about 5 GB of activations, so the total is about 60 GB on the 80 GB card. That 20 GB is the lesson's rough figure, so check it against the config: Llama-3.1-70B keeps 320 KiB per token in BF16, and 128 full 2k-token requests then need about four times the lesson's figure, which does not fit beside the weights on one 80 GB card. Count the weights, the cache at your peak concurrency and context, and the activations together, and read the pool size in the startup log after the start.

## Full answer

### The budget has three parts

The lesson's own count for a 70B model with 4-bit weights:

| Part | Size |
|---|---|
| Weights, 4-bit from 140 GB in FP16 | about 35 GB |
| KV cache at 128 concurrent requests with a 2k context | about 20 GB |
| Activations | about 5 GB |
| Total | about 60 GB |

The sentence "it is 35 GB now" forgets the cache and the activations. Budget the card as a whole, and count the cache from the config of your model: Llama-3.1-70B keeps 320 KiB per token in BF16, so at full 2k contexts its cache alone is about four times the 20 GB in the table.

### Where the cache goes

Every token in a running request keeps its keys and values in GPU memory until the request ends. The bytes per token come from four numbers in the model config: layers times KV heads times head size times 2 for the key and the value, times the bytes per value. Qwen3-8B keeps 144 KiB per token in BF16 and Qwen3-30B-A3B keeps 96 KiB, because the KV heads decide the number and the parameter count does not. The engine gives the cache what is left after the weights and the startup profile, and the users that fit are the pool divided by the context that one user holds, prompt plus output. On the GB10 the weights of the 30B model took 56.93 GiB, 31.32 GiB was left for the cache, and at 96 KiB per token that is about 342,000 tokens.

### KV quantization is its own decision

An FP8 cache halves the bytes per token, which doubles the users at the same length. It is a separate choice from the weight format, with its own scales and its own effect on the attention values, so it needs its own accuracy check. Quantizing the weights does not shrink the cache.

### How to fit more, in order of cost

1. Lower the maximum model length to the longest real request. This does not grow the pool, but it stops one request from claiming all of it.
2. Use an FP8 KV cache.
3. Use FP8 or 4-bit weights, which free memory for the cache.
4. Use a GPU with more memory, or split the model.

### Read the log

Read two lines after every start: the weight load line and the available KV cache memory line. The pool line then gives the tokens and the maximum concurrency at the full length, which assumes that every user fills the maximum; real users hold less, so more fit.

## Follow-ups

- **Level 1:** Which three things take memory on a serving GPU? Expected: the weights, the KV cache for the tokens in flight, and the activations with the startup working memory; the engine gives the cache what is left after the other two.
- **Level 2:** What does the KV cache grow with? Expected: the number of running requests and the context that each one holds, prompt plus output, so it grows with concurrency and with length, not with the weights.
- **Level 3:** Quantizing the weights to 4-bit and quantizing the cache to FP8 are different decisions. Why? Expected: the weights are a fixed cost and their quantization changes the matrix math; the cache is per token and its quantization changes the attention values directly, so it needs its own accuracy check and its own scales.
- **Level 4:** Where in the startup log do you confirm that the budget held? Expected: in the weight load line, the available KV cache memory line and the pool size line with its maximum concurrency; divide the pool by prompt plus output per user rather than by the maximum length.

## Wrong answers

- "The model is 35 GB, so the rest is free for users." The KV cache and the activations take their share first; at 128 concurrent requests with a 2k context the lesson puts the cache near 20 GB and the total near 60 GB.
- "Quantizing the weights also shrinks the cache." The cache stays in its own dtype; it halves only if you quantize the cache, which is a separate choice with its own accuracy effect.
- "The cache is small because the model is small." The bytes per token depend on the layers and the KV heads; a 30B expert model keeps 96 KiB per token and an 8B dense model 144 KiB.

## Taught in

[The production quantization lesson](../../../phases/17-infrastructure-and-production/09-production-quantization/docs/en.md) names the trap, and [Count the memory before you pick a GPU](../../../manuals/vllm-101/sections/2-1-count-the-memory-before-you-pick-a-gpu.md) counts the cache.
