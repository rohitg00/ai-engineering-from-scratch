---
id: unified-memory-fraction-on-a-gb10
title: Pick the memory fraction on unified memory
card: gpu-memory-quantization
kind: estimate
level: 3
roles: [inference-engineer]
rounds: [ml-depth, system-design]
tags: [unified-memory, gb10, mem-fraction, kv-pool, startup]
minutes: 10
lessons: []
manuals: [vllm-101#s-size-memory-on-a-dgx-spark, sglang-101#s-mem-fraction-static-and-startup-sizing]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

You run a 30B model with mixture-of-experts layers in BF16 on a GB10, a machine where CPU and GPU draw on one 128 GB memory and the operating system and other programs live in the same pool. How do you pick the memory fraction, what does the fraction not guarantee on this machine, and why does the pool size differ between two starts with the same command?

## Short answer

Add the weights, the KV cache you want and a few GiB for the startup profile and the graphs, divide by the total, and leave room for the kernel's page cache and the other programs, which use the same memory. With a fraction of 0.75 the manual's vLLM run took 91.3 of 121.69 GiB: 56.93 GiB of weights, 31.32 GiB of cache, about 342,000 tokens at 96 KiB each, and about 3 GiB for the rest, which left about 30 GiB for everything else. The fraction is a plan and not a hard limit on unified memory, and the pool moves between starts because the engine sizes it from a snapshot of free memory that the kernel's file cache changes.

## Full answer

### What GPU memory means here

The GB10 has no separate GPU memory. The CPU and the GPU use one pool of LPDDR5x memory, sold as 128 GB; the startup log reported 121.69 GiB in total. On an integrated GPU vLLM reads free memory from the operating system, because the driver reports too little, and it releases its cached GPU memory when the whole system is more than 80 percent full. So the fraction is a share of the whole machine, not of a separate card.

### The budget at 0.75

| Part | Size |
|---|---|
| The share for vLLM, 0.75 of 121.69 GiB | 91.3 GiB |
| The weights | 56.93 GiB |
| Free for the KV cache | 31.32 GiB |
| The rest, for the profile and the graphs | about 3 GiB |

At 96 KiB per token the cache holds about 342,000 tokens, enough for more than 500 users with 640 tokens each. About 30 GiB stayed for the system and every other program. The manual ran one fraction only and says so.

### The fraction is not a hard limit

Two reports show the engine taking more than its share during the startup profile on this machine. One ran a fraction of 0.70, used about 112 GiB against a share of about 83 GiB, and the machine stopped responding. Another hit a negative estimate of the graph memory with a speculative method, so the cache grew too large and the start ran out of memory. The manual's own run matched the share of 0.75, with no speculation. To give the cache a fixed size instead, set it in bytes with `--kv-cache-memory-bytes`, and check that the weights, the cache and a few GiB for the profile leave room for the operating system.

SGLang's manual adds a field report of 25 to 40 GB of short-lived allocations outside the memory accounting, from the kernel autotuner and the graph capture, which froze a host until the server ran in a container with a memory cap and a fraction of 0.50. On a shared GB10, run the server in a container with a memory limit and log free memory once a second during startup.

### Why the pool moves between starts

SGLang sizes the pool from a snapshot of free memory after the weights load, and it measures the weights as the drop in available memory. Six BF16 starts of one command with the same weights on the GB10 read the weights at 54.78 to 57.92 GB and gave pools from 227,243 to 258,017 tokens, 14 percent apart. The kernel's file cache changed during each load. On unified memory a pool size from one start is an estimate for the next, so read the pool line at every start.

### Other programs see the pool

The pool is tens of GB and the engine allocates it in a few seconds, so every other program sees that memory go. A memory guard daemon on the manual's GB10 paused the scheduler three times during startup because it grew 36.7 GiB in 5 seconds with 34.2 GiB left. Tell the other users of the machine before you start, and do not alert on the driver's out-of-memory lines alone; alert when a server does not become healthy.

### When a bigger pool pays

Raising the SGLang fraction from 0.7 to 0.82 on the GB10 grew the BF16 pool from 234,600 to 383,065 tokens, 63 percent, and changed closed-loop throughput by less than 2 percent at 64 users, 238.72 against 235.38 tokens per second, because token usage peaked at 11 percent. Under a fixed arrival rate above what the machine serves, the smaller pool was 96 percent full with 101 requests waiting, the larger pool held all 480 requests, and the machine completed 5.19 against 3.88 requests per second, 34 percent more. Size the pool from token usage at peak load, bursts included, and not from free memory.

### Expect a slow first start

Loading 56.93 GiB took 330 s on this machine, because each tensor is copied from a memory-mapped file one at a time, about 1.7 ms per tensor from the file view against 0.2 ms from host memory. Keep the weights on the local drive, and keep the server running.

## Follow-ups

- **Level 3:** `free -g` shows almost no available memory while the server idles. What do you do? Expected: lower the fraction by 0.05 and start again; the system and its page cache share the pool, and if the cache line is larger than the share allows, set the cache size in bytes instead.
- **Level 3:** The same command gave pools of 227,243 and 258,017 tokens on two days. Is something broken? Expected: no; the engine sizes the pool from a snapshot of free memory after the weights load, and the kernel's file cache changed during each load, so the measured weights moved by about 3 GB and the pool with them; read the pool line at every start.
- **Level 4:** Going from 0.7 to 0.82 did nothing at 64 users and gave a third more throughput in an overload. Reconcile the two. Expected: in the closed loop the pool was never full, token usage peaked at 11 percent, so a larger pool had nothing to do; under a fixed arrival rate above what the machine serves, the small pool was 96 percent full with 101 requests waiting and the larger pool held all 480, so size the pool from token usage at peak load with its bursts.

## Wrong answers

- "The fraction caps what the server can take." On unified memory it sets the share that the engine plans for; one report used about 112 GiB at a fraction of 0.70 during the startup profile against a share of about 83 GiB, and the machine stopped responding.
- "Set the fraction as high as it goes to get the biggest pool." The system and its page cache use the same memory, and memory you do not need is memory another program cannot use; on the GB10 a 63 percent larger pool changed closed-loop throughput by less than 2 percent.
- "Yesterday's pool size is the pool size." Six starts with the same command gave pools 14 percent apart, because the snapshot of free memory changed; read the line each time.
- "A slow first start means something is wrong." Loading 56.93 GiB from a file-backed mapping took 330 s on this machine, about 1.7 ms per tensor against 0.2 ms from host memory; keep the weights on local storage and keep the server running.

## Taught in

[Size memory on a DGX Spark](../../../manuals/vllm-101/sections/2-3-size-memory-on-a-dgx-spark.md) and [--mem-fraction-static and startup sizing](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md) measure the fraction on the same machine.
