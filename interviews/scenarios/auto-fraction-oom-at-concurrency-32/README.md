---
id: auto-fraction-oom-at-concurrency-32
title: A pool at 5 percent, and the server still died
card: scenarios
kind: incident
level: 1
roles: [applied-ai-engineer, inference-engineer, ai-developer-relations-engineer]
rounds: [screen, debugging]
tags: [mem-fraction-static, oom, kv-pool, unified-memory, mlx, startup]
minutes: 15
lessons: []
manuals: [sglang-101#s-mem-fraction-static-and-startup-sizing]
practice: []
cheatsheet: []
related: [scenarios/startup-oom-shared-gpu]
updated: 2026-11-03
system:
  version: SGLang 0.5.22 with the MLX backend
  model: mlx-community/Qwen3-0.6B-4bit
  hardware: a laptop with unified memory, shared with the other programs of a desktop session
source:
  - manuals/sglang-101/capture/out/oom-exploratory.log
  - manuals/sglang-101/capture/out/server-default.log
  - manuals/sglang-101/capture/out/bench-random-c32.txt
  - manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md
---

## Situation

A developer advocate prepares a workshop demo on a laptop. The server runs a small quantized model on the MLX backend, started with the model path and nothing about memory. Single requests work, and a few people at once work. To show what the laptop can do, the advocate runs the benchmark client with 32 requests in flight at once.

The whole server dies. The log ends with a Metal error, `Insufficient Memory`, and the process tree is gone. The decode lines right before the crash show 32 running requests, with token usage at 0.05. The advocate concludes that the laptop cannot serve 32 users and plans to show the demo at four.

## Evidence

- [the pool line of the first start](evidence/run-1-startup.txt)
- [the pool lines of the second start, minutes later](evidence/run-2-startup.txt)
- [the benchmark at a concurrency of 32, and the crash](evidence/the-crash.txt)
- [why the two starts sized the pool differently](evidence/why-the-two-starts-differ.txt)
- [how the manual reads the crash](evidence/how-to-read-the-crash.txt)
- [the pool line of the kit's server, with an explicit fraction](evidence/the-kit-start.txt)
- [the same benchmark against the kit's server](evidence/the-benchmark-that-finished.txt)

## Questions

1. The pool was almost empty when the server died. Where was the memory, if not in the pool?
2. Two starts of the same command gave two pool sizes. What changed between them?
3. What rule produced the fraction, and what does that rule assume about the machine?
4. Which flag fixes this, what value did the capture kit use, and what did the pool look like after?
5. What proves the fix: a startup line or a benchmark result?

## Walkthrough

1. **Read the decode lines before the error.** Thirty-two requests held 16,095 tokens, which is 5 percent of a pool of 312,581 tokens. The pool had reserved 33 GB and used under 2 GB of it. The next prefill needed activation memory outside the pool, but the operating system had none left to give. One failed command buffer took down the scheduler, the parent received a SIGQUIT, and it killed the process tree. The server did not run out of KV cache. It ran out of everything else.
2. **Compare the two startup lines.** The first start saw 27.81 GB of available system memory and gave the pool a budget of 24.25 GB, for 227,022 tokens. The second start, minutes later, saw 38.29 GB and gave 33.39 GB, for 312,581 tokens. Nothing changed in SGLang. Other programs on the laptop used less memory at the second start, so the snapshot of free memory was larger and the pool grew with it.
3. **Read the rule.** Both budgets are 87.2 percent of the free memory, because the automatic fraction resolved to 0.872. On this backend the rule takes the smaller of two numbers, a fraction of the Metal working set and a fraction of the system memory available right now, and the second one is the snapshot that moved. The rule assumes that the machine belongs to SGLang for the life of the server. A laptop with a browser and an editor open is not that machine.
4. **Read the fix in the kit's start.** The capture kit passes `--mem-fraction-static 0.4`. Its startup line shows a snapshot of 48.49 GB and a budget of 19.39 GB, which is 0.4 of the snapshot, for a pool of 181,574 tokens. That pool still holds far more than 32 requests of 640 tokens need, so the smaller pool cost nothing in this workload.
5. **Prove it with the same load.** Against the kit's server, the benchmark at a concurrency of 32 finished all 128 requests in 64.83 seconds. The startup line shows the split. The benchmark result shows that the server survived the load that killed it before.

## Resolution

The laptop was never the limit. The automatic fraction took 87 percent of the free memory for a pool that the workload used at 5 percent, and left the activations of the next prefill with nothing. With `--mem-fraction-static 0.4` the pool shrank to 181,574 tokens and the same benchmark completed 128 of 128 requests at a concurrency of 32.

The demo now starts with the fraction set, and the advocate reads two lines after every change: the `kv_budget` on the pool line and `max_total_num_tokens` on the settings line. On this backend the cache memory metric reads 0.0, because the MLX pool is allocated outside the accounting that the metric reads, so the pool log line is the number to trust.

## Wrong turns

- "The laptop cannot serve 32 users." The pool held 312,581 tokens and 32 requests used 5 percent of it. The memory ran out outside the pool, where the fraction left too little.
- "Raise the fraction so the pool is bigger." The pool was the cause. It took 87 percent of the free memory and starved the activations. Lower it.
- "Restart the server, the second start had more memory." The snapshot changes with the other programs on the machine, and the next start can find less. Set the fraction so the pool does not depend on the snapshot.
- "Set the fraction to 0.95 to be safe." A fraction of 0.95 leaves 5 percent for activations, and issue #39675 in the manual reports exactly that failure on the first prefill.

## Generalize

A pool that is almost empty when the process dies tells you the memory went somewhere the pool does not count. On a machine that runs anything else, a fraction computed from a snapshot of free memory is a bet on how the rest of the machine behaves for the life of the server. Set the share yourself, read the two startup lines that show the result, and prove a memory fix with the load that broke it, not with a start that succeeded.

## Taught in

The memory page of SGLang 101 records the crash and the fix in [the crash we recorded](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md#the-crash-we-recorded) and [our position: set the fraction yourself on any shared machine](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md#our-position-set-the-fraction-yourself-on-any-shared-machine).
