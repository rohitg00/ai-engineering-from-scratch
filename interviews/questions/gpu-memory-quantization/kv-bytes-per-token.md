---
id: kv-bytes-per-token
title: Count the KV bytes per token from the config
card: gpu-memory-quantization
kind: estimate
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [screen, ml-depth]
tags: [kv-cache, bytes-per-token, grouped-query-attention, mla, capacity]
minutes: 8
lessons: []
manuals: [vllm-101#s-count-the-memory-before-you-pick-a-gpu, sglang-101#s-kv-bytes-per-token-and-the-kv-pool, sglang-101#s-quantization]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

You are given two model configs. Model A: 36 layers, 8 KV heads, head size 128. Model B: 48 layers, 4 KV heads, head size 128, and almost four times the parameters. Estimate the KV cache bytes per token of each in BF16, say which one fits more users in a KV pool of the same size, and explain why the parameter count misled you if it did.

## Short answer

KV bytes per token are 2 times layers times KV heads times head size times bytes per value, where the 2 counts the key and the value. Model A, which is Qwen/Qwen3-8B, holds 2 x 36 x 8 x 128 x 2 bytes, which is 144 KiB per token; model B, which is Qwen/Qwen3-30B-A3B, holds 2 x 48 x 4 x 128 x 2 bytes, which is 98,304 bytes or 96 KiB. The bigger model keeps fewer bytes per token and fits more users in the same pool, because the KV heads and the layers decide the cost and the parameter count does not. On one card the bigger model also needs room for weights almost four times larger, so its pool is smaller, and it can fit fewer users in total.

## Full answer

### The formula, checked against a log

```text
KV bytes per token = 2 x layers x KV heads x head size x bytes per value
```

Read the first three numbers from the model config as `num_hidden_layers`, `num_key_value_heads` and `head_dim`. In BF16 a value takes 2 bytes; with an FP8 cache it takes 1 byte. SGLang prints the result at startup. For Qwen3-0.6B the log said `bytes_per_slot=114688`, and the pool line gave every term: 28 layers, 8 KV heads, a head dimension of 128 and bfloat16. The product is 2 x 28 x 8 x 128 x 2, which is 114,688 bytes or 112 KiB. The formula and the log agree to the byte.

### The same arithmetic on public configs

| Model | Attention | Bytes per token in BF16 | Per GPU |
|---|---|---|---|
| Qwen3-0.6B | GQA, 28 layers, 8 KV heads | 112 KiB | 112 KiB on one GPU |
| Qwen3-8B | GQA, 36 layers, 8 KV heads | 144 KiB | 144 KiB on one GPU |
| Qwen3-30B-A3B | GQA, 48 layers, 4 KV heads | 96 KiB | 96 KiB on one GPU |
| Llama-3.1-8B | GQA, 32 layers, 8 KV heads | 128 KiB | 128 KiB on one GPU |
| Llama-3.1-70B | GQA, 80 layers, 8 KV heads | 320 KiB | 40 KiB with 8-way tensor parallelism |
| DeepSeek-V3 | MLA, 61 layers, latent 512 plus 64 | 68.6 KiB | 68.6 KiB on every GPU |

Two results surprise most people. A 0.6B model costs almost as much per token as an 8B model. A 100,000-token conversation on Llama-3.1-8B holds 12.2 GiB of KV, which is close to the size of the weights.

### Why parameters mislead

With grouped-query attention several query heads share one key and value head, so modern models have far fewer KV heads than attention heads, and the KV head count is a design choice that does not follow the parameter count. The mixture-of-experts model has almost four times the weights of the dense 8B model and keeps two thirds of its bytes per token.

Multi-head latent attention stores one compressed latent per token instead of separate keys and values per head. It is small per token, but every tensor-parallel rank stores the full latent, so adding GPUs with tensor parallelism does not add tokens.

### Turn bytes into a pool

The engine gives the cache what is left after the weights and the startup profile. On the GB10 with the 30B model, 31.32 GiB of KV memory at 96 KiB per token holds about 342,000 tokens. On the L4 with Qwen3-8B, a pool of 24,096 tokens at 144 KiB is 3.31 GiB. Divide the pool by the context that one user holds, prompt plus output, for the users that fit. An FP8 cache halves the bytes: for the 30B model each token took 49,152 bytes instead of 98,304, and together with FP8 weights the GB10 pool grew from 227,243 to 1,083,008 tokens.

### Where to read it

vLLM prints `Available KV cache memory` and `GPU KV cache size` with the maximum concurrency at the full length. SGLang prints `bytes_per_slot` or the `KV Cache is allocated` line with the token count, and `max_total_num_tokens` is the result of the whole calculation. Check that the computed number and the log agree before you plan.

## Follow-ups

- **Level 2:** Qwen3-0.6B has 28 layers and 8 KV heads with a head size of 128. What does one token cost, and what did the log say? Expected: 2 x 28 x 8 x 128 x 2 bytes, 114,688 bytes or 112 KiB; the startup log printed bytes_per_slot=114688, so the formula and the log agree to the byte.
- **Level 3:** A dense 70B model with 80 layers and 8 KV heads is split across 8 GPUs by tensor parallelism. What does each GPU hold per token? Expected: 320 KiB in total and 40 KiB on each GPU, because tensor parallelism splits the KV heads across the ranks.
- **Level 4:** Why does the same split not help a latent-attention model? Expected: that attention stores one compressed latent per token, about 68.6 KiB for the 61-layer model, which cannot be split across heads; every rank stores the full latent, so eight GPUs hold eight copies and add no tokens.

## Wrong answers

- "A bigger model always needs more KV cache per token." The layer count and the KV heads decide the cost; the 30B expert model keeps 96 KiB per token against 144 KiB for the 8B dense model.
- "A small model needs a small cache." Qwen3-0.6B keeps 112 KiB per token, almost as much as an 8B model, because it has 28 layers and 8 KV heads.
- "Tensor parallelism always adds KV capacity." It splits the KV heads of a grouped-query model, but a latent-attention model stores the full latent on every rank, so more ranks add no tokens.
- "Count the weights and subtract from the card to get the cache." The engine also keeps a startup profile and graph memory; read the available KV memory and the pool size in the startup log, then divide by the bytes per token.

## Taught in

[Count the memory before you pick a GPU](../../../manuals/vllm-101/sections/2-1-count-the-memory-before-you-pick-a-gpu.md) and [The KV pool and bytes per token](../../../manuals/sglang-101/sections/3-1-kv-bytes-per-token-and-the-kv-pool.md) derive the formula and check it against the logs, and [the SGLang quantization section](../../../manuals/sglang-101/sections/4-3-quantization.md) halves it with FP8.
