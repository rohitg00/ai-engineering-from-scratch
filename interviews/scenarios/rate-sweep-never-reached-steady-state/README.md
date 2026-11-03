---
id: rate-sweep-never-reached-steady-state
title: A rate sweep that never reached steady state
card: scenarios
kind: incident
level: 4
roles: [inference-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [system-design, debugging, ml-depth]
tags: [capacity, request-rate, open-loop, queue, goodput, ttft]
minutes: 30
lessons: [phases/17-infrastructure-and-production/08-inference-metrics-goodput, phases/17-infrastructure-and-production/22-load-testing-llm-apis]
manuals: [vllm-101#s-ref-lab-notes, vllm-101#s-benchmark-your-server-in-15-minutes, sglang-101#s-reading-other-peoples-benchmarks, sglang-101#s-sglang-benchmark-serving]
practice: []
cheatsheet: [inference-load-testing]
related: [scenarios/load-knee-and-admission-cap, inference-serving/goodput-sets-the-cap]
updated: 2026-11-03
system:
  version: vLLM 0.31.0 and SGLang 0.5.22
  model: Qwen/Qwen3-8B
  hardware: one L4 with 24 GB of memory
source:
  - manuals/vllm-101/sections/r-7-lab-notes.md
  - manuals/vllm-101/sections/5-1-benchmark-your-server-in-15-minutes.md
  - manuals/sglang-101/sections/5-3-reading-other-peoples-benchmarks.md
  - manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md
  - manuals/sglang-101/capture/gpu/out-l4/server-h2h-rate-sglang.log
  - manuals/sglang-101/capture/gpu/out-l4/server-h2h-rate-vllm.log
---

## Situation

A platform team must size a fleet of L4 cards for a new chat API. They run a rate sweep against one card with `Qwen/Qwen3-8B`: requests arrive at a fixed rate from 0.5 to 16 per second, each request with a 512-token prompt and a 128-token answer. Every run completes and no request fails. The output rises to 286.6 tokens per second at 4 per second and is still 205.8 at 16. The capacity report concludes that one card can take 16 requests each second, so the fleet plan divides the expected peak by 16.

You get the report the evening before the purchase order goes out. It shows throughput per rate and the median wait for the first token at each rate, and it labels that column "latency under load, expected". Nothing in the report says how long each run lasted or what the GPU clock did.

## Evidence

- [the L4 rate sweep from 0.5 to 16 requests per second](evidence/rate-sweep-table.txt)
- [what a fixed request rate does that a closed loop cannot](evidence/closed-loop-against-fixed-rate.txt)
- [the run length of the rate sweep](evidence/how-long-each-run-lasted.txt)
- [the SGLang pool and one decode line with requests waiting](evidence/sglang-under-the-rate.txt)
- [the vLLM pool and one stats line with requests waiting](evidence/vllm-under-the-rate.txt)
- [which rates kept up, which met the target, and which row the manual refuses to compare](evidence/goodput-by-rate.txt)
- [completed requests per second as the offered rate rose past the peak](evidence/overload-cost-throughput.txt)

## Questions

1. Which column of the report proves that the card kept up with the arrivals, and at which rate does that proof stop?
2. A closed loop at 64 users and an open loop at 16 per second both complete. What is different about the queue in the two cases?
3. The median first token at 16 per second was 94,322 ms. What would that number be if the run had lasted twice as long, and why?
4. Read the two log lines. How many requests ran and how many waited on each engine, and what set that limit?
5. Define the capacity of this card for a target of one second and 100 ms, from the evidence.
6. Write the rate test you would run instead, and the stopping rule that tells you a point is above capacity.

## Walkthrough

1. **Read the table as a time series, not as a list of points.** Up to 2 per second the output grows with the rate: 70.6 at 0.5, 123.6 at 1 and 227.8 at 2 for vLLM, and the median TTFT stays between 180 and 317 ms. The server finishes work as fast as it arrives. At 4 per second the output is 286.6 and the median TTFT is 8,304 ms. At 8 the pair is 261.8 and 27,510 ms, and at 16 it is 205.8 and 94,322 ms. The output peaked at 4 and then fell, while each doubling of the rate multiplied the first token by more than three. The clock column falls from 1,245 MHz at 4 to 450 MHz at 16.
2. **Name the loop.** The second listing separates the two kinds of load test. A closed loop with a fixed number of users never falls behind, because a user sends the next request only after the answer. A fixed rate keeps sending whether the server keeps up or not. Past the rate the server can serve, the queue grows, and the first token takes longer with every request. From 4 per second, the first-token column of the report measures queue time.
3. **Ask how long the run was.** The third listing gives the run length: at least 32 prompts, or 30 seconds of arrivals. A median TTFT of 94,322 ms from a run with 30 seconds of arrivals means that the typical request waited longer than the whole arrival window. The queue was still growing when the last request arrived. Run the same rate for twice as long and the median grows, because every extra second of arrivals adds work that the server cannot drain. The number is a property of the run length, not of the card. That is what a point above capacity looks like: the latency never settles.
4. **Count who ran and who waited.** SGLang ran 37 requests with 71 in its queue and the pool 93 percent full. vLLM ran 43 requests with 30 waiting and 99.7 percent of its pool in use. The pools hold 24,094 and 24,096 tokens, so about forty requests of 512 plus 128 tokens fit at once. Everything that arrives faster than those slots free up waits. The engines differ only in how many they admit before they queue.
5. **Define capacity from goodput.** The manual set two limits, 1 s to the first token and 100 ms per token. At 2 per second, vLLM served a median of 1.36 requests per second within those limits and SGLang 0.88, with overlapping seed ranges. From 4 per second, no request met them on either engine. So the card sustains that target somewhere between 2 and 4 per second, and the number to plan with is 2. The row at 16 is not even comparable: every run of both engines stayed under 1,000 MHz after three tries, so the manual does not compare it.
6. **Count what overload cost.** The last listing is the same card in the open loop of the SGLang manual. Past its peak, the BF16 server completed fewer requests as more were offered: 2.01 per second at 4 offered, 1.91 at 8 and 1.62 at 16. The median SM clock fell from 1,320 MHz at 4 offered to 465 MHz at 16, and 70 percent of the samples showed thermal slowdown. On this passively cooled card, overload is not free. It heats the GPU, the clock falls, and the server completes less than it did at a lower rate.

## Resolution

The report mistook completion for capacity. A fixed-rate run always completes, because the client stops sending at the end of its arrival window and the server drains the queue afterwards. The first-token column from 4 per second up is the length of that queue, and at 16 per second it reached 94,322 ms after 30 seconds of arrivals. The card never served 16 requests per second within any latency target. It served about 2 per second within the target of 1 s and 100 ms, with vLLM at 1.36 and SGLang at 0.88 requests per second of goodput at an offered 2.

The peak is divided by 2, not by 16, before any headroom. The test changes in four ways. Run each rate long enough to see whether the first token settles; if the median TTFT rises when you extend the run, the rate is above capacity and the number is meaningless. Report goodput per offered rate against your own target, next to the throughput. Record the SM clock and the temperature, and repeat or discard any point that fell under the clock floor, as the manual did for the row at 16. Run the closed loop too, because the closed loop finds the knee by user count and the open loop finds the rate the card sustains, and a plan needs both.

## Wrong turns

- "Every run finished, so the card handles 16 per second." A fixed-rate client stops sending at the end of its window and the server drains the queue afterwards. Completion is guaranteed. The 94,322 ms median first token is the queue, not the service.
- "Output was still 205.8 tokens per second at 16, so throughput held." Output fell from 286.6 at 4 per second to 205.8 at 16 while the clock fell from 1,245 to 450 MHz. The server did less work at the higher rate, and the open loop of the SGLang manual shows the same fall in completed requests per second.
- "Take the TTFT at 16 as the worst case users will see." That value depends on how long the test ran. Extend the run and it grows. A number that grows with the run length describes the test, not the server.
- "Switch to the engine with the lower TTFT at 8 per second." At 8 per second both engines were far past capacity, 27,510 against 37,211 ms. Choosing between two overloaded servers by their queue length is not a capacity decision.

## Generalize

A system above its service rate has no steady state, so every latency you measure there is a function of how long you measured. Capacity is the highest offered rate at which the latency settles and the goodput holds, found with an open loop that runs long enough to prove the settling, and confirmed with a closed loop for the user count. Completion, throughput and a median taken from a growing queue are not capacity.

## Taught in

The vLLM manual gives the sweep in [the lab notes](../../../manuals/vllm-101/sections/r-7-lab-notes.md) and the two loops in [the benchmark page](../../../manuals/vllm-101/sections/5-1-benchmark-your-server-in-15-minutes.md#choose-a-closed-loop-or-a-fixed-rate), the SGLang manual reads the same pair at [a fixed arrival rate](../../../manuals/sglang-101/sections/5-3-reading-other-peoples-benchmarks.md#the-same-pair-at-a-fixed-arrival-rate) and runs its own open loop in [the benchmark serving page](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md), and [the inference metrics lesson](../../../phases/17-infrastructure-and-production/08-inference-metrics-goodput/docs/en.md) defines goodput while [the load testing lesson](../../../phases/17-infrastructure-and-production/22-load-testing-llm-apis/docs/en.md) names the four load patterns.
