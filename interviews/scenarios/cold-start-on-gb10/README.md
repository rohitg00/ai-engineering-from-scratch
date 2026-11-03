---
id: cold-start-on-gb10
title: A five-minute cold start on the GB10
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, forward-deployed-ai-engineer, applied-ai-engineer]
rounds: [debugging, system-design]
tags: [cold-start, weight-load, unified-memory, gb10, autoscaling, torch-compile]
minutes: 15
lessons: []
manuals: [vllm-101#s-size-memory-on-a-dgx-spark, vllm-101#s-keep-cuda-graphs-and-compile-on, vllm-101#s-ref-version-pins, sglang-101#s-operating-sglang]
practice: []
cheatsheet: []
related: [scenarios/ray-oom-unified-memory]
updated: 2026-11-03
system:
  version: vLLM 0.31.0 in its release container
  model: Qwen/Qwen3-30B-A3B-Instruct-2507
  hardware: one GB10 with 128 GB of unified memory
source:
  - manuals/vllm-101/capture/gpu/out-gb10/server-load-vllm.log
  - manuals/vllm-101/sections/2-3-size-memory-on-a-dgx-spark.md
  - manuals/sglang-101/sections/7-1-operating-sglang.md
---

## Situation

A team serves `Qwen/Qwen3-30B-A3B-Instruct-2507` from a pool of GB10 machines behind an autoscaler. At a traffic spike the autoscaler starts new replicas. Each new replica takes more than five minutes before it answers its first request, so the autoscaler counts it as unhealthy and starts more. By the time the replicas are up, the spike is over, and the team pays for machines that served nothing.

The first guess is the image pull or the network. The logs rule both out: the container image was already on each machine, and the weights were on the local NVMe drive. The second guess is that the model is simply too large for the machine, but each replica serves well once it is up.

## Evidence

- [the settings of the server that started](evidence/the-settings.txt)
- [the end of the weight load](evidence/weight-load.txt)
- [the compile and the warmup](evidence/compile-time.txt)
- [the graph capture and the KV cache sizing](evidence/graphs-and-pool.txt)
- [the memory accounting line at the end of startup](evidence/memory-split.txt)

## Questions

1. Read the startup lines in order. Where did the five minutes go, and how much of that was the copy of the weights?
2. On this machine the weights and the GPU allocation live in one memory. Why does the load still take minutes?
3. Which lines prove that the server sized itself as planned, and what do they say about a fraction of 0.75 on this machine?
4. What can a second start of the same image on the same machine skip, and what must it pay again?
5. A field report cut a cold start of another engine from 695 s to 88 s and then to 9.6 s. Which cost did each step remove, and which of those steps apply here?
6. How does this change the autoscaling design?

## Walkthrough

Read the log as a timeline. The weight loader finished after 325.26 seconds, and the model loading line reports 56.93 GiB of memory and 330.542793 seconds. The compile took 18.67 s in total and the warmup 0.40 s. The graph capture finished in 39 secs and took 1.17 GiB. So the weights are almost all of the start, and the compile and the graphs together are about one minute of it.

The second question is why a copy inside one memory takes so long. The loader copies each tensor from the memory-mapped safetensors file into the GPU allocation, one tensor at a time. On the GB10, a copy from a file-backed page is slow. An open issue in the engine's tracker measured about 1.7 ms for each tensor copied from the file view, against about 0.2 ms for a copy that started in host memory. The 0.31.0 release made a different part of the load faster, an indexed lookup of expert names that saves about 25 s on this machine, and the cost of each tensor copy stays. The fix is not in a flag.

The sizing lines show that the memory plan held. The settings line asked for a fraction of 0.75 and an override of 14,685 blocks. The server found 31.32 GiB available for the KV cache, overrode its own count of 21,381 blocks with the 14,685 that the sweep wanted, and reported a pool of 234,960 tokens, enough for 28.68 concurrent requests of 8,192 tokens. The accounting line at the end gives the whole split: 114.94 of 121.69 GiB free at startup, a desired share of 91.27 GiB at 0.75, and an actual use of 58.16 GiB for the weights and other memory, 1.78 GiB for the peak activation and 0.31 GiB for the graphs, with 31.32 GiB of cache in use. On unified memory the fraction is a share of the whole machine, and the rest stays free for the OS and its page cache.

A second start on the same machine pays the weights again. The compile is different: the log shows the engine saving its compiled function to a cache directory, so the next start loads it instead of compiling. The graph capture repeats. The field report in the SGLang manual, from an engineer blog of April 2026 about an eight-GPU server, timed the same phases on the other engine: 695 s cold, with 531 s of it the weight load. Kernel caches kept between runs brought a warm start to 88 s, and a process checkpoint with the weights staged in host memory brought it to 9.6 s. The first step is the cache mount that applies here. The last step needs host memory that the weights can wait in, which this machine shares with the GPU.

## Resolution

The cold start is the weight copy, 325.26 s of a 330 s load, and no serving flag shortens it. The team changes the design around that fact. Each replica starts once and stays up, because a restart pays the full load again. The weights stay on the local NVMe drive and never on a network mount. The compile cache directory is on a volume that survives the container, so the second start skips the 18.67 s compile.

The autoscaler changes in two ways. Its readiness check waits for the application startup line and one short request, and a replica that is still loading counts as starting, not as unhealthy, so the autoscaler stops adding replicas on top of replicas that are about to come up. And the scaling signal moves from the current queue to a forecast with a lead time longer than the six minutes that a start takes, or the pool keeps warm standby replicas that are already loaded. On this machine the fraction of 0.75 left 31.32 GiB for the cache. The block override capped the pool at 234,960 tokens, and without the override the same memory holds about 342,000 tokens at 96 KiB per token, so a standby replica can take a large share of a spike by itself.

## Wrong turns

- "The image pull is slow, cache the image." The image was local. The log puts 325.26 s in the weight loader after the container had started.
- "Add replicas faster when the queue grows." Every replica pays the same five minutes, and the spike lasts less than that. More replicas that arrive late cost more and serve nothing.
- "Lower the memory fraction so the server starts sooner." The fraction decides the cache size, not the copy speed. The weights take 56.93 GiB and 325.26 s at any fraction.
- "Turn off the compile and the graphs to save a minute." Together they cost about one minute of a five-minute start, the compile is cached after the first start, and both pay back on every decode step for the life of the replica.

## Generalize

When a start is slow, read the phase timings before you change anything, because the largest phase is usually one that no flag controls. Then move the design to fit it: start rarely, keep what a restart can reuse on storage that survives, and give the autoscaler a signal with more lead time than the start takes. A replica that is loading is not unhealthy, and a probe that cannot tell the difference will scale a fleet into the ground.

## Taught in

The vLLM manual reads this startup log in [the DGX Spark page](../../../manuals/vllm-101/sections/2-3-size-memory-on-a-dgx-spark.md), weighs compile and graph capture in [the compile page](../../../manuals/vllm-101/sections/4-3-keep-cuda-graphs-and-compile-on.md) and names the image and the driver in [the version pins](../../../manuals/vllm-101/sections/r-4-version-pins.md), and the SGLang manual gives the cache directories and the field report in [its operating page](../../../manuals/sglang-101/sections/7-1-operating-sglang.md).
