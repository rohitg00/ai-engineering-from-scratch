---
id: goodput-sets-the-cap
title: Pick a concurrency cap when throughput keeps rising
card: inference-serving
kind: tradeoff
level: 3
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, ml-depth]
tags: [goodput, concurrency, tpot, latency-target, benchmark]
minutes: 12
lessons: [phases/17-infrastructure-and-production/08-inference-metrics-goodput]
manuals: [sglang-101#s-sglang-benchmark-serving]
practice: []
cheatsheet: [inference-load-testing]
related: [inference-serving/kv-pool-users-fit]
updated: 2026-11-03
---

You serve a chat model on one GPU. A load sweep shows output throughput that still rises at a cap of 64 concurrent requests, so the team wants to set the cap to 64. The product needs the first token in under one second and a steady stream of text after it. Which cap do you pick, and how do you defend it?

## Short answer

Pick the cap from goodput, not from throughput. Goodput counts only the requests that meet every latency target, so it falls to zero long before throughput stops rising. On the sweep in the SGLang manual, BF16 goodput was highest at a cap of 4 and was 0 from a cap of 8. Use the throughput curve only to explain the choice.

## Full answer

### Why throughput hides the knee

A large KV pool lets the server admit more requests. On the GB10 in the manual, the pool held 234,600 tokens, so BF16 throughput still rose at a cap of 64. More admitted requests share each decode step, so each request gets fewer tokens per second. Throughput measures the server. Latency measures the user.

### Define the target first

The manual counts a request as good when its first token comes in under 1 s and its mean time per token is under 100 ms. Write the target down before the sweep. A goodput number without its target means nothing.

### Read the sweep

| Cap | BF16 goodput | BF16 median TPOT | FP8 goodput | FP8 median TPOT |
|---|---|---|---|---|
| 4 | 0.44 req/s | 71.01 ms | 0.80 req/s | 38.60 ms |
| 8 | 0 | 102.21 ms | 1.07 req/s | 54.96 ms |
| 16 | 0 | 154.24 ms | 1.10 req/s | 81.90 ms |
| 32 | 0 | 201.91 ms | 0 | 104.12 ms |

At a cap of 8, the median BF16 request already takes more than 100 ms per token. Throughput at that cap is 74.11 tok/s and still rising. FP8 holds the target up to a cap of 16. So the answer depends on the build: about 4 for BF16 and about 16 for FP8 on this machine.

### Defend it

- Run three seeds per point and show the band, so that a reviewer can see the gaps are real.
- Reset the prefix cache before each run. A warm cache makes the first token look fast.
- A cap is a closed loop. Real users arrive on their own clock, so also run an open-loop sweep with a request rate and check goodput there.

## Follow-ups

- **Level 2:** What is the difference between throughput and goodput? Expected: throughput counts all tokens or requests per second; goodput counts only the requests that met every latency target.
- **Level 3:** Why can a closed-loop cap never show a growing queue? Expected: each client waits for its answer before it sends the next request, so the server never receives more work than it finishes.
- **Level 3:** FP8 holds the target at a cap of 16 and BF16 does not. What do you check before you switch the build? Expected: output quality on your own eval, and the KV pool size, because FP8 frees memory for a larger pool.
- **Level 4:** The GPU gets hot at high load. How does that change your sweep? Expected: record the GPU clock and the thermal state with every run, and let the GPU cool to a fixed temperature before each run.

## Wrong answers

- "Set the cap where throughput peaks." The throughput curve had no peak inside the sweep, and every BF16 request missed the target from a cap of 8.
- "Use the median TTFT alone." A median can hide a slow half of the requests, and the time per token can fail while the first token is fast.
- "Report goodput from one run." One run can be wrong for reasons you never see, so use three seeds and report the range.

## Taught in

The [benchmark section of SGLang 101](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md#goodput-finds-the-knee-that-throughput-hides) measures goodput against the cap, and the [inference metrics lesson](../../../phases/17-infrastructure-and-production/08-inference-metrics-goodput/) defines each metric.
