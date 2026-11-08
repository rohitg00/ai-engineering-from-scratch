---
id: size-the-pool-from-peak
title: A bigger KV pool that bought nothing, until it did
card: cost-capacity
kind: tradeoff
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [ml-depth, system-design]
tags: [kv-pool, capacity, mem-fraction, open-loop]
minutes: 12
lessons: []
manuals: [sglang-101#s-mem-fraction-static-and-startup-sizing]
practice: []
cheatsheet: [sglang-serving, inference-load-testing]
related: [inference-serving/goodput-sets-the-cap, inference-serving/kv-pool-users-fit, scenarios/prefix-cache-inflated-benchmark]
updated: 2026-11-03
---

A teammate raised the memory fraction of a self-hosted server and grew the KV pool by 63 percent. The closed-loop benchmark at 64 concurrent users did not move. They want to revert the change, because the extra memory bought nothing. What do you tell them, and which measurement settles it?

## Short answer

The benchmark never filled the pool, so the extra memory had nothing to do. At 64 users the running requests held about 11 percent of the pool, and throughput stayed within 2 percent. Under an open-loop overload the same pool mattered: at the smaller fraction the pool was 96 percent full with requests waiting outside it, and the larger pool completed about a third more requests per second. Size the pool from token usage at peak load, bursts included, and read it from the scheduler's decode lines, not from a closed-loop sweep.

## Full answer

### What the closed loop showed

The manual ran the same load sweep at a fraction of 0.7 and at 0.82 on one machine, three seeds per point. The BF16 pool grew from 234,600 to 383,065 tokens. At every concurrency the two medians were within 2 percent of each other. The decode line with the highest token usage in the whole larger-pool sweep shows why: 64 running requests held 40,751 tokens, 11 percent of the pool. On the smaller pool the highest usage in the sweep was 18 percent. A pool that is never full has nothing to give.

### What the open loop showed

The open-loop sweep offered 16 requests per second, more than the machine serves. At 0.7 the decode line read 374 running requests at a token usage of 0.96, with 101 requests waiting in the queue. At 0.82 all 480 requests of the run fit at once at a usage of 0.75, with none waiting. The run completed 5.19 requests per second against 3.88, which is 34 percent more, and 664 against 497 output tokens per second. The two runs were a day apart, so part of the gap can be the machine. The log lines prove the mechanism, and the size of the gain belongs to that run.

### Why the closed loop could not see it

In a closed loop each client waits for its answer before it sends the next request. The server never holds more work than it finishes, so the pool never fills. Real users arrive on their own clock. Only an arrival rate above the service rate shows what the pool is worth.

### The cost of memory nobody uses

On a shared machine, memory in the pool is memory that another program cannot use. The manual's machine ran a memory guard that paused the scheduler when the pool allocation grew by tens of gigabytes in seconds. On a dedicated GPU, trust the automatic value first, and raise the fraction in steps of 0.02 only when the scheduler log shows a full pool and retractions.

### The measurement that settles it

Read the token usage in the decode lines at peak load, the queue length, and the retraction count. Read `max_total_num_tokens` at startup. If usage never approaches one and nothing waits, the pool is not the limit, and the extra memory belongs to something else.

## Follow-ups

- **Level 3:** Why did the closed-loop sweep never fill the pool? Expected: each client waits for its answer before it sends the next request, so the server never holds more work than it finishes.
- **Level 3:** Which log lines tell you the pool is the limit? Expected: token usage near one in the decode lines, a queue above zero, and retractions.
- **Level 4:** On a shared machine, what does an oversized pool cost? Expected: memory that other programs cannot use. The manual's machine had a guard that paused the scheduler when the pool allocation grew by tens of gigabytes in seconds.
- **Level 4:** The two overload runs were a day apart. How much of the gain do you trust? Expected: the mechanism, from the lines that show one pool full with requests waiting and the other with room. The size of the gain needs a same-day repeat.

## Wrong answers

- "The pool did not matter, revert it." It did not matter under a load that never filled it. The overload filled it and completed a third more requests per second.
- "Give the pool as much memory as possible." On a shared machine that memory is taken from other programs, and past the point where the pool fills it buys nothing.
- "Throughput at 64 users is the capacity number." Capacity shows under an arrival rate above the service rate, which a closed loop cannot produce.

## Taught in

The [memory fraction section of SGLang 101](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md) measures the same pool in a closed-loop sweep and in an overload that arrives faster than the server serves.
