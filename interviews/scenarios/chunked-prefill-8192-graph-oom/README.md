---
id: chunked-prefill-8192-graph-oom
title: A bigger prefill chunk that did not start
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth]
tags: [chunked-prefill, cuda-graphs, startup, oom, kv-pool]
minutes: 20
lessons: []
manuals: [sglang-101#s-the-scheduler-loop-and-schedule-policy, sglang-101#s-forwardmode-and-cuda-graphs, sglang-101#s-mem-fraction-static-and-startup-sizing]
practice: []
cheatsheet: []
related: [scenarios/startup-oom-shared-gpu]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-8B
  hardware: one L4, the first GPU of a two-GPU node
source:
  - manuals/sglang-101/capture/gpu/incidents/l4-chunk-8192-prefill-graph-oom.txt
  - manuals/sglang-101/capture/gpu/out-l4/server-default.log
  - manuals/sglang-101/sections/2-2-the-scheduler-loop-and-schedule-policy.md
  - manuals/sglang-101/sections/4-1-forwardmode-and-cuda-graphs.md
  - manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md
---

## Situation

An engineer wants long prompts to get their first token sooner on an L4 server that runs `Qwen/Qwen3-8B`. The idea is simple: a prefill chunk twice as large means half as many scheduler turns for a long prompt. They start the server with `--chunked-prefill-size 8192` and leave every other flag at its default.

The server never becomes ready. The log ends with a `RuntimeError` from PyTorch that reads `INTERNAL ASSERT FAILED` and asks the reader to report a bug to PyTorch. The engineer opens a bug report with the PyTorch project and proposes to pin an older PyTorch for the whole fleet. The same server with no chunk flag has served every benchmark run on this card.

## Evidence

- [the engine, the model, the card and the one changed flag](evidence/the-settings.txt)
- [the last six lines of the failed start](evidence/the-failed-start.txt)
- [the same server with the default chunk](evidence/the-control.txt)
- [the default start on the same card: the pool, the free memory and the prefill capture](evidence/default-start-pool-and-capture.txt)
- [the settings line of the default start](evidence/default-start-settings-line.txt)
- [the default chunk and the largest decode batch, by GPU memory](evidence/default-chunk-by-gpu-memory.txt)
- [how the manual reads the failed start](evidence/the-manual-reading.txt)

## Questions

1. The last line asks for a PyTorch bug report. Which line holds the real error, and how do you tell a cause from a consequence in this log?
2. The pool is the same size in the failed start and in the sweep. Where did the memory go?
3. Which startup step runs after the pool and needs memory outside it? How does the chunk size change what that step needs?
4. The default start captured the same step on the same card. How much memory did its first captured shape use, and how much was left when it began?
5. If the team still wants a chunk of 8192 here, which flag makes room and which flag should they not touch?

## Walkthrough

1. **Read upward from the assert and stop at the first error.** Two lines above the PyTorch assert is `torch.AcceleratorError: CUDA error: out of memory`. The assert, `markCaptureEnd called with no captures in progress`, is what the allocator says after a graph capture was cut short by that error. The scheduler then received a SIGQUIT from its child. The manual reads it the same way: the real error is the out-of-memory line, and the assert is the consequence.
2. **Check what the pool took.** The failed start allocated a pool of 24,094 tokens, with 1.65 GB each for K and V, the same pool that the sweep servers on this card had. After the pool, 2.90 GB was free. So the pool did not grow with the chunk, and the memory that ran out was memory outside the pool.
3. **Find the step that failed.** The line `Capturing prefill shape (num_tokens=8192 avail_mem=2.33 GB)` names it. Since the breakable graph for prefill arrived in the CUDA builds, startup captures a prefill graph for each shape up to the chunk size. The largest shape is the chunk itself. A capture of 8192 tokens holds the activations of an 8192-token prefill, and that needed more than the 2.33 GB that was left.
4. **Compare with a start that worked.** The default start on this card shows the same sequence with a smaller shape. Its pool held 22,939 tokens that day, 2.86 GB was free after the pool, and the first captured shape was `num_tokens=4096` with 2.28 GB available. That capture ended after 48.33 s with 0.83 GB used and 1.45 GB still free. Twice the tokens in the capture asked for more than the whole remainder.
5. **Read where the default comes from.** The table in the CUDA graphs page gives a chunk of 4096 for a card of 20 to 35 GB, and 8192 only from 60 GB upward. The default is sized to the memory that a capture can expect on that card. The scheduler page measured chunk changes on the GB10 and found no gain at 1 and 2 requests each second, and a loss at 0.5 with a smaller chunk. On the L4 the larger chunk never started, so there is no measurement of its gain.

## Resolution

Close the PyTorch report. The assert is a symptom of a capture that an out-of-memory error interrupted, and the cause is the prefill graph for 8192 tokens on a card with 2.33 GB left after the pool. The team kept the default chunk of 4096, and that server, on that card, started and served every run, which is the control that the incident record states.

If a larger chunk is still wanted on this card, make room for the capture instead of removing it. Lower `--mem-fraction-static` by one step, so the pool shrinks and the capture has more than 2.33 GB, then read the `Capture target prefill CUDA graph end` line for the memory the capture used. The CUDA graphs page gives the order: fix capture memory with a smaller graph batch size or a lower fraction, and keep graphs on. Then measure the first token at the team's prompt lengths with both chunks before the change ships, because the manual found no gain from a chunk change on the machine where it could run both.

## Wrong turns

- "Pin an older PyTorch, the assert says to report a bug." The assert reports an interrupted capture. The out-of-memory line two lines above it is the cause, and an older PyTorch changes nothing about free memory.
- "Raise the memory fraction so the capture gets more memory." The fraction gives memory to the weights and the pool. Raising it shrinks what is left for the capture. Lower it.
- "Turn CUDA graphs off and keep the big chunk." A server without decode graphs pays launch time on every token for every user. Fix the capture memory and keep the graphs.
- "A bigger chunk always makes prefill faster, so it is worth the memory." The manual measured chunk sizes on the GB10 and found the three settings inside the seed spread of each other at 1 and 2 requests per second. Measure before you pay.

## Generalize

When a startup log ends in an assert from a library, read upward to the first error, because the library is often the second victim. Then ask which step the error fell in and what that step's memory depends on. A flag that changes a shape, such as a chunk size or a graph batch size, changes the memory of the capture that uses that shape, and the pool that the fraction sized does not move to make room. On a small card, the default chunk is a memory decision, not a speed decision.

## Taught in

The scheduler page of SGLang 101 records the failed start in [its chunked prefill part](../../../manuals/sglang-101/sections/2-2-the-scheduler-loop-and-schedule-policy.md), the graph capture section states [the default chunk by GPU memory and the rule for capture memory](../../../manuals/sglang-101/sections/4-1-forwardmode-and-cuda-graphs.md#what-sglang-captures-and-when-it-gives-up), and the memory page explains [how the fraction splits memory between the pool and everything else](../../../manuals/sglang-101/sections/3-2-mem-fraction-static-and-startup-sizing.md#how-sglang-decides-the-split).
