---
id: graphs-off-to-start-faster
title: CUDA graphs turned off to start faster
card: scenarios
kind: incident
level: 2
roles: [inference-engineer]
rounds: [debugging, ml-breadth, design-review]
tags: [cuda-graphs, cold-start, startup, decode, tpot, autoscaling]
minutes: 20
lessons: []
manuals: [sglang-101#s-forwardmode-and-cuda-graphs, sglang-101#s-operating-sglang]
practice: []
cheatsheet: [sglang-serving]
related: [scenarios/cold-start-on-gb10, scenarios/thermal-throttle-voided-ab-test]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-30B-A3B-Instruct-2507
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/sglang-101/capture/gpu/out-gb10/server-no-cuda-graph.command.txt
  - manuals/sglang-101/capture/gpu/out-gb10/server-default.command.txt
  - manuals/sglang-101/capture/gpu/out-gb10/server-default.log
  - manuals/sglang-101/capture/gpu/out-gb10/server-no-cuda-graph.log
  - manuals/sglang-101/capture/gpu/out-gb10/bench-random-c1.txt
  - manuals/sglang-101/capture/gpu/out-gb10/no-cuda-graph-bench-random-c1.txt
  - manuals/sglang-101/capture/gpu/out-gb10/bench-random-c8.txt
  - manuals/sglang-101/capture/gpu/out-gb10/no-cuda-graph-bench-random-c8.txt
  - manuals/sglang-101/sections/4-1-forwardmode-and-cuda-graphs.md
  - manuals/sglang-101/sections/7-1-operating-sglang.md
---

## Situation

A team runs `Qwen/Qwen3-30B-A3B-Instruct-2507` on GB10 nodes behind an autoscaler. New pods take more than six minutes to become ready, so the autoscaler starts extra pods during every ramp and the bill grows. An engineer reads the startup log, sees that it captures CUDA graphs twice, and proposes to disable both graph backends: "capture is pure startup cost, and the prefill capture alone takes half a minute". A reviewer blocks the change: "graphs are what make decode fast, you will double the time per token".

Both have read the same log and neither has measured. The pod has been restarted with each setting, and the kit output for both servers is on the shared drive.

## Evidence

- [the server command with both graph backends disabled](evidence/the-change.txt)
- [the end of startup on the default server, with the timings line](evidence/startup-with-graphs.txt)
- [the startup phases of the server without graphs](evidence/startup-without-graphs.txt)
- [median TPOT and output with and without graphs, three seeds, 1 to 64 users](evidence/decode-on-the-gb10.txt)
- [one kit run at one user with graphs on](evidence/one-user-with-graphs.txt)
- [the same kit run at one user with graphs off](evidence/one-user-without-graphs.txt)
- [the position of the manual on graphs, memory and startup](evidence/the-position.txt)

## Questions

1. From the startup timings line, where do the six minutes go, and how much of that is graph capture?
2. What does a CUDA graph remove from a decode step, and on which model and GPU is that removal worth the most?
3. Read the two kit runs at one user. What did graphs change in the typical token gap, and what in the worst one?
4. The three-seed table shows a GB10 result that differs from the L4 result in the manual. Why would two cards disagree about the same feature?
5. Does disabling graphs fix the autoscaler? What does?
6. When would the reviewer be right? Name the model shape and the load.

## Walkthrough

1. **Read the timings line of the default server.** It reads `load_weight=323.61`, `kv_cache_allocation=2.09`, `scheduler_e2e=369.03`, `cuda_graph={prefill=35.06, decode=4.61, ...}` and `tokenizer_e2e=373.52`. The weight load is 323.61 s of a 373.52 s start. The prefill capture took 35.06 s and the decode capture 4.61 s. The captures also cost memory: the section gives 2.14 GB for prefill and 1.73 GB for decode.
2. **Read the startup without graphs.** The server logged that the prefill graph was disabled because the config resolved the backend to `disabled`, allocated a pool of 258017 tokens against 227243 with graphs, and finished with `scheduler_e2e=341.39` and `tokenizer_e2e=346.34`, with every graph field at 0.00. Its weight load was 322.24 s. So the change saved the capture time and bought a larger pool, and the start still took 346.34 s, because 322.24 s of weight load sit inside it.
3. **Know what a graph saves.** A decode step is hundreds of small kernel launches, one token per request each. A graph records them once and replays them with one CPU call. The saving is launch time, a fixed cost per step that matters when the step itself is short: a small dense model on a fast GPU at batch 1 is the case the mechanism was built for.
4. **Read the three-seed table.** On this mixture-of-experts model on the GB10, the median TPOT was 32.52 ms with graphs against 33.09 without at one user, 102.21 against 104.77 at 8 users, and 254.06 against 253.77 at 64. Output was 29.14 against 28.72, 74.11 against 73.46, and 235.38 against 235.79. The manual's reading: a step of this model takes about 32 ms at batch 1, memory bandwidth sets that time, and the launch time a graph removes is small next to it.
5. **Read the kit's single runs.** At one user with graphs: a median TPOT of 30.84 ms, a median ITL of 30.79 and a P99 ITL of 32.21. Without graphs: 31.29, 31.40 and 41.72. The medians agree with the three-seed table. The P99 ITL moved more, from 32.21 to 41.72 ms, but these are single runs with no clock record, so the tail is a lead to measure, not a result. At 8 users the kit read 97.30 against 100.03 ms. Do not use the first-token column of these runs for the comparison, because the kit never flushed the cache between runs.
6. **Read the position.** Keep graphs on and size them to your traffic. Do not turn them off to fix memory; lower `--cuda-graph-max-bs-decode` or `--mem-fraction-static` instead. On the GB10 graphs changed decode by 3 percent or less, and on the L4 with a dense 8B model they saved about 1 percent of each step. The old flag `--disable-cuda-graph` still works at v0.5.22 and is deprecated in favor of the two per-phase flags in the command.

## Resolution

Neither engineer was right about the size. Disabling the graphs saved the capture, 35.06 s for prefill and 4.61 s for decode, and the start still took 346.34 s instead of 373.52, because 322.24 s of weight load dominate the start. On the decode side the reviewer's fear did not materialize on this model and card: the median time per token changed by 3 percent or less from 1 to 64 users, and the output stayed within the seed spread.

So the change does not solve the ramp, and the weight load is the problem to work on. Keep the weights on a local drive, keep the server running between ramps, mount the kernel caches and the model cache on volumes that survive the pod, and set the readiness probe and the scale-up policy from the measured 373.52 s, as the operating page describes. Keep the graphs on, because a server without decode graphs pays launch time on every token for every user, and that cost shows on smaller dense models where the step is short. If the team wants the memory back, the lever is `--cuda-graph-max-bs-decode`, not the capture itself. Before any change of this kind, measure the pair with a clock record and three seeds, as the table did, and read the tail as well as the median.

## Wrong turns

- "Capture is pure startup cost, so remove it." It is 35.06 plus 4.61 s of a start that spends 323.61 s loading weights. Removing it moved the start from 373.52 to 346.34 s and left the ramp problem in place.
- "Without graphs the time per token doubles." On this mixture-of-experts model on the GB10, the median TPOT moved from 32.52 to 33.09 ms at one user and from 254.06 to 253.77 at 64. The step is bound by memory bandwidth, not by launches.
- "The GB10 result settles it for every model." On the L4 with a dense 8B model the graphs saved about 1 percent of each step, and on a small model on a fast GPU the launch share is larger still. The saving is a property of the step length.
- "Turn graphs off to get the KV pool back." The pool grew from 227243 to 258017 tokens, but the manual says to lower the graph batch size or the memory fraction instead, so that decode keeps its graphs.
- "Read the kit's first-token column to settle the tail." The kit never flushed the cache between runs, so the first token is not comparable. The P99 ITL gap at one user, 32.21 against 41.72 ms, needs a run with seeds and a clock record first.

## Generalize

Read where the time goes before you remove a phase. A startup, like a decode step, is a sum of parts of very different sizes, and the part that is easy to remove is rarely the part that dominates. Measure the cost and the gain of a feature on your own model and GPU, at your load, with seeds and a clock record, because a saving that is real on one step length is noise on another.

## Taught in

The SGLang manual measures the pair on the GB10 and on the L4 in [the CUDA graphs page](../../../manuals/sglang-101/sections/4-1-forwardmode-and-cuda-graphs.md#what-we-measured-on-a-gb10) and breaks a cold start into its phases in [the operating page](../../../manuals/sglang-101/sections/7-1-operating-sglang.md#cold-start-is-weights-plus-compilers).
