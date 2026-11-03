---
id: small-pool-lru-thrash
title: LRU thrash in a small pool, then a crash
card: scenarios
kind: incident
level: 3
roles: [inference-engineer, agentic-ai-engineer]
rounds: [debugging, ml-depth]
tags: [eviction, radix-cache, kv-pool, lru, cuda-graphs, multi-turn]
minutes: 25
lessons: [phases/17-infrastructure-and-production/06-sglang-radixattention]
manuals: [sglang-101#s-eviction-policies-and-hicache, sglang-101#s-operating-sglang, sglang-101#s-mem-fraction-static-and-startup-sizing, sglang-101#s-forwardmode-and-cuda-graphs]
practice: []
cheatsheet: []
related: [scenarios/request-id-at-prompt-start]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-0.6B
  hardware: the shared second L4 of a two-GPU node, with no clock lock
source:
  - manuals/sglang-101/capture/gpu/out-l4/eviction-multiturn.txt
  - manuals/sglang-101/capture/gpu/out-l4/small-pool-crash.txt
  - manuals/sglang-101/sections/3-5-eviction-policies-and-hicache.md
  - manuals/sglang-101/sections/7-1-operating-sglang.md
---

## Situation

A coding assistant keeps a session for each user and resends the whole history on every turn. The team serves a small model with SGLang on a GPU that another team also uses, so they set `--max-total-tokens 8192` to leave the neighbour room. In a load test with 24 sessions of 6 turns at 8 users at once, the first turns are fast. From the fourth turn the first token takes up to 716 ms, and the metrics endpoint shows the cache hit rate falling toward zero.

Then two kinds of failure appear. In some runs the server stops with `CUDA error: an illegal memory access was encountered`. In other runs the log stops with no error while the GPU stays at 100 percent and every client waits. The team suspects the eviction policy and asks whether to switch from `lru` to `lfu`.

## Evidence

- [the engine, the model and the multi-turn trace](evidence/trace-and-pool.txt)
- [the hit rate over the whole trace and per turn, by pool size and policy](evidence/hit-rate-by-turn.txt)
- [the median time to first token at turns 5 and 6](evidence/ttft-at-late-turns.txt)
- [the server command, the trace, and the tally of aborts and hangs by variant](evidence/aborts-and-hangs.txt)
- [the abort, the hang, and what hid the fault](evidence/where-it-stopped.txt)

## Questions

1. What does eviction remove, what does it never remove, and how does `lru` pick the victim?
2. Read the per-turn hit rates of the first row. Describe the pattern in words and name the mechanism behind it.
3. At the same pool size, `lfu` and `slru` kept the late turns alive. What does that tell you about the working set, and what else fixes it?
4. Both failures stop in one call of the scheduler. Which two changes made the fault disappear, and what does each one cost?
5. Order the fixes: a larger pool, a different policy, graphs off, launch blocking. Which do you ship, which do you test, and which never goes to production?

## Walkthrough

Eviction removes cached tokens that no running request holds, from the leaves of the radix tree. It never removes the KV of a running request. With the default policy the leaf with the oldest last access goes first. That rule assumes that the next request looks like the recent ones.

The trace in the first listing breaks that assumption. Twenty-four sessions take turns at a concurrency of 8, and every turn resends a history that grows. The second listing shows what the pool did with it. With 8,192 tokens and `lru`, the hit rate per turn was 0.11, 0.31 and 0.58 for the first three turns, then 0.39, 0.016 and 0.013. By turn 5 the cycle of 24 growing histories was larger than the pool. The policy evicted each session's prefix just before that session came back, so almost every late turn paid a full prefill. Over the whole trace the hit rate was 0.19 in both clean runs.

The same pool with `lfu` reached 0.375 over the trace and kept 0.34 and 0.25 at turns 5 and 6. With `slru` it was 0.367, with 0.31 and 0.26. So the frequency policies helped exactly where the pool was too small for the sessions that return. The rows below show the real fix. At 16,384 tokens, `lru` reached 0.685 and the hit rate rose to 0.83 at turn 6. The default pool gave 0.687. Every policy we ran at the larger pools landed near 0.69. The third listing turns this into time. At turns 5 and 6 the median first token was 699 and 449 ms in one `lru` run and 716 and 355 ms in the other, 143 to 214 ms with `lfu` or `slru`, and 56 to 160 ms with the larger pools. The card had no clock lock, so compare these numbers only with each other.

The fourth listing is the failure tally. With the defaults, CUDA graphs and the overlap scheduler on, 6 runs gave 1 abort, 3 hangs and 2 clean runs. With `CUDA_LAUNCH_BLOCKING=1`, 3 of 3 were clean. With `--disable-cuda-graph`, 4 of 4 were clean. When hierarchical caching was on, 1 of 3 still aborted. The fifth listing shows that the abort and every hang stopped in the same place, the synchronize call that waits for the copy of a decode result, under the overlap event loop. The fault did not appear with launches serialized or with graphs off, so no traceback names the kernel. Nothing was filed upstream.

## Resolution

Two problems sat on top of each other. The pool was smaller than the working set of the sessions that return, so `lru` thrashed from turn 4 on. Under that heavy eviction, the default path with CUDA graphs and the overlap scheduler hit the memory fault or hung in 4 of 6 runs.

Grow the pool first. At 16,384 tokens the same trace reached a hit rate of 0.685 with the default policy, and the late turns kept 56 to 160 ms to the first token. If a cap such as `--max-total-tokens` sets the pool, raise the cap. If memory sets it, on a shared card that means a larger `--mem-fraction-static` or an FP8 KV cache, not a new policy. Then read `max_total_num_tokens` in the startup log to confirm the new size. Then measure the policy again. On this trace a different policy paid only at the pool size that was too small.

For the crash, ship `--disable-cuda-graph` as the workaround while the pool is small. On our L4 with an 8B model, graphs saved about 1 percent of each decode step, so measure the cost on your model. A larger pool stopped the thrash, but we did not count crashes at the larger pools, so treat it as untested for the fault. Keep `CUDA_LAUNCH_BLOCKING=1` for debugging only.

## Wrong turns

- "Switch to lfu and ship it." A frequency policy keeps yesterday's popular prompt in memory and makes today's prompt pay for it. It helped here only because the pool was too small, and the larger pool made every policy equal.
- "Set CUDA_LAUNCH_BLOCKING=1 in production." It hid the fault in 5 of 5 runs, and it makes every kernel launch wait for the one before it. Use it to debug, never to serve.
- "Turn on hierarchical caching to stop the crash." With the host tier on, 1 of 3 runs still aborted. The host tier keeps evicted prefixes, it does not change the path that faulted.
- "Raise the running-request cap so the sessions do not wait." More running requests hold more of the pool, so eviction gets heavier, and the hit rate falls further.

## Generalize

When a hit rate falls on later turns while early turns are fine, the working set has outgrown the cache. Size the cache before you tune its policy, because a policy only chooses which part of a too-small set to lose. And when a fault appears only under one load shape, change the execution path one switch at a time, and keep the switch that serializes work for the debugger, not for the users.

## Taught in

The SGLang manual measures the trace and the policies in [the eviction and HiCache page](../../../manuals/sglang-101/sections/3-5-eviction-policies-and-hicache.md), records the crash in [the operating page](../../../manuals/sglang-101/sections/7-1-operating-sglang.md), sizes the pool in [the memory fraction page](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md) and weighs the graphs in [the CUDA graphs page](../../../manuals/sglang-101/sections/4-1-forwardmode-and-cuda-graphs.md), and [the RadixAttention lesson](../../../phases/17-infrastructure-and-production/06-sglang-radixattention/docs/en.md) builds the tree that the policies walk.
