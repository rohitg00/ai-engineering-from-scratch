---
id: same-throughput-two-choices
title: Same throughput, two choices at a full pool
card: inference-serving
kind: tradeoff
level: 4
roles: [inference-engineer]
rounds: [design-review, system-design]
tags: [engine-choice, p99-itl, ttft, full-pool, benchmark]
minutes: 12
lessons: []
manuals: [sglang-101#s-reading-other-peoples-benchmarks, vllm-101#s-tune-chat-for-many-users]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

On one L4 with Qwen/Qwen3-8B and the same 24,096-token pool, a closed-loop sweep at 64 users gives vLLM 241 tokens of output per second and SGLang 257, so the engines tie on throughput. Yet the chat team says one of them is unusable at that load and the other is fine. What are they seeing, and which engine do you choose for chat?

## Short answer

They are seeing two different choices at a full pool. At 64 users vLLM ran 40 requests and kept 11 waiting with its pool 99.5 percent full, so its first token came 1.7 times sooner, 10,953 against 18,356 ms, but each new prefill shared the step with the running decodes and the P99 gap between tokens was 1,363 ms against 114 on SGLang, which ran 37 requests and kept 27 waiting. For chat, read the P99 ITL next to the first token at your real load and traffic shape, because the two engines pick different sides of that trade by default, and one flag on SGLang moved its side.

## Full answer

### Matched pools, matched clocks

The manual made three choices so that only the engine differed. The vLLM server got `--num-gpu-blocks-override 1506`, 1,506 blocks of 16 tokens, which is 24,096 tokens, while SGLang sized 24,094 tokens for itself. Both ran in one session on one GPU, every run started at 72 C or below, and a run with a median SM clock under 1,000 MHz was set aside and repeated, up to three times. The vLLM server got `--max-model-len 8192`, which every request fits, and its sampler build problem was worked around; the benchmark is greedy, so the sampler does not change the output.

### The closed loop

| Concurrency | Output tok/s, SGLang / vLLM | Median TTFT, SGLang / vLLM | P99 ITL, SGLang / vLLM | Median SM clock, SGLang / vLLM |
|---|---|---|---|---|
| 1 | 13.84 / 13.51 | 185 / 192 ms | 104 / 105 ms | 1,290 / 1,290 MHz |
| 8 | 112.46 / 112.79 | 170 / 253 ms | 71 / 68 ms | 1,485 / 1,470 MHz |
| 16 | 201.13 / 200.90 | 212 / 289 ms | 81 / 80 ms | 1,470 / 1,425 MHz |
| 32 | 271.28 / 273.93 | 2,871 / 1,813 ms | 102 / 619 ms | 1,320 / 1,275 MHz |
| 64 | 256.62 / 241.39 | 18,356 / 10,953 ms | 114 / 1,363 ms | 1,215 / 1,013 MHz |

Up to 32 users the engines were within 3 percent on throughput and within 6 percent on the time per token. Below the point where the pool fills, SGLang gave the first token sooner, 170 against 253 ms at 8 users.

### What the stats lines show

Above that point the engines made different choices. SGLang ran 37 requests and kept 27 waiting, with the pool 92 percent full. vLLM ran 40 requests and kept 11 waiting, filled 99.5 percent of its pool, and prefilled new prompts at 460 tokens per second while it did. More requests started, so their first token came sooner. Each new prefill then shared the step with the running decodes, so the streams stalled. The clock caveat belongs with the last row: even after three tries the vLLM runs at 64 users had a median clock of 1,013 MHz against 1,215, so part of the throughput gap is the card. The 12-times gap in the inter-token tail is too large for a 17 percent clock difference.

### A fixed arrival rate

Up to 2 requests per second the engines tied on throughput, SGLang gave the first token sooner, 284 against 317 ms at 0.5 per second, and vLLM had the shorter time per token, 68 against 74 ms at 1 per second. At 2 per second vLLM served a median of 1.36 requests per second within the latency target and SGLang 0.88, with overlapping seed ranges. From 4 per second both fell behind the arrivals, and the same admission choice appeared: vLLM gave 286.6 against 257.5 tokens per second, 11 percent more, and its P99 time per token was 187 against 127 ms.

### Waves and mixed lengths

With fixed prompt lengths at 16 users, requests arrive in waves, and the engines tied on throughput while vLLM gave the first token sooner, 1,499 against 1,775 ms, and SGLang kept the stream smooth, with a P99 ITL of 81 against 502 ms. With mixed lengths vLLM led by default: 169.6 against 159.6 tokens per second and a P99 ITL of 191 against 363 ms. Then `--enable-mixed-chunk` on SGLang, which puts the running decodes into the prefill batch, closed that gap to 193 against 191 ms, at the cost of a worse P99 ITL with fixed lengths, from 81 to 203 ms.

### Shared prompts

With a shared system prompt both caches hit, and both engines kept the median first token under 500 ms at every shared length. With the cache off SGLang took 14,706 ms and vLLM 13,353 at 4,096 shared tokens. The cache is the result, not the engine.

### The GB10

On the GB10 the two engines gave the same output at 32 and 64 users, and the vLLM P99 ITL was about twice as high, 478 against 220 ms at 32 users.

### How to pick

On this card with unique prompts the choice was mostly a latency decision, and the shape of the traffic picked the winner. When requests arrived together, at a full pool or in waves, SGLang protected the stream and vLLM the first token. With mixed lengths vLLM led by default and one flag removed the lead. Decide on model support, startup time and the hardware you have, then measure your own length mix, and read the P99 ITL next to the first token. Compare engines at matched pools and matched clocks, or not at all.

## Follow-ups

- **Level 3:** Why did vLLM give the sooner first token and the worse stream at the same throughput? Expected: it admitted more requests, 40 against 37, and filled 99.5 percent of its pool while it prefilled new prompts at 460 tokens per second; each new prefill shared the step with the running decodes, so the streams stalled while the first tokens came sooner.
- **Level 4:** With mixed prompt lengths vLLM led on the stream, and then SGLang tied it. What changed? Expected: the mixed-chunk flag put the running decodes into the prefill batch, so a new prompt no longer stopped the stream; the P99 ITL fell from 363 to 193 ms with mixed lengths, and the cost was a worse P99 ITL with fixed lengths, 81 to 203 ms, because whole waves then shared steps with decodes.
- **Level 4:** A published comparison shows one engine 29 percent ahead. What do you ask before you believe it? Expected: the versions and the date, whether the workload matches yours including the share of repeated prefix, whether the memory budgets and context flags were matched, whether the concurrency passed the decode graph limit, whether the flags were mapped correctly, and who paid for the test.

## Wrong answers

- "They tie on throughput, so pick either." At 64 users the P99 gap between tokens was 1,363 ms on one and 114 on the other at the same output; for chat that is the number the users feel.
- "The engine with the sooner first token is better for chat." It bought the first token with stalls in the stream; the P99 ITL was 12 times higher, and no cap fixed it; read both numbers.
- "The faster engine in the benchmark is faster." Compare only at matched pools and clocks; one published test left one engine at its automatic memory fraction and the other at 0.9 of GPU memory, so the two pools differed.
- "The result transfers to our mixed traffic." The winner changed with the traffic shape: at a full pool and in waves one engine protected the stream, with mixed lengths the other led by default, and one flag removed that lead; measure your own length mix.

## Taught in

[Reading other people's SGLang benchmarks](../../../manuals/sglang-101/sections/5-3-reading-other-peoples-benchmarks.md) has the matched-pool comparison, and [Tune chat for many users](../../../manuals/vllm-101/sections/3-1-tune-chat-for-many-users.md) adds the GB10 P99 ITL.
