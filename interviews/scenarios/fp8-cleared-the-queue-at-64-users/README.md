---
id: fp8-cleared-the-queue-at-64-users
title: FP8 cleared the queue at 64 users
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, system-design]
tags: [fp8, kv-pool, queue, capacity, quantization, goodput]
minutes: 20
lessons: [phases/17-infrastructure-and-production/08-inference-metrics-goodput]
manuals: [sglang-101#s-quantization, sglang-101#s-kv-bytes-per-token-and-the-kv-pool, vllm-101#s-fit-a-bigger-model-with-fp8-weights]
practice: []
cheatsheet: [quantization]
related: [scenarios/fp8-kv-scale-silently-one, scenarios/load-knee-and-admission-cap]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-8B in BF16, against Qwen/Qwen3-8B-FP8 with an FP8 KV cache
  hardware: one L4 with 24 GB of memory
source:
  - manuals/sglang-101/capture/gpu/out-l4/server-load-c64-scheduler.log
  - manuals/sglang-101/capture/gpu/out-l4/server-load-default.log
  - manuals/sglang-101/capture/gpu/out-l4/server-load-fp8.log
  - manuals/sglang-101/capture/gpu/out-l4/server-fp8.log
  - manuals/sglang-101/capture/gpu/out-l4/gsm8k-fp8-accuracy.txt
  - manuals/sglang-101/sections/4-3-quantization.md
  - manuals/sglang-101/sections/3-1-kv-bytes-per-token-and-the-kv-pool.md
  - manuals/vllm-101/sections/2-5-fit-a-bigger-model-with-fp8-weights.md
---

## Situation

A team serves `Qwen/Qwen3-8B` in BF16 on one L4 for an internal assistant. At 64 concurrent users the median first token is about eighteen seconds and the GPU reports full utilization. The on-call engineer reads one decode line from the scheduler log: 38 running requests, a token usage of 0.99 and 26 requests waiting. The team's first plan is a second L4 and a load balancer in front of the pair.

A colleague proposes a checkpoint of this model in FP8, with an FP8 KV cache on the same card. The team worries about accuracy, and about a change of two things at once. You have the startup logs of both servers from the same sweep, one decode line from each at 64 users, the accuracy run and the manual's table.

## Evidence

- [one decode line from each server at 64 users](evidence/two-decode-lines-at-64-users.txt)
- [the BF16 server at startup: weights and pool](evidence/bf16-pool.txt)
- [the FP8 server at startup: weights and pool](evidence/fp8-pool.txt)
- [the FP8 start: the checkpoint detection and the warning about scales](evidence/the-scale-warning.txt)
- [throughput and first token from 1 to 64 users, both servers](evidence/the-sweep-table.txt)
- [what the scheduler log says about 64 users, and the goodput result](evidence/goodput-and-the-cause.txt)
- [GSM8K accuracy on 500 questions for the four SGLang configs](evidence/accuracy-check.txt)

## Questions

1. Read the two decode lines. Why does the BF16 server run 38 requests and not 64, and what does the usage column tell you?
2. From the two startup listings, which two numbers changed, and which of them grew the pool?
3. The FP8 log prints a warning about scaling factors. What does it mean, and what must you check before you trust it?
4. The table shows FP8 faster at one user too. Why does the pool not explain that row?
5. Two things changed at once. What can you claim from this sweep, and what would you still measure before the rollout?
6. Which goodput target did the manual use, and what did each server deliver at 64 users?

## Walkthrough

1. **Read the pool in the decode line.** The BF16 line holds 23810 tokens at usage 0.99, so the pool is full. Each request in the sweep carries 512 input tokens and 128 output tokens, and the manual counts that the BF16 pool holds about 37 such requests. The server ran 38 and parked the other 26 in the queue, and each parked request added its wait to its own first token. The FP8 line runs all 64 requests at 40635 tokens and usage 0.29 with an empty queue. The GPU was busy on both servers, so utilization never showed the difference. The pool did.
2. **Read what changed at startup.** Two numbers moved. The weights took 15.28 GB in BF16 and 8.81 GB in FP8, and the freed memory went to the pool. The cache data type went from bfloat16 to float8_e4m3fn, which halves the bytes per token. Together the pool went from 24094 tokens to 142369, which the manual gives as 5.91 times as many. The data type alone would double the pool, and the smaller weights give the rest. Both servers used one memory fraction, 0.85, so the comparison is fair on memory.
3. **Read the warning.** The FP8 start detects the checkpoint, then prints that no scaling factors were provided and that every scale defaults to 1.0. The checkpoint carries weight scales and no KV scales, so every key and value is stored with a scale of 1.0. The accuracy file says the same in its first line. Before you trust that, search the weight index for tensor names that end in `k_scale` or `v_scale`, and read the load log for scales that the loader skipped. The scenario on the other engine shows what happens when a loader drops scales that exist.
4. **Read the table at one user.** FP8 gave 24.53 output tokens per second against 13.42, and a first token of 140.72 ms against 189.16 ms. At one user the pool does not matter, so this row is the weights. Decode on an L4 reads every weight for every token, and FP8 weights are half the bytes; the manual gives 39.66 ms per token against 60.16 ms. At 32 users the BF16 first token was already 2,969.61 ms against 199.09 ms, and at 64 users it was 18,348.57 ms against 296.42 ms. The BF16 throughput fell from 270.11 to 250.85 tokens per second between 32 and 64 users, because more requests waited.
5. **Read the goodput.** The manual's target was a first token under 1 s and a time per token under 100 ms. BF16 served 0 requests per second within target at 32 and at 64 users. FP8 served 2.87 requests per second within target at 64. That is the number a user feels, and it is the number to put in the proposal.
6. **Read the accuracy check.** On the first 500 GSM8K questions, 8-shot and greedy, the four SGLang configs scored 458, 456, 458 and 460 correct, and every interval overlaps every other. The run did not show a difference. It also cannot rule out a loss of a few points at this sample size, and it covers one model and one benchmark.

## Resolution

The queue was the pool. The BF16 pool of 24094 tokens held about 37 requests of this shape, so 26 of 64 users waited, and the wait went into their first token. FP8 weights and an FP8 KV cache made the pool 5.91 times larger on the same card. At 64 users the queue was empty, the median first token was 296.42 ms, and the server delivered 2.87 requests per second within the goodput target where BF16 delivered none.

The team ships the FP8 pair with three conditions written next to the result. The sweep changed the weights and the cache together, so the gain is claimed for the pair, not for either alone. The KV scale was 1.0 on this checkpoint, and the manual's check for scales in the index and in the load log is recorded with the deployment. The accuracy check on 500 questions bounded the loss at a few points on one benchmark, so the team repeats it on their own prompts before the switch. The second L4 waits until the FP8 pool fills.

## Wrong turns

- "Buy a second L4 and balance across both." The queue came from a pool of 24094 tokens that held about 37 requests. A second card doubles the pool at twice the cost, and the FP8 pool was 5.91 times larger on one card.
- "Change one thing: keep BF16 weights and switch only the KV cache to FP8." A fair experiment, and this sweep did not run it. The manual's evidence for an FP8 cache alone is a field report, and that cache needs a scale file.
- "The accuracy matched, so FP8 is safe for every model." The check covered one model, one benchmark and 500 questions. It bounds the loss at a few points, and a different model can lose more.
- "FP8 is faster per token, so switch for speed." The manual's position is to choose the KV cache data type from memory, not from speed. Here the queue was the symptom and the pool was the cause; the speed gain at one user is a second effect.

## Generalize

When requests queue while the GPU is busy, read the pool before you read the kernels. A full pool is a capacity problem, and the cheapest capacity on one card is bytes per token: smaller weights free memory for the cache, and a smaller cache data type doubles what fits. Pay for it with an accuracy check on your own task, and write down which scale the cache used.

## Taught in

The SGLang manual runs this pair on the L4 in [the quantization page](../../../manuals/sglang-101/sections/4-3-quantization.md#the-same-test-on-a-24-gb-l4) and sizes the pool in [the KV bytes page](../../../manuals/sglang-101/sections/3-1-kv-bytes-per-token-and-the-kv-pool.md), the vLLM manual measures FP8 weights at a fixed pool in [the FP8 weights page](../../../manuals/vllm-101/sections/2-5-fit-a-bigger-model-with-fp8-weights.md), and [the inference metrics lesson](../../../phases/17-infrastructure-and-production/08-inference-metrics-goodput/) defines the goodput that settles the decision.
