---
id: design-a-chat-service-on-l4s
title: Design a chat service on a fleet of L4 cards
card: inference-serving
kind: design
level: 4
roles: [inference-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design]
tags: [capacity, goodput, fp8, prefix-cache, admission, l4]
minutes: 15
lessons: []
manuals: [vllm-101#s-tune-chat-for-many-users, sglang-101#s-quantization, sglang-101#s-sglang-benchmark-serving, sglang-101#s-eviction-policies-and-hicache]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Design the serving layer for a chat product on a fleet of L4 cards with Qwen/Qwen3-8B. The target is a first token within 1 second and 100 ms or less per token for the P99 user. Every request shares a 2,048-token system prompt, and sessions run for several turns. How many users per card, which precision, which caps, and what do you measure before launch?

## Short answer

Size from the pool and the knee, not from throughput. In BF16 the 24,094-token pool on an L4 holds about 37 requests of 640 tokens, and with a cache reset the P99 gap between tokens at 16 users was already 522 ms, so a BF16 replica meets the target for well under 16 users; the FP8 checkpoint with an FP8 cache grows the pool to 142,369 tokens and served 2.87 requests per second within the same target at 64 users, where BF16 served none. So I would serve FP8 after an accuracy check on our prompts, put the shared system prompt first so that the cache holds it, keep the pool large enough for the sessions that return, cap users per replica at the measured knee in the gateway, and run the sweep with a flush, a clock record and a mixed length distribution before launch.

## Full answer

### Users per card

The knee on an L4 in BF16 sits between 8 and 16 users once the prefix cache is reset before each run. With the reset, 50 percent of requests met the target at 8 users against 75 to 81 percent without it, and at 16 users the share fell from about 65 percent to 25 percent, with a P99 ITL of 522 ms against 82 to 84 ms unflushed. The median first token with the reset was about 650 ms at 4 users, 951 to 978 ms at 8, and 1,550 to 1,587 ms at 16. Under a fixed arrival rate, both precisions met the target for every request up to 1 request per second; BF16 held 0.88 requests per second within target at 2 offered and none from 4, while FP8 held 3.18 at 4 offered. So a BF16 replica carries a handful of chat users, and an FP8 replica several times more; the sweep decides the exact count.

### Precision

On the same L4 the FP8 checkpoint with an FP8 cache changed the shape of the whole curve:

| Concurrency | BF16 output tok/s | FP8 output tok/s | BF16 median TTFT | FP8 median TTFT |
|---|---|---|---|---|
| 1 | 13.42 | 24.53 | 189.16 ms | 140.72 ms |
| 16 | 201.09 | 313.92 | 211.78 ms | 147.52 ms |
| 32 | 270.11 | 507.20 | 2,969.61 ms | 199.09 ms |
| 64 | 250.85 | 735.91 | 18,348.57 ms | 296.42 ms |

The pool explains it: 24,094 tokens against 142,369. At 64 users the BF16 server ran at most 38 requests at a token usage of 0.99 with 26 in the queue; the FP8 server ran all 64 at 0.29 with an empty queue. Goodput at the target was 0 for BF16 at 32 and 64 users and 2.87 requests per second for FP8 at 64. The accuracy check on 500 GSM8K questions gave overlapping intervals for every FP8 configuration, with a KV scale of 1.0 because this model has no scales; run the same check on your own prompts, and read the scale warning in the startup log.

### The shared prompt and the sessions that return

Put the shared system prompt first and keep it byte-identical, with the tool list in a fixed order and nothing that changes per request before the user turn. The pool must then hold the working set. On the L4 with a 2,048-token prompt per group of users, the 24,094-token BF16 pool held about 11 such prompts: at 4 groups the median first token was 360 ms, at 16 groups the GPU-only server evicted prompts it needed again and the first token rose to 3,259 ms, and at 32 groups to 5,449 ms. A host tier held the evicted prompts and gave 553 ms at 16 groups and 817 at 32; at 64 groups the prompts needed more than the GPU and host pools together and the host tier only cut the wait to 3,610 ms from 6,821. With FP8 the pool holds far more prompts, so the first fix for the working set is the pool, and the host tier comes after.

Multi-turn sessions add the same problem over time. In an 8,192-token pool a trace of 24 sessions made the default eviction thrash: the hit rate fell to about 1.5 percent at turns 5 and 6, and a different policy only lifted it to 25 to 34 percent there. A 16,384-token pool reached 0.69 over the whole trace with every policy. Grow the pool before you change the policy, and route each session to the same replica so that its prefix is where it returns.

### Caps

Enforce the knee in the gateway, not only in the engine. The engine admits until memory runs out, and a cap on the engine only chooses who waits: at 32 users on the L4 a cap of 16 moved the median first token from 1.8 to 12.3 s and cut output by 38 percent. Set the gateway limit one or two steps below the measured knee, and shed or queue above it. A second guard on the engine at the same count does no harm.

### Before launch

1. Sweep concurrency with a flush and a new seed before every run, and record the cached tokens. The unflushed sweep put the knee between 16 and 32 users; the flushed one put it between 8 and 16.
2. Record the SM clock and the temperature of every run, cool the card between runs, and set aside runs under a clock floor. Under an open-loop overload the L4 fell from 1,320 to 465 MHz with 70 percent of samples in thermal slowdown, so overload costs throughput as well as latency.
3. Run your real length mix. Fixed lengths form waves and gave a median time to first token of 1,996 ms with a P99 ITL of 82 ms at 16 users; mixed lengths gave 291 ms and 300 ms. The two shapes measure two different servers.
4. Run a fixed arrival rate as well as the closed loop, because real users do not wait for each other.
5. Choose the limit from goodput at the target, and read the P99 ITL next to the first token.

## Follow-ups

- **Level 3:** Why not take the user count from the throughput peak of the sweep? Expected: throughput peaked at 32 users while no request met the target there, and the knee with a reset was between 8 and 16 users; goodput at the target sets the limit and throughput only explains it.
- **Level 4:** The product adds long sessions that return after minutes. What changes? Expected: the working set grows past the GPU pool, the default eviction drops each session just before it returns, and the hit rate collapses, about 1.5 percent at later turns in an 8,192-token pool; grow the pool first, route each session to the same replica, and add a host tier only when the working set is larger than the GPU pool and smaller than the GPU and host pools together.
- **Level 4:** Traffic doubles for an hour. What protects the users? Expected: a limit at the gateway that sheds or queues above the knee, because the engine admits until memory runs out and a cap on the engine only moves the wait to the first token, and because a passively cooled L4 under overload also loses clock, from 1,320 to 465 MHz, so overload costs throughput as well as latency.

## Wrong answers

- "Run 32 users per card; the sweep showed 275 tokens per second there." No request met the target at 32 users, where the P99 ITL was 613 ms; the knee with a cache reset was between 8 and 16 users.
- "Keep BF16, FP8 is a quality risk we cannot take." On 500 GSM8K questions every FP8 interval overlapped BF16, and FP8 was the difference between zero and 2.87 requests per second within target at 64 users; run the check on your prompts and decide on evidence.
- "Set the engine cap at the knee and you are done." The engine cap only chooses who waits and moved the first token to 12.3 s at 32 users; enforce the knee in the gateway and shed load above it.
- "Benchmark with fixed 512-token prompts, that is the standard." Fixed lengths form waves and gave a first token of 1,996 ms with a P99 ITL of 82 ms, while mixed lengths gave 291 and 300 ms; test your real length mix before you set the limit.

## Taught in

[Tune chat for many users](../../../manuals/vllm-101/sections/3-1-tune-chat-for-many-users.md) finds the knee, [the SGLang quantization section](../../../manuals/sglang-101/sections/4-3-quantization.md) measures FP8 on the same card, [the SGLang benchmark section](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md) gives the goodput method, and [Eviction policies and HiCache](../../../manuals/sglang-101/sections/3-5-eviction-policies-and-hicache.md) sizes the working set.
