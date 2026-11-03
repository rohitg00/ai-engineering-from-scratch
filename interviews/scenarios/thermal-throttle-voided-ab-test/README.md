---
id: thermal-throttle-voided-ab-test
title: A thermal throttle that voided an A/B test
card: scenarios
kind: incident
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [thermal-throttle, sm-clock, cuda-graphs, benchmark, methodology]
minutes: 20
lessons: [phases/17-infrastructure-and-production/22-load-testing-llm-apis]
manuals: [sglang-101#s-forwardmode-and-cuda-graphs, sglang-101#s-sglang-benchmark-serving, vllm-101#s-speed-up-decode-with-eagle3, vllm-101#s-ref-lab-notes]
practice: []
cheatsheet: [inference-load-testing]
related: [scenarios/prefix-cache-inflated-benchmark]
updated: 2026-11-03
system:
  version: SGLang 0.5.22
  model: Qwen/Qwen3-8B
  hardware: one L4 with 24 GB of memory, in a node whose second L4 ran other tenants
source:
  - manuals/sglang-101/capture/gpu/incidents/l4-thermal-throttle.txt
  - manuals/sglang-101/capture/gpu/out-l4/graphs-sameday-starts.log
  - manuals/sglang-101/sections/4-1-forwardmode-and-cuda-graphs.md
  - manuals/vllm-101/sections/4-1-speed-up-decode-with-eagle3.md
---

## Situation

A team wants to know whether CUDA graphs help their `Qwen/Qwen3-8B` server on an L4. They run the concurrency sweep with graphs on, then the same sweep with graphs off, one after the other on the same afternoon, three seeds each. The two tables agree within a few percent, and at several points the run with graphs off reads a little faster. They conclude that graphs do nothing on this card and plan to turn them off in production to start faster and save memory.

One teammate mentions that the fans of the node were loud all afternoon, and that the other L4 in the node was running another team's test pods and an FP8 sweep at the same time.

## Evidence

- [the first comparison of CUDA graphs on and off, as the team read it](evidence/first-ab-table.txt)
- [the state of both GPUs in the node during that sweep](evidence/gpu-state-during-sweep.txt)
- [the start of each run in the repeated sweep, with the wait before it](evidence/cooled-restarts.txt)
- [the same comparison on a cooled card, both servers on one day](evidence/same-day-pair.txt)
- [the same mistake in a speculative decoding test on the other engine](evidence/the-other-engine.txt)

## Questions

1. The two sweeps agree within a few percent. Why is that agreement not evidence that graphs do nothing?
2. Read the GPU state line. Which slowdown flag is set, what clock does the card run at, and what share of its maximum is that?
3. What does a slow clock do to a launch-bound step and to a memory-bound step, and why does that hide a graph effect in particular?
4. Design the protocol that makes an A/B pair comparable on this card. Give the start condition, the repeat rule and what you record.
5. With that protocol, what did graphs change on this card, and where did the result surprise us?
6. The same mistake appeared in a speculative decoding test on another engine. What was the clock gap there, and what did the team do with those runs?

## Walkthrough

Start with the first table. The default server and the server without graphs sit within a few percent at every concurrency, and the seed ranges overlap. At one user the ranges are 10.0 to 14.9 and 10.2 to 12.3 tokens per second, which is wide for a point that should be stable. The sweep had no GPU telemetry, so nothing in the table says what the card was doing.

The GPU state line says it. The first GPU, the one that ran the sweep, was at 87 C, its SM clock was 360 MHz against a maximum of 2,040, and the software thermal slowdown flag was active while the card reported 100 percent utilization. The second GPU, at 81 C, held 2,025 MHz while it ran the other tenants' pods. The card under test was running at about a sixth of its clock for a reason that has nothing to do with the server flags.

A CUDA graph removes the launch time of the kernels in one decode step. On this card and model that saving is about half a millisecond of a step of 60 to 70 ms, and a throttled GPU is slow on every step, so the saving disappears in the noise. At the same time the throttle moves with temperature and with the neighbour's load, so two sweeps that ran one after the other did not run at the same speed. Agreement within a few percent on a card whose clock wandered is no evidence at all. The team removed those numbers.

The third listing shows the repaired method. Every run of the repeated sweep started at 72 C or below, and the kit waited for that temperature before each start, from 116 to 287 s. A run whose median SM clock fell under 1,000 MHz was set aside and repeated, up to three times. Both servers ran on one day, one after the other, with the same pool of 24,094 tokens, and a sampler recorded the clock and the temperature every second.

The same-day pair is the result. Up to 16 users the graphs saved 0.5 to 0.7 ms of a step, about 1 percent, 60.15 against 60.64 ms at one user. Throughput was within 1.2 percent from 2 users up. At 16 and 32 users the server without graphs had the lower P99 ITL, 73 against 80 ms and 87 against 103 ms, with no seed overlap, and the manual reports that gap without a mechanism for it. At 64 users batches above 48 ran eager on both servers, so that row does not measure graphs at all.

The last listing is the other engine. Its first speculative decoding runs had no clock lock. At one user the run with no speculation ran at 210 MHz and the run with speculation at about 1,400 MHz. A gap that large hides any effect of the feature, so the team set those runs aside and locked the clock at 900 MHz before it compared again.

## Resolution

The first A/B was void. The card ran at 360 MHz with the thermal slowdown active, the clock was not recorded, and the two sweeps did not share a clock. Any conclusion about graphs from those tables is a conclusion about heat.

The repaired comparison kept graphs on. They saved about 1 percent of each decode step on this dense model, the throughput tie held within 1.2 percent, and the unexplained lower tail without graphs at 16 and 32 users is a reason to measure the tail on your model, not a reason to turn graphs off for memory. Size the graphs to your traffic instead. The method is the real fix: record `clocks.sm` and the temperature every second during every benchmark, start each run at a temperature that the card can hold, repeat any run whose median clock falls under your floor, and compare two runs only at similar clocks. The lab notes of the vLLM manual name four L4 sessions for the same reason, and compare numbers only inside one session.

## Wrong turns

- "Both configs ran on the same hot card, so the heat cancels out." The throttle moved with the temperature and with the neighbour's load. Two runs an hour apart did not share a clock, and a card at a sixth of its clock hides a half-millisecond effect in any case.
- "Lock the clock at the maximum and the problem is gone." A lock sets the highest clock, and a GPU at a high temperature still slows below it. We locked at 900 MHz, a value that the card could hold, and still set aside runs that fell under it.
- "Run the two configs in the other order." The second run still inherits the heat of the first. Alternate the configs, cool the card to the same temperature before each run, and record the clock.
- "Wait one minute between runs." The repeated sweep needed 116 to 287 s to reach 72 C before a start. Wait for a temperature, not for a time.

## Generalize

Every A/B on hardware needs a control for the hardware. A clock that changes with heat or with a neighbour is a hidden variable that moves every number by the same factor, and that factor swallows small effects and invents large ones. Record the clock with every measurement, hold the start condition fixed, and treat two numbers from different clocks as two numbers from different machines.

## Taught in

The SGLang manual records the first sweep and the repaired pair in [the CUDA graphs page](../../../manuals/sglang-101/sections/4-1-forwardmode-and-cuda-graphs.md) and sets the clock rule in [its benchmark page](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md), the vLLM manual tells the speculative decoding version in [the EAGLE3 page](../../../manuals/vllm-101/sections/4-1-speed-up-decode-with-eagle3.md) and names the sessions in [the lab notes](../../../manuals/vllm-101/sections/r-7-lab-notes.md), and [the load testing lesson](../../../phases/17-infrastructure-and-production/22-load-testing-llm-apis/docs/en.md) covers what a client cannot see.
