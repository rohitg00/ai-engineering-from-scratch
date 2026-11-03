---
id: temperature-zero-two-answers
title: Temperature zero gave two different answers
card: inference-serving
kind: concept
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [ml-depth, debugging]
tags: [determinism, batch-invariance, prefix-cache, greedy, seed]
minutes: 8
lessons: []
manuals: [vllm-101#s-get-reproducible-outputs, sglang-101#s-deterministic-inference-and-logprobs]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

You run the same evaluation twice at temperature 0 on a serving engine and the scores differ. You send one failing prompt alone and get one answer, then send it inside a busy batch and get another. Nothing in the request changed. Explain what did change, and what a seed can and cannot fix.

## Short answer

The batch changed the arithmetic. Floating-point addition is not associative, and the kernels split their sums by the batch size, so the same request adds its numbers in a different order in a batch of 3 than in a batch of 30; a change in the last bit can flip the top logit, and every later token then follows a different text. The prefix cache does the same, because a request that reuses cached blocks runs a different prefill path, and so does the dtype. A seed fixes only the random draws of sampling, so it is not enough: offline, run the engine in one process with the same order; online, use the batch-invariant mode and pay its speed cost.

## Full answer

### Four things that change one request

- **The batch.** Matrix multiplies, softmax and norms split their sums into tiles, and many kernels pick the split from the batch size.
- **The schedule.** In a multiprocess server, the timing of requests decides which batch each one joins.
- **The prefix cache.** A request that reuses cached blocks computes its prompt in a different way than a request with no hit.
- **The dtype.** BF16 and FP16 round each number differently, so the same model writes different text in the two.

The vLLM seed defaults to 0 and cannot be unset, because speculative decoding needs every worker to sample the same tokens. So a seed is always there, and it is not enough by itself.

### What the manual counted

Greedy outputs of Qwen3-0.6B, 32 ShareGPT questions after one shared system prompt of about 170 tokens, 128 output tokens, compared token by token between two runs. The number in brackets is the median position of the first token that differs:

| Comparison | SGLang | vLLM |
|---|---|---|
| flushed repeat against fresh | 0 of 32 | 0 of 32 |
| cache off against cache off | 0 of 32 | 0 of 32 |
| fresh against warm cache | 21 of 32 (45) | 11 of 32 (57) |
| cache on against cache off | 25 of 32 (26) | 21 of 32 (48) |

At one user and the same cache state, the text repeated exactly. A warm cache changed 21 of 32 outputs on SGLang and 11 of 32 on vLLM. At 64 users sent at once, two runs with the cache off still differed, in 27 of 64 outputs on SGLang and 50 of 64 on vLLM: the batch alone changed most outputs. BF16 against FP16 at one user changed 48 of 64 outputs on vLLM and 51 of 64 on SGLang for the 0.6B model, and 56 and 57 of 64 for Qwen3-1.7B.

The SGLang probe on the GB10 makes the point in one prompt. Sent five times alone and five times inside a batch of 16 at temperature 0, the default server wrote two texts, which parted after 238 characters. The first request alone had computed its prompt from nothing; the four later ones found it in the radix cache. With deterministic mode on, all ten requests wrote the same text.

### What fixes it

| Case | Fix | Cost |
|---|---|---|
| Offline evals with the `LLM` class | `VLLM_ENABLE_V1_MULTIPROCESSING=0`, the same seed, the same prompts in the same order | the engine runs in your process, so the schedule repeats |
| A live server | `VLLM_BATCH_INVARIANT=1`, or `--enable-deterministic-inference` on SGLang | slower kernels for every request |
| Greedy evals that must match exactly | greedy sampling plus one of the two above | as above |

Every fix also needs the same hardware, the same engine version and the same settings. On SGLang the flag replaces the matrix, softmax, norm and batched-multiply operators with batch-invariant kernels, forces the plain sampler, fixes the all-reduce order under tensor parallelism, accepts only some attention backends, turns the radix cache off unless the backend supports it, and gives every request without a `sampling_seed` the seed 42.

### How to test it

Run the same eval twice and compare the outputs token by token, not only the score. Flush the prefix cache or restart the server before each probe. If the outputs differ, take one prompt that differs and run it alone twice. If the two answers match when alone, and the batched probe started from the same cache state, the batch causes the difference. SGLang ships a test that sends one prompt in random batch sizes and counts distinct outputs, with modes for a single prompt, shared prefixes and cached against uncached prefill.

## Follow-ups

- **Level 2:** Which comparisons in the manual's table gave the same text every time? Expected: a repeat after a cache flush against a fresh run, and a repeat with the cache off against the cache off, both 0 of 32 changed on both engines.
- **Level 3:** Why can a warm prefix cache change a greedy answer when the model and the prompt are the same? Expected: a request that reuses cached blocks computes its prompt in a different path than a full prefill, so the logits differ in their last bits, and one changed token changes the rest; it changed 21 of 32 outputs on SGLang and 11 of 32 on vLLM.
- **Level 4:** Under load two cache-off runs still differed. What does that say about the fix? Expected: the batch alone changed most outputs, 50 of 64 on vLLM, so a cache reset is enough only at one user; a live server needs batch-invariant kernels, and the manual did not test that mode at that load.

## Wrong answers

- "Temperature 0 makes the output deterministic." Greedy picks the top logit, and the batch changes the logits in their last bits; the GB10 server gave two texts for one prompt at temperature 0 with nothing in the request changed.
- "Set a seed and the outputs match." The seed only fixes the random draws; the vLLM seed defaults to 0 and cannot be unset, and the outputs still changed with the batch and the cache.
- "Flush the cache before each run and you are done." At one user that was enough, 0 of 32 changed; at 64 users two runs with the cache off still differed in 50 of 64 outputs, because the batch changed the sums.
- "Switch to FP16 for exact results." BF16 and FP16 round differently, so the same model writes different text in the two dtypes, 48 of 64 outputs for the 0.6B model; keep one dtype between runs you compare.

## Taught in

[Get reproducible outputs](../../../manuals/vllm-101/sections/3-8-get-reproducible-outputs.md) and [the SGLang deterministic inference section](../../../manuals/sglang-101/sections/4-6-deterministic-inference-and-logprobs.md) count the changed outputs and list the fixes.
