---
id: radix-cache-off-for-predictability
title: The radix cache turned off for predictability
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [debugging, screen, ml-breadth]
tags: [prefix-cache, radix-cache, ttft, shared-prefix, system-prompt]
minutes: 20
lessons: [phases/17-infrastructure-and-production/06-sglang-radixattention]
manuals: [sglang-101#s-radixcache, vllm-101#s-make-repeated-prompts-hit-the-prefix-cache, vllm-101#s-ref-lab-notes]
practice: []
cheatsheet: [sglang-serving]
related: [scenarios/prefix-cache-inflated-benchmark, scenarios/request-id-at-prompt-start, inference-serving/prefix-cache-order]
updated: 2026-11-03
system:
  version: SGLang 0.5.22, with vLLM 0.31.0 as the second engine
  model: Qwen/Qwen3-30B-A3B-Instruct-2507 on the GB10, and Qwen/Qwen3-8B on the L4
  hardware: one GB10 with 128 GB of unified memory, and one L4 with 24 GB of memory
source:
  - manuals/sglang-101/sections/3-3-radixcache.md
  - manuals/sglang-101/capture/gpu/out-gb10/bench-shared-prefix.txt
  - manuals/sglang-101/capture/gpu/out-gb10/no-radix-cache-bench-shared-prefix.txt
  - manuals/sglang-101/capture/gpu/out-l4/server-prefix-default.log
  - manuals/sglang-101/capture/gpu/out-l4/server-prefix-no-radix-cache.log
  - manuals/vllm-101/sections/3-2-make-repeated-prompts-hit-the-prefix-cache.md
  - manuals/vllm-101/sections/r-7-lab-notes.md
---

## Situation

After a benchmark incident in which a warm prefix cache made a loaded server look faster, a platform team writes a new policy: production and benchmarks must agree, so every SGLang server starts with `--disable-radix-cache`, and the vLLM replicas start with `--no-enable-prefix-caching`. The rollout goes out on a Friday.

On Monday a customer whose assistant sends a system prompt of about two thousand tokens with every question reports that the first token now takes several seconds instead of under one, and that the service answers fewer questions per minute at the same user count. The platform team replies that nothing changed in the model or the hardware, and that the new numbers are the "true" ones. You are asked to settle it.

## Evidence

- [the shared-prefix benchmark: four groups of 16 prompts with one system prompt each](evidence/the-shared-prefix-workload.txt)
- [the shared-prefix run on the GB10 with the radix cache on](evidence/gb10-with-the-cache.txt)
- [the same run on the GB10 with --disable-radix-cache](evidence/gb10-without-the-cache.txt)
- [two prefill lines on the L4 with the cache, 2,048 shared tokens](evidence/l4-prefill-with-the-cache.txt)
- [two prefill lines on the L4 without the cache, 4,096 shared tokens](evidence/l4-prefill-without-the-cache.txt)
- [the same test on the other engine, cache on and off by shared length](evidence/the-other-engine.txt)
- [the SGLang table on the L4 by shared length, with the clock caveat](evidence/the-factor-and-its-caveat.txt)

## Questions

1. What does a prefix cache change about the work a server does, and what does it leave the same?
2. From the two GB10 runs, how much did the first token and the throughput move, and which line proves that the same work was requested?
3. Read the four L4 prefill lines. What do `#new-token`, `#cached-token` and `#pending-token` say about each configuration?
4. Both engines were measured. Does the effect belong to one engine, and how does its size depend on the shared length?
5. The policy wanted predictable numbers. Which fix gives that without the cost?

## Walkthrough

1. **Know what the cache saves.** The tree indexes the KV entries of every prompt the server has seen. A new request reuses the longest matching prefix and prefills only the tokens after it. The decode work stays the same, so a cache hit removes prefill time and nothing else. A system prompt that every request repeats is the best case: the whole shared part comes from the tree.
2. **Read the workload.** The kit runs the engine's own shared-prefix benchmark: four groups of 16 prompts, one system prompt of 2,048 tokens per group, a 128-token question on each prompt, and a cap of eight requests at once. The second server starts with the cache disabled.
3. **Compare the two GB10 runs.** Both report 146646 input tokens over 64 requests, so the client asked for the same work. With the cache the run took 28.97 s and gave 141.38 output tokens per second with a median TTFT of 690.96 ms. Without it the run took 50.26 s, the output fell to 81.49, and the median TTFT rose to 2542.06 ms, with a P99 of 3304.86 ms against 2051.54. The input tokens per second tell the same story: 5061.63 with the tree and 2917.46 without. The customer's two complaints, a slower first token and fewer answers per minute, are both in this pair.
4. **Read the L4 prefill lines.** With the cache and a 2,048-token shared prompt, one batch prefilled 405 new tokens and took 12952 from the cache, and the next prefilled 546 new with 17269 cached. Without the cache and a 4,096-token shared prompt, each batch prefilled 4096 new tokens with 0 cached, and 5527 tokens were still pending for the next chunk. Every request paid for its whole prompt, in chunks of the prefill size, while the others waited.
5. **Check the other engine.** On the L4 with vLLM, the cache kept the median first token near 400 ms at every shared length: 408, 488, 396, 410 and 375 ms. Without it the first token grew with the shared part: 392, 753, 1,213, 2,550 and 13,353 ms, and the output fell from 113.6 to 19.6 tokens per second. The manual asks to read the last two rows with care, because the GPU throttled there, and names the 1,024-token row as the clean comparison: about three times the first token and 50 percent more output with the cache. The effect is the same on both engines, and it grows with the shared length.
6. **Bound the factor.** The SGLang table on the L4 reads 479 ms against 14,706 ms at 4,096 shared tokens, 30.7 times, and 4.3 times the throughput. The run without the cache ran at 930 MHz against 1,440 with it, with a thermal flag in 62 percent of its samples, so the manual treats both factors as upper bounds and notes that a 35 percent clock gap cannot explain a factor of 30. Read the GB10 pair, which had no such gap, for the size you can trust.

## Resolution

The policy caused the incident. The cache was never what made the benchmark lie; the method was, because the kit reused one seed on one server and never flushed between runs. Removing the cache from production removed the work-saving that the customer's traffic depends on. On the GB10, the shared-prefix run saw its median TTFT go from 690.96 ms to 2542.06 ms, and its output went from 141.38 to 81.49 tokens per second, for the same 146646 input tokens.

The fix is to turn the cache back on, on both engines, and to make the benchmarks predictable by protocol: flush the cache before each run that you compare, use a new seed per run, and record the cached tokens next to the result. Prove the production fix with `#cached-token` in the prefill lines, which should carry most of each shared prompt, and with the median TTFT of the customer's traffic back near the cached level. Keep the manual's one exception: turn the cache off only to test whether a wrong answer comes from reused KV, and try `--kv-canary log` first.

## Wrong turns

- "The cache made the benchmark lie, so it has no place in production." The benchmark lied because it reused its prompts without a flush. The cache in production serves prompts that really repeat, and the customer's system prompt is exactly that.
- "Only the first token is affected, throughput is unchanged." On the GB10 the output fell from 141.38 to 81.49 tokens per second and the run took 50.26 s instead of 28.97. Prefill that is computed again occupies steps that decode would have used.
- "The effect is an SGLang detail." The other engine moved from 396 to 1,213 ms at 1,024 shared tokens and from 375 to 13,353 ms at 4,096, on the same card.
- "Shorten the customer's system prompt instead." The prompt is the customer's product. A server feature that removes the repeated work is the cheaper fix, and the manual measured no cost from the cache when nothing is shared.
- "Keep it off, because a wrong answer might come from reused KV." That is the one reason the manual accepts, and even then it asks you to try `--kv-canary log` first and to turn the cache off only for the test.

## Generalize

A measurement artifact is fixed in the measurement, not in the system. When a cache or any other state carries over between benchmark runs, reset the state between runs and record it; do not remove the mechanism from production, where the same state is the point. Before you change a default that saves work, measure the traffic that repeats and count what the default saves there.

## Taught in

The SGLang manual measures the pair in [the RadixCache page](../../../manuals/sglang-101/sections/3-3-radixcache.md#the-same-test-on-a-24-gb-l4), the vLLM manual measures the other engine in [the prefix cache page](../../../manuals/vllm-101/sections/3-2-make-repeated-prompts-hit-the-prefix-cache.md) with the full table in [the lab notes](../../../manuals/vllm-101/sections/r-7-lab-notes.md), and [the RadixAttention lesson](../../../phases/17-infrastructure-and-production/06-sglang-radixattention/docs/en.md) teaches the tree and where it wins and loses.
