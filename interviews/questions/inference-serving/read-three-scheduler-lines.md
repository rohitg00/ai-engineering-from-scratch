---
id: read-three-scheduler-lines
title: Read three scheduler log lines
card: inference-serving
kind: code-reading
level: 2
roles: [inference-engineer]
rounds: [debugging, screen]
tags: [scheduler-log, radix-cache, kv-pool, prefill-batch, metrics]
minutes: 8
lessons: []
manuals: [sglang-101#s-the-scheduler-loop-and-schedule-policy, sglang-101#s-radixcache, sglang-101#s-reading-other-peoples-benchmarks]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Here are three lines from two serving engines under load. Read each field and tell me what the server was doing, what the users felt, and which number you would act on.

```text
[2026-10-16 14:01:00] Prefill batch, #new-seq: 7, #new-token: 955, #cached-token: 15102, token usage: 0.05, #running-req: 1, #queue-req: 0, #pending-token: 0, cuda graph: False, input throughput (token/s): 1472.94
[2026-10-16 13:59:09] Decode batch, #running-req: 8, #token: 4075, token usage: 0.02, cuda graph: False, gen throughput (token/s): 98.37, #queue-req: 0
INFO 10-17 22:35:43 [loggers.py:320] Engine 000: Avg prompt throughput: 460.3 tokens/s, Avg generation throughput: 323.6 tokens/s, Running: 40 reqs, Waiting: 11 reqs, GPU KV cache usage: 99.5%, Prefix cache hit rate: 8.7%
```

## Short answer

The first line is a prefill batch on SGLang that admitted 7 requests and computed 955 new prompt tokens while 15,102 came from the radix cache, with the pool 5 percent full and nothing waiting: a shared-prefix workload with the cache working. The second is one decode step for 8 running requests at 98.37 tokens per second with an empty queue: a healthy, lightly loaded server. The third is vLLM at a full pool: 40 running, 11 waiting, the cache 99.5 percent used and a hit rate of 8.7 percent, so new requests wait for memory, and the number to act on is the pool.

## Full answer

### The SGLang prefill line, field by field

- `#new-seq` is how many requests this prefill batch admits: 7.
- `#new-token` is how many prompt tokens it computes: 955. `#cached-token` is how many it reused from the radix tree: 15,102. Seven requests shared one long system prompt that an earlier request had computed, so only their questions were new.
- `token usage` is the share of the KV pool held by running requests and cached prefixes together: 0.05, so the pool is nearly empty.
- `#running-req` counts requests that are decoding: 1. `#queue-req` counts requests that wait: 0. `#pending-token` counts tokens of admitted requests that are not yet prefilled: 0.
- `cuda graph` says whether the step replayed a captured graph. False is expected on a platform without graphs, which is where this line came from.
- `input throughput` is the prefill speed of this batch: 1,472.94 tokens per second.

The same benchmark without the radix cache filled three prefill batches of up to 4,096 tokens for eight requests, every one with `#cached-token: 0`. The 4,096 is the chunked prefill size.

### The decode line

SGLang prints one line per prefill batch and one decode line every 40 decode steps by default. This one shows 8 requests decoding together, 4,075 tokens held, 2 percent of the pool used, 98.37 output tokens per second, and no queue. The lines before it in the same run show how the batch formed: one request admitted while 7 waited, then the other 7 admitted together with 3,553 new tokens at 1,914 tokens per second, then all 8 decoding as one batch. Batching the prefill is where the throughput comes from, and the log shows it happen.

### The vLLM stats line

`Running` and `Waiting` are the running and queued requests: 40 and 11. `GPU KV cache usage` is the share of the pool in use: 99.5 percent. `Prefix cache hit rate` is the share of prompt tokens that came from the cache: 8.7 percent. The prompt and generation throughputs say what the engine did in the interval: it prefilled new prompts at 460.3 tokens per second while 40 requests decoded, so each new prefill shared the step with the running streams. In that run, at 64 users on an L4, the median first token was 10,953 ms and the P99 gap between tokens 1,363 ms. The low hit rate is not a fault: the benchmark sent unique prompts, so there was little to share.

### What to act on

- Line 1: nothing. Confirm that the hits persist as the working set grows, because cached prefixes live in the same pool as running requests.
- Line 2: nothing. The server has room; a sweep would tell you how much.
- Line 3: the pool. Grow it with an FP8 cache or FP8 weights, or run fewer users per replica. A cap on the running count would only choose who waits.

Read the pool line at startup as well. On the same card it said `GPU KV cache size: 24,096 tokens, Maximum concurrency for 8,192 tokens per request: 2.94x`, and the 2.94 assumes that every request fills the maximum length.

### What the lines do not show

None of them show the GPU clock, the client that sent the load, or whether the cache was flushed before the run. Those belong in the result next to the lines.

## Follow-ups

- **Level 2:** In the first line, why is the cached count so much larger than the new count? Expected: the 7 requests shared a long system prompt that an earlier request had already computed, so the tree served it and only the questions were new; the no-cache run of the same benchmark showed batches of 4,096 new tokens and zero cached.
- **Level 3:** The hit rate in the third line reads 8.7 percent. Is the cache broken? Expected: no; the random benchmark sends unique prompts, so there is little to share; the hit rate is a property of the prompts, and the number that matters in that line is the pool at 99.5 percent with 11 waiting.
- **Level 3:** What does the token usage field include, and when should it worry you? Expected: the share of the pool held by running requests and by cached prefixes together; near 1.0 the pool is full, new requests queue, and cached prefixes get evicted.
- **Level 4:** Would a cap on running requests help the server in the third line? Expected: no; the pool is full, so a cap only chooses who waits and moves the wait to the first token; grow the pool with an FP8 cache or FP8 weights, or run fewer users per replica.

## Wrong answers

- "A hit rate of 8.7 percent means the prefix cache is misconfigured." Unique prompts have little to share; the hit rate reflects the prompts, and the same engine read far higher on a shared-prefix run.
- "Token usage at 0.05 means the server is almost idle." It means the pool is nearly empty; the GPU can still be busy, as the 1,472.94 prompt tokens per second show; read the running and queue counts for load.
- "cuda graph: False means something is wrong." It says the step did not replay a captured graph, which is expected on a platform without graphs and during a prefill batch; on CUDA, read it on the decode lines.
- "Waiting: 11 is a small queue, so ignore it." With the pool at 99.5 percent every waiting request waits for a running request to finish, and at 64 users on that card the median first token was 10,953 ms; the pool is the limit.

## Taught in

[The scheduler loop and --schedule-policy](../../../manuals/sglang-101/sections/2-2-the-scheduler-loop-and-schedule-policy.md) and [RadixCache](../../../manuals/sglang-101/sections/3-3-radixcache.md) explain the SGLang lines, and [Reading other people's SGLang benchmarks](../../../manuals/sglang-101/sections/5-3-reading-other-peoples-benchmarks.md) shows the vLLM stats line at a full pool.
