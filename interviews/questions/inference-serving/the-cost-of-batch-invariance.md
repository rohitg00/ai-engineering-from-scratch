---
id: the-cost-of-batch-invariance
title: What determinism costs a live server
card: inference-serving
kind: tradeoff
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [design-review, ml-depth]
tags: [batch-invariance, determinism, throughput, prefix-cache, evaluation]
minutes: 10
lessons: []
manuals: [vllm-101#s-get-reproducible-outputs, sglang-101#s-deterministic-inference-and-logprobs]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Your evaluation team wants bit-identical outputs from the live server and asks you to enable batch invariance for all traffic. What does it change, what does it cost, and what would you say?

## Short answer

The mode replaces the kernels that split their sums by the batch size with kernels that keep one reduction order, so one request gives the same logits alone and in a batch. It costs speed, most at low concurrency: on our L4 the small model paid 2.4 times the time per token at one user and 1.4 times at 32, and Qwen3-8B paid 1.4 times at 8 users with 27 percent less output. I would turn it on for evaluation and rollout servers and leave it off for production traffic, after I measured the cost at the concurrency we serve, because on SGLang with the default backend it also turns prefix caching off.

## Full answer

### What the mode switches

On vLLM, `VLLM_BATCH_INVARIANT=1` needs a GPU of compute capability 8.0 or higher, which includes the L4 and the GB10, and it turns off speed features that change the order of the sums, such as custom all-reduce with tensor parallelism. At 0.31.0 it is in beta.

On SGLang, `--enable-deterministic-inference` replaces the matrix multiply, the log-softmax, the mean, the RMS norm and the batched multiply with batch-invariant kernels, forces the plain sampling backend, sets the all-reduce to a tree so that tensor-parallel sums add in a fixed order, accepts only some attention backends, turns the radix cache off unless the backend is one that supports it, and gives every request without a `sampling_seed` the seed 42. The cache rule matters most: with the default backend on the GB10 the log said that the radix cache is not compatible, so every repeated prefix paid its full prefill again. On the L4 the mode picked a different backend that keeps the cache on.

### What the manual measured

vLLM on the L4 with the clock locked at 900 MHz, Qwen3-0.6B, runs in the order default, batch-invariant, default again, two seeds each with a cache reset before each run:

| Users | Median TPOT, default / batch-invariant | Output tok/s, default / batch-invariant |
|---|---|---|
| 1 | 6.9 / 16.9 ms (2.4x) | 140.6 / 58.7 (58% lower) |
| 8 | 9.9 / 18.2 ms (1.8x) | 755 / 420 (44% lower) |
| 32 | 18.8 / 25.9 ms (1.4x) | 1,565 / 1,154 (26% lower) |

On Qwen3-8B at 8 users the time per token was 1.4 times longer and the output 27 percent lower; at 32 users 1.3 times and 23 percent. The relative cost fell as more users shared each step, and it was larger on the small model.

SGLang on the GB10 with Qwen3-30B-A3B, one run per server at concurrency 8: output fell from 78.92 to 64.83 tokens per second, 18 percent, and the median time per token rose from 97.30 to 117.43 ms. The radix cache was off in that run, so a workload with shared prefixes pays more than this number shows.

### What other teams measured

A post on nondeterminism ran 1,000 Qwen3-8B requests on vLLM in 26 s by default, 55 s with batch-invariant kernels, and 42 s with a better attention kernel. A 2026 study measured batch-invariant kernels at more than twice the latency and up to 74 percent less throughput. A verification study found that the modes of both engines gave different logits under some changes in execution, such as prompt chunking and KV cache reuse. The manual did not measure these itself.

### What the mode does not cover

At 0.31.0 a vLLM model that picks its own attention backend skips the check, so its output can still depend on the batch; the next release checks every attention layer, and a fix for expert models with data, tensor and expert parallelism under compile is not in it. On SGLang a hybrid state-space model was reported as not batch-invariant, some newer architectures are not yet supported, a sliding-window kernel gave several greedy outputs in prefix mode with the issue still open, and one speculative algorithm gave different text after a restart because kernel autotuning picked different tactics on each start.

### What I would say

Use the mode where identical bits are the product: reinforcement learning rollouts and evaluations that must reproduce. Keep production traffic on the default kernels, where prefix caching and faster kernels are worth more than identical bits. Measure the cost at the concurrency you serve, not at one point, and test the exact setup: model, attention backend, parallel layout, chunk size and cache setting. Flush the cache between two runs you compare, and keep the dtype the same.

## Follow-ups

- **Level 3:** Why did the relative cost shrink at higher concurrency? Expected: the invariant kernels give up the fast splits that an idle GPU would use, and that loss is a larger share of a small step; with more rows per step the fixed order costs a smaller share, 1.4 times at 32 users against 2.4 at one.
- **Level 3:** On SGLang the 18 percent understates the cost for a chat workload. Why? Expected: with the default attention backend deterministic mode turns the radix cache off, so every repeated prefix pays its full prefill again; pick a backend that keeps the cache where the GPU supports it.
- **Level 4:** Two servers both run the mode and still give different greedy text for one prompt. Name three causes. Expected: different hardware or engine version; a model path the mode does not cover, such as an attention layer that picks its own backend or a hybrid state-space layer; and kernel autotuning that picked different tactics on each start.

## Wrong answers

- "The mode has no cost when the GPU is idle." The cost is largest at low concurrency, 2.4 times the time per token at one user on the small model, because the invariant kernels give up the fast splits that an idle GPU would use.
- "Turn it on for production, because correctness comes first." Production traffic gains more from prefix caching and fast kernels than from identical bits; the manual's position is to use the mode for rollouts and evaluations and to measure the cost at the concurrency you serve.
- "The flag covers every model." At 0.31.0 a model that picks its own attention backend skips the check, hybrid state-space layers are not covered, and a fix for expert models under compile is not in the next release; test the exact setup.
- "The seed 42 makes sampled requests reproducible." It makes every request without a sampling_seed draw the same random numbers, which is reproducible and also identical across users; set a sampling_seed per request that must reproduce.

## Taught in

[Get reproducible outputs](../../../manuals/vllm-101/sections/3-8-get-reproducible-outputs.md) measures the cost on the L4, and [the SGLang deterministic inference section](../../../manuals/sglang-101/sections/4-6-deterministic-inference-and-logprobs.md) lists what the flag switches.
