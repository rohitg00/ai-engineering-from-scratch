---
id: prefix-cache-inflated-benchmark
title: More load gave a faster first token
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [benchmark, prefix-cache, ttft, experiment-hygiene]
minutes: 25
lessons: [phases/17-infrastructure-and-production/22-load-testing-llm-apis]
manuals: [sglang-101#s-sglang-benchmark-serving, vllm-101#s-benchmark-your-server-in-15-minutes]
practice: []
cheatsheet: [inference-load-testing, sglang-serving]
related: [inference-serving/prefix-cache-order, inference-serving/goodput-sets-the-cap]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-30B-A3B-Instruct-2507
  hardware: one GB10 (DGX Spark)
source:
  - manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md
  - manuals/sglang-101/capture/gpu/out-gb10/server-default.command.txt
  - manuals/sglang-101/capture/gpu/out-gb10/bench-random-c8.txt
  - manuals/sglang-101/capture/gpu/out-gb10/bench-random-c32.txt
  - manuals/sglang-101/capture/gpu/out-gb10/server-default.log
  - manuals/sglang-101/capture/gpu/out-l4/prefix-cache-flush.txt
---

## Situation

A benchmark kit starts one SGLang server with `Qwen/Qwen3-30B-A3B-Instruct-2507` and runs a load sweep against it. Each run sends random prompts of 512 tokens and asks for 128 tokens back. The kit runs each concurrency cap once, one after the other, on the same server.

The report says that a cap of 8 gave a median first token of 677.61 ms, and a cap of 32 gave 390.38 ms. Four times the load gave a faster first token. A teammate wants to publish the result as "the scheduler gets more efficient under load". You review the run before it goes out.

## Evidence

- [The server command](evidence/server-command.txt)
- [The first-token block at a cap of 8](evidence/ttft-cap-8.txt)
- [The first-token block at a cap of 32](evidence/ttft-cap-32.txt)
- [The client arguments](evidence/client-arguments.txt)
- [Two prefill lines from the run at a cap of 32](evidence/prefill-lines.txt)
- [The same caps with three seeds](evidence/three-seed-rerun.txt)
- [One load four times in a row](evidence/flush-test.txt)

## Questions

1. Which explanations fit a median first token that falls when the load rises? Name at least two before you read the logs.
2. The mean and the P99 at a cap of 32 are much higher than the median. What does that shape tell you?
3. What in the client arguments makes two runs send the same prompts?
4. What do the prefill lines prove, and what do they not prove?
5. How do you run the sweep again so that the result is trustworthy?

## Walkthrough

1. **Doubt one sample.** No queue model makes the first token faster under more load. Each cap ran once, so the first suspect is the method, not the scheduler. Write down the candidate causes: a warm cache, a different GPU clock, a different pool, or noise in one run.
2. **Read the whole distribution.** At a cap of 32 the median was 390.38 ms, but the mean was 1166.51 ms and P99 was 2910.22 ms. A median far below the mean says the requests split into a fast group and a slow group. Something made part of the requests cheap.
3. **Read the client arguments.** The run used the random dataset with `seed=7` and `flush_cache=False`. The same seed sends the same first prompts in every run. Nothing cleared the cache between runs on the same server.
4. **Read the server log.** Two prefill batches admitted 14 and 15 requests that needed one new token each, with 6879 and 7634 cached tokens. Those prompts were already in the cache from the run before. A cached prompt skips its prefill, so its first token comes fast.
5. **Count, then test.** The manual counted the prefill lines of each run. At a cap of 32, 64 of the 128 prompts were in the cache before the run started. At a cap of 8, 16 of the 64 were. Half of the requests had the advantage at 32, and a quarter at 8. Then change the variable that the reading blames: run each cap with three seeds, and the 677.61 ms result does not come back.

## Resolution

The prefix cache made the result. The kit reused one seed and one server and never flushed the cache, so each run found the prompts of the run before it. The sweep with seeds 1, 2 and 3 gave a median of 209.98 ms at a cap of 8 and 416.37 ms at a cap of 32. With clean runs, the first token gets slower as the cap grows, as the queue predicts.

The fix is a protocol, not a server flag:

1. Start each run with an empty cache. Pass `--flush-cache` to the benchmark client, call `POST /flush_cache`, or restart the server.
2. Check that the flush ran. The server flushes only when no request runs or waits.
3. Use a new seed for each run, so that the client sends new prompts.
4. Record `sglang:cached_tokens_total` before and after each run, and write the cached tokens next to the result.

A separate test on an L4 measured the size of the effect. A repeat without a flush read a median first token about 4.8 times lower than the fresh run. After a flush, it went back near the fresh run.

## Wrong turns

- "The scheduler batches better at a high cap." A queue can only add wait time. The median fell because the cache removed prefill work.
- "Turn the prefix cache off for the benchmark." Production runs with the cache on. Reset it between runs and record the hits, so that the test measures the real server.
- "Run more requests at each cap with the same seed." More requests with the same seed repeat the same prompts and keep the cache warm.
- "Blame the GPU clock." A clock change can move a result, but the prefill lines show cached tokens, which a clock change cannot make.

## Generalize

A benchmark that repeats its inputs measures its own cache. Before you trust a result that runs against the expected direction, read the full distribution, check which state carries over between runs, and change the one variable that your explanation blames. Run three seeds per point and report the range. The time per token is less exposed to this error than the first token, because a cache hit removes prefill work and leaves the decode work the same.

## Taught in

The [benchmark section of SGLang 101](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md#reset-the-prefix-cache-between-runs) finds this result and its cause, and the [load testing lesson](../../../phases/17-infrastructure-and-production/22-load-testing-llm-apis/) explains why identical prompts in a loop test only one point.
