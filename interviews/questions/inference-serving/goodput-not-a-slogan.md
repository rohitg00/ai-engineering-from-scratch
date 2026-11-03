---
id: goodput-not-a-slogan
title: Why 255 tokens per second is a slogan
card: inference-serving
kind: concept
level: 1
roles: [inference-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [screen, ml-breadth]
tags: [goodput, throughput, p99, ttft, tpot]
minutes: 6
lessons: [phases/17-infrastructure-and-production/08-inference-metrics-goodput]
manuals: [sglang-101#s-sglang-benchmark-serving, vllm-101#s-benchmark-your-server-in-15-minutes]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

A teammate posts in the team channel that the server does 255 tokens per second. Is that a result? What would you ask for, and what single number tells you where to stop adding users?

## Short answer

It is a slogan, not a result, because a throughput number without the latency that came with it describes nothing a user feels. Ask for the concurrency, the median and P99 first token and time per token at that concurrency, the client and the temperature, and the clock. Goodput is the number that sets the limit: the requests per second, or the share of requests, that met every latency target at once, and on the manual's GB10 the BF16 server's goodput was highest at a cap of 4 while its throughput kept rising to a cap of 64.

## Full answer

### The same server, two loads

The 255 came from the manual's own capture. The same server gave that throughput with a median time to first token of 0.8 s at one load and 3.9 s at another:

| Cap | Output tok/s | Median TTFT | P99 TTFT | Median TPOT |
|---|---|---|---|---|
| 1 | 175.15 | 162.98 ms | 270.18 ms | 4.38 ms |
| 8 | 255.63 | 785.79 ms | 2180.87 ms | 22.52 ms |
| 32 | 252.74 | 3917.54 ms | 8262.86 ms | 93.61 ms |

From a cap of 8 to 32 the throughput fell about 1 percent, the median first token got 5 times slower, and the median time per token got 4.2 times slower. The server had no idle compute left to give; new users only waited for a share of the same steps.

### Goodput

Goodput is the share of requests, or the rate of requests per second, that met every latency bound at the same time: the first token under a limit, the time per token under a limit, and the end-to-end time under a limit. A request that misses any one of them is not good. The lesson's rule: high throughput at 60 percent goodput is failure, and lower throughput at 99 percent goodput is the target.

The manual's target was a first token under 1 s and a mean time per token under 100 ms. On the GB10 with Qwen3-30B-A3B:

| Cap | BF16 goodput | BF16 median TPOT | FP8 goodput | FP8 median TPOT |
|---|---|---|---|---|
| 4 | 0.44 req/s | 71.01 ms | 0.80 req/s | 38.60 ms |
| 8 | 0, up to 0.04 in one seed | 102.21 ms | 1.07 req/s | 54.96 ms |
| 16 | 0 | 154.24 ms | 1.10 req/s | 81.90 ms |
| 32 | 0 | 201.91 ms | 0 | 104.12 ms |

BF16 goodput was highest at a cap of 4. At a cap of 8 the median request took longer than 100 ms per token, so at least half of the requests missed the target, and goodput was 0, up to 0.04 in one seed, while throughput at that cap was 74.11 tokens per second and still rising. FP8 held the target up to a cap of 16. Choose the cap from goodput at your own target, and use the throughput curve only to explain it.

### Why the mean is the wrong statistic

The lesson gives the shape: a decode batch with one long prefill neighbour can ship most tokens near 7 ms per token and a few near 60 ms, so the mean reads 9 ms while the P99 reads 65 ms, and users hit the P99 regularly. Report the median, the P90 and the P99 together. The tools also disagree on the definition: for a request with a 500 ms first token and 100 output tokens over 700 ms of decode, one tool that excludes the first token reports 7.07 ms per token and one that includes it reports 12.00 ms. State the tool and the definition with every number.

### Where the knee is, and who enforces it

A closed loop never falls behind, because each client waits for its answer before it sends the next request. A fixed arrival rate does not wait. Under a fixed rate the GB10 BF16 server already had a median time per token of 177.5 ms at 0.5 requests per second and met the target for only 0.07 requests per second, while FP8 met the target for every request up to 1 per second and fell to 0.17 at 2. Enforce the knee outside the engine, in the client or the gateway, because the engine's own admission limit comes from memory and sat at 4096 running requests on that server, far above the knee.

### The floor behind one number

The lesson shows where the time per token comes from on an L4: one decode step reads 16.41 GB of weights, which takes at least 54.7 ms at 300 GB/s, and the measured step took 60.16 ms. A target of 100 ms per token leaves little room on that card for an 8B model in BF16, which is why the pool and the precision matter before the scheduler does.

## Follow-ups

- **Level 1:** Which numbers go next to a throughput figure? Expected: the concurrency or request rate, and the median and P99 of the first token and of the time per token at that point, with the client, temperature and clock as context.
- **Level 2:** Goodput fell to zero at a cap of 8 while throughput still rose. How can both be true? Expected: the server wrote more tokens per second, but the median request took longer than 100 ms per token, so at least half of the requests missed the target and almost none met every bound; throughput counts tokens and goodput counts requests that arrived on time.
- **Level 3:** Why is the mean the wrong statistic for the time per token? Expected: the distribution has a long right tail; a batch with one long prefill neighbour can ship most tokens near 7 ms and a few near 60, so the mean reads 9 ms while the P99 reads 65, and users hit the P99 regularly.
- **Level 4:** Two tools report different time per token for the same run. Why, and what do you do? Expected: one excludes the first token from the inter-token calculation and the other includes it, 7.07 against 12.00 ms in the lesson's example; state the tool and the definition with every number, and keep one tool for every run you compare.

## Wrong answers

- "255 tokens per second is the capacity of the server." The same server gave that throughput with a median time to first token of 0.8 s at one load and 3.9 s at another; the number without its latency is not a result.
- "Add users until throughput stops rising, then stop." On the GB10 the BF16 throughput kept rising to a cap of 64 while goodput was 0 or close to it from a cap of 8; the latency target, not the throughput curve, sets the limit.
- "Report the mean time per token." The distribution is right-skewed, so a mean of 9 ms can hide a P99 of 65; report the median, P90 and P99.
- "The engine's own admission limit protects the users." The engine's limit comes from memory, which runs out long after latency is unacceptable; enforce the knee in the client or the gateway.

## Taught in

[The SGLang benchmark section](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md) and [Benchmark your server in 15 minutes](../../../manuals/vllm-101/sections/5-1-benchmark-your-server-in-15-minutes.md) measure the knee, and [the inference metrics lesson](../../../phases/17-infrastructure-and-production/08-inference-metrics-goodput/docs/en.md) defines goodput.
