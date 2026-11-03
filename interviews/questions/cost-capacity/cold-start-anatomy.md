---
id: cold-start-anatomy
title: Break an eight-minute start into its parts
card: cost-capacity
kind: estimate
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [system-design, ml-depth]
tags: [cold-start, weight-loading, compile-cache, startup-probe]
minutes: 12
lessons: [phases/17-infrastructure-and-production/10-cold-start-mitigation]
manuals: [vllm-101#s-size-memory-on-a-dgx-spark, vllm-101#s-keep-cuda-graphs-and-compile-on, vllm-101#s-run-vllm-in-production, sglang-101#s-operating-sglang]
practice: []
cheatsheet: [serving-engines-compared, gpu-kubernetes]
related: [cost-capacity/warm-pool-or-cold-start, cost-capacity/autoscale-on-the-right-signal]
updated: 2026-11-03
---

A pod serving an MoE model on a unified-memory machine took about eight minutes from start to ready. Break that time into its parts, say which parts a restart can skip, and estimate what a warm restart looks like on the same machine.

## Short answer

Most of the time was the weight load. The manual's log shows about 330 seconds to copy 57 GiB of weights into memory on that machine, one tensor at a time from a file-backed page. The engine init took 127.54 seconds, and it holds the two CUDA graph captures of 39 and 38 seconds and a compile share of 18.67 seconds. A restart reuses the compile cache and nothing else, so a warm restart on that machine is only a little shorter than the cold one, unless the weights are staged in host memory or a process snapshot exists, which a field report took from a cold start of 695 seconds to 9.6 seconds.

## Full answer

### The parts, from the startup log

| Phase | Measured | Where it is logged |
|---|---|---|
| weight load | 56.93 GiB in about 330 seconds | the model loading line |
| engine init, profile, KV cache, warmup, with both graph captures | 127.54 seconds, of which compilation 18.67 | the init engine line |
| first graph capture, inside engine init | 39 seconds, 1.17 GiB | the first graph capturing line |
| second graph capture, inside engine init | 38 seconds, 0.31 GiB | the second graph capturing line |

The two captures finish before the init line, so they are part of its 127.54 seconds. Do not add them to it.

The server reported ready about eight minutes after it read its arguments. The load alone is more than two thirds of it.

### Why the load is slow on this machine

Each tensor is copied from the memory-mapped weights file into the GPU allocation. On this platform an open issue measured about 1.7 ms per tensor copied from the file view, against about 0.2 ms for a copy that starts in host memory. The release that the manual pins saved about 25 seconds with an indexed lookup of expert names, and the per-tensor copy cost stays. The manual's advice: keep the weights on local NVMe, not on a network mount, and start the server once and keep it running.

### What a restart skips

The compile cache lives under the engine's cache directory. Keep it on a persistent volume, and a later start reads it, so the compile share shrinks. SGLang points all of its kernel caches into one directory for the same reason, and the manual mounts it on a volume that survives the pod. The graph captures and the weight load repeat on every start. So the honest estimate for a warm restart on this machine is the cold start minus the compile share, which is still several minutes.

### Getting under a minute

The lesson on cold starts maps each phase to a layer: a pre-seeded image removes the image pull, model streaming roughly halves the weight load, and a GPU memory snapshot restores the loaded state about ten times faster than a reload. The SGLang manual quotes a field report with the same shape on a different engine and eight GPUs: a cold start of 695 seconds with 531 of them in weight loading, 88 seconds with kernel caches kept, and 9.6 seconds with a process checkpoint and the weights staged in host memory. Below a minute means a snapshot or staged weights, not a faster disk.

### What the number sets

The Kubernetes example in the vLLM manual gives the startup probe checks at 10 second intervals across a 15 minute window, and tells you to set the window from your own measured cold start. An autoscaler needs a stabilization window at least as long, and the interactive path needs a warm replica, because no scale-out helps inside an eight-minute window.

## Follow-ups

- **Level 3:** Which phase dominates on this machine, and why? Expected: the weight load at about 330 seconds, because each tensor is copied from a file-backed page, which is slow on this platform.
- **Level 3:** What does a persistent compile cache save on a restart? Expected: the compile share of the engine init, 18.67 seconds here. The weight load and the graph captures remain.
- **Level 4:** How do you get the restart under a minute? Expected: a process checkpoint or GPU memory snapshot with the weights staged in host memory, which the field report took to 9.6 seconds. A faster disk alone does not get there.
- **Level 4:** What does an eight-minute start imply for the probes and the autoscaler? Expected: a startup probe window longer than eight minutes, a stabilization window at least as long, and a warm replica for the interactive path.

## Wrong answers

- "The compile is the slow part, use eager mode." The compile share was 18.67 seconds of an eight-minute start, and eager mode costs decode speed on every request afterwards.
- "A faster GPU loads faster." The load was bound by the copy path from the file view, not by the GPU.
- "Restart often to pick up configuration changes." Each restart pays the full load. The manual's advice is to start once and keep the server running.

## Taught in

The [unified memory section of vLLM 101](../../../manuals/vllm-101/sections/2-3-size-memory-on-a-dgx-spark.md) explains the slow weight load, the [compile section](../../../manuals/vllm-101/sections/4-3-keep-cuda-graphs-and-compile-on.md) reads the capture and compile times, the [production section](../../../manuals/vllm-101/sections/7-2-run-vllm-in-production.md) keeps the compile cache, the [operating section of SGLang 101](../../../manuals/sglang-101/sections/7-1-operating-sglang.md) reports the warm and checkpointed starts, and the [cold start lesson](../../../phases/17-infrastructure-and-production/10-cold-start-mitigation/) maps each phase to a mitigation.
