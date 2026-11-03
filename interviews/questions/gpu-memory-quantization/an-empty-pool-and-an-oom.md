---
id: an-empty-pool-and-an-oom
title: The pool was 95 percent empty and the server died
card: gpu-memory-quantization
kind: debug
level: 3
roles: [inference-engineer]
rounds: [debugging, ml-depth]
tags: [mem-fraction, kv-pool, out-of-memory, shared-machine, startup]
minutes: 10
lessons: []
manuals: [sglang-101#s-mem-fraction-static-and-startup-sizing]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

An SGLang server on a shared workstation ran for four minutes, and then a benchmark with 32 requests in flight crashed it with an out-of-memory error. The scheduler log just before the crash shows `token usage: 0.05`. Explain how the pool was 95 percent empty and the server still ran out of memory, and what you set.

## Short answer

The KV pool is sized once at startup from a snapshot of free memory, and the automatic fraction gave 87.2 percent of what was free to the weights and the pool. Thirty-two requests held 16,095 tokens, 5 percent of a 312,581-token pool, so the pool had reserved 33 GB and used under 2 GB, and the activations of the next forward pass needed memory outside the pool that the operating system no longer had. On a machine that runs anything else, pass `--mem-fraction-static` yourself; with 0.4 the same benchmark finished all 128 requests at concurrency 32.

## Full answer

### Two startups, two pool sizes

The manual started the server twice with the same command and no fraction. The first start saw 27.81 GB of system memory available, took a KV budget of 24.25 GB and sized a pool of 227,022 tokens. The second start saw 38.29 GB available, took 33.39 GB and sized 312,581 tokens. Nothing changed in SGLang between the runs; other programs used less memory at the second start. Both budgets were 87.2 percent of the free memory, because the automatic fraction resolved to 0.872.

### The crash

The last decode line before the crash showed 32 running requests with 16,095 tokens at a token usage of 0.05. The pool had reserved 33 GB and used under 2 GB of it. The next forward pass needed memory for its activations outside the pool, the operating system had none left, one command buffer failed, the scheduler died, and the server killed its whole process tree. An empty pool and an out-of-memory crash were the same event.

### How SGLang decides the split

The fraction is the share of memory for the weights plus the KV pool. Everything else, activations, graphs and other programs, lives outside it. On a GPU the automatic value comes from a reserve: 512 MB plus 1.5 MB for each token of the prefill chunk, more for tensor and pipeline parallelism and for graphs, and at least 10 GiB on a GPU with more than 60 GB. The fraction is the memory minus the reserve, divided by the memory. When the device capacity cannot be read, it becomes 0.95. After the weights load, SGLang measures free memory again, and the KV budget is that free memory minus the share outside the fraction of what was free before loading. On the laptop backend the rule is simpler: the smaller of the fraction of the device working set and the fraction of system memory available right now, and that second term is the snapshot that moved.

### Where the default fails

- A shared machine: the snapshot at startup does not hold for the life of the server.
- Unknown capacity: the fraction becomes 0.95 and leaves 5 percent for activations, which one report hit as an out-of-memory error on the first prefill.
- Memory the estimate does not know about: draft model copies that stay in memory while the target pool is sized, and a 64K-token prompt that ran out of memory in attention although the log reported room for 274,934 tokens.

### The fix, and the other direction

With `--mem-fraction-static 0.4` the budget became 19.39 GB, 0.4 of the 48.49 GB snapshot, and the pool held 181,574 tokens, far more than 32 requests of 640 tokens need. A smaller pool cost nothing in this workload, because the workload never filled it. On a dedicated GPU trust the automatic value first. Raise it in steps of 0.02 only when the scheduler log shows a full pool and retractions. Find the upper limit in staging with your longest prompts, run production one or two steps below it, and lower it when long prompts fail with out-of-memory errors in attention.

### What to measure

Read the `max_total_num_tokens` line at startup, which is the result of the whole calculation. Watch `token usage` in the decode lines; near 1.0 the pool is full. Read the free memory of the machine during the heaviest prefill from the operating system. On the laptop backend the cache memory metric read 0.0 because that backend allocates its pool outside the metric's accounting; the pool log line, about 19,860 MB, is the number to use.

## Follow-ups

- **Level 3:** Why did the second start get a bigger pool than the first when nothing in SGLang changed? Expected: other programs used less memory at the second start, so the snapshot of free memory grew from 27.81 to 38.29 GB and the pool grew with it, from 24.25 to 33.39 GB at the same automatic fraction.
- **Level 3:** What memory does the fraction cover, and what lives outside it? Expected: the weights plus the KV pool; activations, graphs, autotuning scratch and every other program live outside it, which is why a pool at 87 percent of free memory left nothing for the next forward pass.
- **Level 4:** On a dedicated GPU, when do you raise the fraction and by how much? Expected: only when the scheduler log shows a full pool and retractions, in steps of 0.02; find the upper limit in staging with your longest prompts, run production one or two steps below it, and lower it when long prompts fail with out-of-memory errors in attention.

## Wrong answers

- "A token usage of 0.05 means the server was nowhere near full." It means the pool was nearly empty; the pool had taken the memory and the activations outside it ran out, so an empty pool and an out-of-memory crash were the same event.
- "Raise the fraction so that the pool is bigger and the crash goes away." The crash came from memory outside the pool; a bigger fraction takes more from the activations and the other programs, and 0.4 is what fixed it.
- "The automatic fraction is tuned, so leave it." It assumes the machine belongs to the engine; on a shared machine the snapshot at startup does not hold for the life of the server, and when the capacity cannot be read it becomes 0.95 and fails on the first prefill.
- "The pool line tells you the memory the server uses." The pool is the largest part and not the whole; one report measured 25 to 40 GB of short-lived allocations outside the accounting from the autotuner and the graph capture.

## Taught in

[--mem-fraction-static and startup sizing](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md) has the crash log, the formula and the GB10 starts.
