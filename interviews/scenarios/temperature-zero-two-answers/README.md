---
id: temperature-zero-two-answers
title: Temperature 0 still gave two answers
card: scenarios
kind: incident
level: 3
roles: [ai-evaluation-reliability-engineer, inference-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth]
tags: [determinism, greedy, batch-invariance, prefix-cache, dtype, evals]
minutes: 25
lessons: []
manuals: [sglang-101#s-deterministic-inference-and-logprobs, vllm-101#s-get-reproducible-outputs, sglang-101#s-sglang-benchmark-serving]
practice: []
cheatsheet: []
related: [scenarios/prefix-cache-inflated-benchmark]
updated: 2026-11-03
system:
  version: SGLang 0.5.22 and vLLM 0.31.0
  model: Qwen/Qwen3-30B-A3B-Instruct-2507 on the GB10, and Qwen/Qwen3-8B-FP8 and Qwen/Qwen3-0.6B on the L4
  hardware: one GB10 with 128 GB of unified memory, and the shared second L4 of a two-GPU node
source:
  - manuals/sglang-101/capture/gpu/out-gb10/determinism.txt
  - manuals/sglang-101/capture/gpu/out-gb10/deterministic-determinism.txt
  - manuals/sglang-101/capture/gpu/out-gb10/server-deterministic.log
  - manuals/sglang-101/capture/gpu/out-l4/livecheck-2026-10-23.txt
  - manuals/vllm-101/capture/gpu/out-l4/greedy-output-cache-batch-dtype.txt
  - manuals/vllm-101/capture/gpu/out-l4/batch-invariant-cost.txt
  - manuals/vllm-101/capture/gpu/out-l4/livecheck-2026-10-22.txt
---

## Situation

An evaluation team runs its benchmark twice against the team's serving endpoint, at temperature 0, with an identical prompt list in an identical order. The two scores differ by about a point. They take one question whose answer changed and send it alone, twice. The two texts are identical. Then they send it alone five times and inside a batch of 16 five times, against a GB10 server that runs a model with mixture-of-experts layers. The first of the five single requests gives one text. The next four give another text, which leaves the first after a few hundred characters. All five batched requests give the first text again.

The ticket says that the weights or the tokenizer must be corrupt, because temperature 0 is deterministic by definition.

## Evidence

- [the summary of the probe on the default GB10 server](evidence/probe-summary-default.txt)
- [the same probe on the L4, default server against the deterministic flag](evidence/probe-on-the-l4.txt)
- [three startup lines of the GB10 server with the deterministic flag](evidence/what-the-flag-switched.txt)
- [the summary of the probe with the deterministic flag on the GB10](evidence/probe-summary-deterministic.txt)
- [how many greedy outputs changed with the cache state and with the batch, both engines](evidence/cache-and-batch.txt)
- [how many greedy outputs changed between BF16 and FP16](evidence/dtype.txt)
- [the speed cost of the batch-invariant mode on vLLM, clock locked](evidence/batch-invariant-cost.txt)

## Questions

1. Temperature 0 takes the token with the highest logit. What can change the logits of one prompt between two requests on a serving engine, when nothing in the request changes?
2. In the GB10 probe the first of the five single requests differed from the next four, and the batched requests matched the first. Explain both facts with one mechanism.
3. On the L4 the default server gave three texts: A, B, B, B, B, then C, B, B, B, B. What did the batch add?
4. The deterministic flag made all ten requests match. List what it switched, and what each switch costs.
5. The counts table separates three causes. Which one does a cache reset fix, which one needs batch-invariant kernels, and which one is neither a bug nor fixable by a flag?
6. Write the protocol for an evaluation that must repeat exactly, and say what you give up for it.

## Walkthrough

Floating-point addition is not associative. A matrix multiply, a softmax or a norm splits its sums into tiles, and many kernels pick the split from the batch size and from the path that the prompt takes. A difference in the last bit can change which token has the highest logit, and after one different token every later token is conditioned on a different text. So the request did not change, the arithmetic around it did.

The first summary has three counts. Five requests alone gave two distinct texts, five requests in a batch gave one, and all five batched texts matched the first request alone. Our reading, from the manual: the first request computed its prompt from nothing, and the four later ones found the prompt in the radix cache and ran a different prefill path. The 238 characters that the two texts share are the tokens before the first bit flipped. The L4 probe adds the batch. On the default server the pattern was A, B, B, B, B, C, B, B, B, B: the first request alone differed from the four later ones, and one batched request landed on a third text. The batch changed the tile split once more.

The third listing shows what the flag did at startup on the GB10. The sampling backend moved to the PyTorch sampler. With no attention backend given, the server fell back to FlashInfer and listed the six backends that the mode accepts. And the radix cache went off, because at this version the cache is not compatible with FlashInfer in deterministic mode. On the L4 the same flag fell back to `fa3`, which keeps the radix cache on. The fourth summary is the result on the GB10: one distinct text alone, one in the batch, and all five batched matching alone. The price on the GB10 was 18 percent of the throughput at a concurrency of 8, from 78.92 to 64.83 tokens per second, with the median time per token up from 97.30 to 117.43 ms, and the workload paid again for every repeated prefix.

The fifth listing separates the causes at one user. A repeat after a cache flush changed 0 of 32 outputs, and so did a repeat with the cache off, on both engines. The same prompts against a warm cache changed 21 of 32 outputs on one engine and 11 of 32 on the other. At 64 requests sent at once, two runs with the cache off still differed in 27 of 64 and 50 of 64 outputs, so the batch alone changed most outputs and the cache effect could not be separated at that load. The dtype listing is the third cause: BF16 against FP16 changed 51 of 64 and 48 of 64 outputs for the small model, and a repeat in the same dtype changed none. The last listing is the cost of the other engine's fix. With the clock locked, the batch-invariant mode made the time per token 2.4 times longer at one user on the small model and 1.4 times at 8 users on the 8B model, with 58 and 27 percent less output. The probe on that engine gave identical text alone and in a batch of 32 with the mode on, and different text with it off.

## Resolution

The weights and the tokenizer were fine. A repeat after a cache flush gave identical text for every prompt. Three causes changed the scores: the prefix cache, which ran a different prefill path for a warm prompt, the batch that each request landed in, and the dtype, which the team had not held fixed between the two endpoints.

When an evaluation must repeat exactly, flush the cache or restart the server between the two runs, keep the dtype, the engine version and the hardware the same, and run one request at a time. That gives an exact repeat with no flag. Under load, turn on the deterministic mode or the batch-invariant mode and pay for it: 18 percent of the throughput on the GB10 at a concurrency of 8, and 1.4 to 2.4 times the time per token on the other engine. Set a sampling seed on every request that samples. Compare outputs token by token, not only scores, and run the engine's determinism test on your model, your backend and your parallel layout before you rely on it. Leave the mode off for production traffic, where the cache and the faster kernels are worth more than identical bits.

## Wrong turns

- "The weights or the tokenizer are corrupt." A repeat after a cache flush changed 0 of 32 outputs on both engines, so every text matched. Corrupt weights do not heal with a flush.
- "Set a seed and the problem goes away." Greedy decoding samples nothing, and the engine already fixes a seed. The order of the sums changed, and a seed does not touch it.
- "Turn the deterministic flag on in production." It cost 18 percent of the throughput at a concurrency of 8 and turned the radix cache off on the default backend. Pay that for evaluations and rollouts, not for users.
- "The scores are within a point, so the runs agree." Two runs can land on the same score with different outputs, and the next run can land elsewhere. Compare the tokens.
- "Temperature 0 is deterministic by definition." It picks the largest logit, and the logits changed with the cache state, the batch and the dtype. The GB10 gave two texts from one prompt with nothing in the request changed.

## Generalize

Determinism is a property of the whole execution, not of the sampling rule. Any change in the batch, the cache state, the data type, the kernel or the hardware can move a logit by one bit and the text by a paragraph. Decide which of those you hold fixed, measure what the fix costs, and write the cache setting and the cached tokens next to every evaluation result.

## Taught in

The SGLang manual runs the probe and lists the switches in [the deterministic inference page](../../../manuals/sglang-101/sections/4-6-deterministic-inference-and-logprobs.md) and gives the flush route in [its benchmark page](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md), and the vLLM manual counts the three causes and prices its own fix in [the reproducibility page](../../../manuals/vllm-101/sections/3-8-get-reproducible-outputs.md).
