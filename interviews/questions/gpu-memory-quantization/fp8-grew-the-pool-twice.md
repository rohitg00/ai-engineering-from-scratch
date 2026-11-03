---
id: fp8-grew-the-pool-twice
title: Why FP8 grew the pool 4.77 times and not 2
card: gpu-memory-quantization
kind: estimate
level: 3
roles: [inference-engineer]
rounds: [ml-depth, system-design]
tags: [fp8, kv-pool, gb10, weights, capacity]
minutes: 8
lessons: []
manuals: [sglang-101#s-quantization]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

On a GB10 a BF16 server of Qwen/Qwen3-30B-A3B-Instruct-2507 loads 57.75 GB of weights and sizes a KV pool of 227,243 tokens. You move to the FP8 checkpoint and add `--kv-cache-dtype fp8_e4m3` at the same memory fraction. Estimate the new pool, and explain why it is not simply twice the old one.

## Short answer

Two effects multiply. The FP8 weights fell to 29.75 GB and freed 28.00 GB, which the fraction handed to the pool, so the pool grew from 20.80 GB to 49.58 GB in the units of the log; and each token took half the bytes, 49,152 instead of 98,304 for 48 layers with 4 KV heads of size 128. The pool went from 227,243 to 1,083,008 tokens, 4.77 times as many, and the load time fell from 323.61 s to 152.29 s.

## Full answer

### The two startup logs

The BF16 server loaded the weights in 323.61 s with a memory usage of 57.75 GB and allocated a cache of 227,243 tokens, 20.80 GB in the units of the log. The FP8 server logged `Detected fp8 checkpoint`, then `Using FP8 KV cache but no scaling factors provided. Defaulting to scaling factors of 1.0`, loaded in 152.29 s with 29.75 GB, and allocated 1,083,008 tokens, 24.79 GB for the keys and 24.79 GB for the values. Both used `--mem-fraction-static 0.7`, and neither got a `--quantization` flag, because SGLang reads the method from the checkpoint.

### The arithmetic

The fraction fixes the share for the weights and the pool together. Smaller weights leave more of that share to the pool: the weights freed 28.00 GB and the pool grew by 28.78 GB. At the same time each token needs half the bytes with an FP8 cache. The two factors multiply, which is how 227,243 tokens became 1,083,008. The GB10 has 121.7 GiB of memory, so the BF16 pool was never short in the closed-loop sweep; on the L4, where the weights took most of the card, the same pair grew the pool from 24,094 to 142,369 tokens, 5.91 times.

### Speed moved too

| Concurrency | BF16 output tok/s | FP8 output tok/s | BF16 median TPOT | FP8 median TPOT |
|---|---|---|---|---|
| 1 | 29.14 | 51.50 | 32.52 ms | 18.41 ms |
| 8 | 74.11 | 137.00 | 102.21 ms | 54.96 ms |
| 32 | 150.66 | 283.19 | 201.91 ms | 104.12 ms |
| 64 | 235.38 | 440.86 | 254.06 ms | 131.78 ms |

FP8 gave 1.73 to 1.88 times the throughput at every concurrency. Decode on this machine reads the weights from a memory with modest bandwidth, so half the weight bytes gave almost twice the speed. That is a different result from a field report of an FP8 cache alone, which was a few percent slower per token and won on capacity.

### The scales

The second log line is the warning. No scale file was given, so every KV scale is 1.0. The weight index of this FP8 checkpoint lists weight scales and no KV scales, so weight scales do not imply cache scales. Both servers wrote the same 12 tokens for one greedy prompt, which is not an accuracy check. The GSM8K check on 500 questions, run on the L4 with the 8B model, gave overlapping intervals for every FP8 configuration, and that is the shape of check to run on your own model.

## Follow-ups

- **Level 3:** Why did the pool grow 4.77 times and not 2 times? Expected: halving the bytes per token doubles the tokens in the same memory, and the smaller weights also gave the pool 28.78 GB more memory; the two factors multiply.
- **Level 3:** Why was the ratio 5.91 on the L4 and 4.77 on the GB10 for the same change? Expected: on the 24 GB card the weights took most of the memory, so halving them more than doubled the pool bytes; on the GB10 the weights were a smaller share, so the freed memory mattered less.
- **Level 4:** Both servers returned an identical 12-token answer to the first request at temperature 0. Is that an accuracy check? Expected: no, one prompt proves nothing; run a benchmark such as the 500-question GSM8K set and compare the intervals, and read the scale warning, because this checkpoint has weight scales and no KV scales, so the cache ran with a scale of 1.0.

## Wrong answers

- "FP8 halves the bytes, so the pool doubles." The weights also shrank from 57.75 to 29.75 GB and that memory went to the pool, so the pool grew 4.77 times on the GB10 and 5.91 times on the L4.
- "The FP8 checkpoint has scales, so the KV cache is calibrated." Its weight index lists weight scales and no KV scales; the server logged that it used a scale of 1.0 for the cache.
- "Pass --quantization fp8 so that the server knows." SGLang detected the checkpoint by itself, and a flag that does not match the checkpoint raises at startup; pass no flag for a published checkpoint.
- "The speedup comes from the bigger pool." The BF16 pool on the GB10 was never short; the speed came from half the weight bytes per decode step on a memory with modest bandwidth, 1.73 to 1.88 times at every concurrency.

## Taught in

[The SGLang quantization section](../../../manuals/sglang-101/sections/4-3-quantization.md) has both startup logs and the sweep.
