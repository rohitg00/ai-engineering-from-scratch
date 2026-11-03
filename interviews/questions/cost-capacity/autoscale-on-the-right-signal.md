---
id: autoscale-on-the-right-signal
title: Autoscale a model service on queue and cache signals
card: cost-capacity
kind: design
level: 3
roles: [inference-engineer, ai-data-engineer, applied-ai-engineer]
rounds: [system-design, design-review]
tags: [autoscaling, kubernetes, probes, cold-start]
minutes: 15
lessons: [phases/17-infrastructure-and-production/10-cold-start-mitigation]
manuals: [vllm-101#s-run-vllm-on-kubernetes, vllm-101#s-watch-vllm-in-production, sglang-101#s-operating-sglang]
practice: []
cheatsheet: [gpu-kubernetes, serving-engines-compared]
related: [cost-capacity/warm-pool-or-cold-start, cost-capacity/size-the-pool-from-peak]
updated: 2026-11-03
---

Your model service runs as a plain Deployment with an autoscaler on CPU use. During a traffic spike the autoscaler added replicas late, kept adding them while the new pods were still loading weights, and a liveness probe restarted the busiest pod in the middle of the spike. Redesign the scaling and the probes.

## Short answer

Scale on the engine's own signals, not on CPU: the count of waiting requests and the KV cache usage say that a server is saturated long before CPU does. Give the startup probe a window longer than your measured cold start, so that a loading pod is neither sent traffic nor restarted, and make the liveness probe cheap, so that a busy server does not lose its busiest pod to a probe that waited in the queue. Keep the weights and the compile cache on persistent storage, so that a new replica is ready in a fraction of the time.

## Full answer

### Why CPU is the wrong signal

GPU load is not CPU load. A saturated engine shows waiting requests above zero and cache usage near one while the CPU looks calm. The vLLM manual says this directly about the plain Deployment: it routes at random and scales on the wrong signal. The routing layers that the manual lists read `vllm:num_requests_waiting`, `vllm:num_requests_running` and `vllm:kv_cache_usage_perc` to pick a replica, and an autoscaler should read the same series.

### Read the signals in pairs

| Reading | Meaning |
|---|---|
| waiting above 0, cache usage below 0.9 | the batch size or the token budget limits admission, not memory |
| waiting above 0, cache usage near 1 | the pool limits admission, so add memory or replicas |
| slow first token with nothing waiting | long prompts or a slow tokenizer, not a capacity problem |
| preemptions with long answers | running requests grow until the pool runs out |

The second row is a reason to add a replica, because the pool is full. On the first row, raise the batch limit or the token budget first, while the pool has room. If the queue stays after that, or the limit is already where the latency target needs it, add a replica, because each replica brings its own batch limit and token budget.

### Probes that match a slow start

The manual's example gives the startup probe 90 checks at 10 second intervals, which is 15 minutes, and notes that its own machine took about 8 minutes for a first start. Set the window from your measured cold start. For readiness, send one short real request, which proves the engine can generate, or use the ready endpoint on an engine that has one. For liveness, use a cheap health path. The SGLang manual turns generation off in the health endpoint, because a probe that generates waits in the queue under load, times out after 20 seconds, and marks a busy server unhealthy. In one incident each failed probe also left an orphan request in the scheduler, so the probes added to the load they were meant to detect.

### Stop the overshoot

New pods take minutes to load. The autoscaler sees the signal still high and adds more. Give it a stabilization window at least as long as the cold start, cap the replicas added per step, and shorten the cold start itself: weights on local disk, the compile cache on a persistent volume, and a preload before the server takes traffic. The cold start lesson adds the warm pool for the interactive path, so that the first replica is never a cold one.

### Scale down without losing work

Remove the pod from the load balancer, send SIGTERM to the main process only, and set a grace period at least as long as the longest request at the output cap. A forced kill, or a signal to the whole process group, drops every running request.

## Follow-ups

- **Level 3:** Which pair of readings says the pool is the bottleneck, not the batch limit? Expected: waiting requests above zero with cache usage near one. With cache usage below 0.9, the batch size or the token budget limits admission instead.
- **Level 3:** Why does a generating health probe hurt under load? Expected: its request waits in the queue like any other, times out, and marks a busy server unhealthy. In one incident each failed probe also left an orphan request behind.
- **Level 4:** How do you keep the autoscaler from overshooting during a cold start? Expected: a stabilization window at least as long as the measured cold start, a cap on replicas added per step, and a shorter cold start from persistent weights and compile caches.
- **Level 4:** What does a scale-down need so that no request is lost? Expected: remove the pod from the load balancer, send SIGTERM to the main process only, and a grace period at least as long as the longest request at the output cap.

## Wrong answers

- "Scale on GPU utilization instead of CPU." Utilization can read high while requests wait and low while the pool is full. The queue and the cache usage are the signals the engine exposes for this.
- "Make the liveness probe stricter so that bad pods restart faster." Under load a strict probe restarts healthy, busy pods. The fix is a cheap probe and a long startup window.
- "Add replicas faster to beat the spike." Replicas that take minutes to load add nothing during the spike and cost money after it. Shorten the cold start and keep a warm margin.

## Taught in

The [Kubernetes section of vLLM 101](../../../manuals/vllm-101/sections/6-4-run-vllm-on-kubernetes.md) sets the probes and names the wrong scaling signal, the [production watching section](../../../manuals/vllm-101/sections/5-2-watch-vllm-in-production.md) reads the metrics in pairs, the [operating section of SGLang 101](../../../manuals/sglang-101/sections/7-1-operating-sglang.md) explains the health probe incident and the drain, and the [cold start lesson](../../../phases/17-infrastructure-and-production/10-cold-start-mitigation/) sizes the warm pool.
