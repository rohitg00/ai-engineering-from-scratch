---
id: smaller-prefill-chunks
title: Should the prefill chunk be smaller
card: inference-serving
kind: tradeoff
level: 3
roles: [inference-engineer]
rounds: [design-review, ml-depth]
tags: [chunked-prefill, mixed-chunk, p99-itl, moe, scheduler]
minutes: 10
lessons: []
manuals: [sglang-101#s-the-scheduler-loop-and-schedule-policy, vllm-101#s-keep-long-prompts-from-stalling-short-ones]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Long prompts make the stream pause for the other users of your SGLang server. A tuning page says to lower `--chunked-prefill-size`, so that decode steps run more often between the pieces of a long prompt. Would you follow it? What did the manual find when it tried, and what would you try instead?

## Short answer

Not without a measurement, because the small chunk did not help on either card in the manual's runs. On the GB10 at a low arrival rate a chunk of 1,024 made the P99 ITL worse, 1,977 against 929 ms with the default of 8,192, and at higher rates all chunk sizes tied. I would first try `--enable-mixed-chunk`, which puts the decode tokens into the prefill batch, and measure its trade: on the GB10 it cut the P99 ITL by 15 to 19 percent and at 1 and 2 requests per second it raised the median first token by 49 to 74 percent.

## Full answer

### The rule behind the advice

The scheduler runs a prefill batch whenever it can admit something, and otherwise one decode step. Chunked prefill splits a long prompt into pieces of at most the chunk size, one piece per prefill batch. The default depends on GPU memory: 4,096 on a 22 GB L4 and 8,192 on the GB10. The advice assumes that more pieces give the decode steps more turns.

### What the manual measured

Each run sent 48 prompts of 1,024 to 4,096 tokens with 256 tokens of output, at a Poisson rate of 0.5, 1 or 2 per second, three seeds:

| GPU, model | Chunk | Rate per second | Output tok/s | Median TTFT | P99 ITL |
|---|---|---|---|---|---|
| GB10, Qwen3-30B-A3B | 8,192 | 0.5 | 70.1 | 892 ms | 929 ms |
| GB10, Qwen3-30B-A3B | 1,024 | 0.5 | 68.1 | 1,253 ms | 1,977 ms |
| GB10, Qwen3-30B-A3B | 8,192 | 2 | 129.3 | 269 ms | 312 ms |
| GB10, Qwen3-30B-A3B | 1,024 | 2 | 130.1 | 256 ms | 260 ms |
| L4, Qwen3-8B | 4,096 | 0.5 | 44.1 | 36.0 s | 2,579 ms |
| L4, Qwen3-8B | 1,024 | 0.5 | 43.3 | 37.4 s | 2,922 ms |

At 1 and 2 per second on the GB10 the sizes were inside the seed spread of each other. At 0.5 per second the small chunk lost, and the seed ranges did not overlap. On the L4 the workload was more than the card could serve at any rate: output stayed near 44 tokens per second, the first token took 36 to 62 seconds, and the worst gap stayed between 2.5 and 2.9 s with either chunk.

### Why the small chunk lost on a mixture-of-experts model

Each chunk of a prompt loads the chosen expert weights again. A 2025 study of chunked prefill on such models measured up to 39 percent more memory traffic from the extra loads. With a chunk of 1,024 a 4,096-token prompt runs as up to four chunks, and each reads the experts again. The manual did not measure the expert traffic, so this is a reading and not a result.

### Why nothing helped on the L4

Prefill wins whenever the scheduler can admit something. With a full queue, a smaller chunk only adds more prefill turns ahead of the decode steps, and the stream still waits. The manual expects the fix to be more prefill capacity or fewer long prompts per second, and did not test it.

### The mixed chunk

`--enable-mixed-chunk` puts the decode tokens into the prefill batch, so a decode step does not wait for a prefill turn. On the GB10, against a default run of the same day:

| Rate per second | P99 ITL, default / mixed | Median TTFT, default / mixed | Output tok/s, default / mixed |
|---|---|---|---|
| 0.5 | 922 / 781 ms | 841 / 910 ms | 70.9 / 72.1 |
| 1 | 219 / 177 ms | 244 / 362 ms | 108.8 / 112.6 |
| 2 | 261 / 221 ms | 238 / 416 ms | 133.2 / 138.1 |

A smoother stream and a slower first token. The P99 ITL fell by 15 to 19 percent, outside the seed spread at 0.5 and 2 per second. The median TTFT rose by 49 to 74 percent at 1 and 2 per second, outside the spread. On the L4 the flag changed the P99 ITL by 5 to 8 percent, inside the spread, because the queue set the pace. The card decided whether you get the trade.

### The other direction fails at startup

With a chunk of 8,192 on the L4 the server exited during graph capture. The pool took the same 24,094 tokens as before, and the prefill graph for 8,192 tokens needed more than the 2.33 GB that remained. The last log line is a PyTorch internal assert that asks for a bug report. The real error is the out-of-memory line two lines above it.

### The same trade in vLLM

vLLM has no separate chunk size. Its token budget plays the same role, and at low load a budget of 16,384 raised the P99 ITL by 39 percent against 2,048 on the GB10. Both engines trade the first token of long prompts against the gaps in the stream, and the best value moves with the load.

## Follow-ups

- **Level 3:** Why would a small chunk cost more when the model routes each token to a few experts than on a dense model? Expected: each chunk reads the chosen expert weights again, so four chunks can read the experts four times; a dense model reads the same weights once per step either way.
- **Level 3:** On the L4 neither flag moved the stream. Why not? Expected: the card could not keep up with the prompts, so prefill won every turn it could; a smaller chunk only added prefill turns ahead of the decode steps, and the fix is more prefill capacity or fewer long prompts per second.
- **Level 4:** You raise the chunk to 8,192 on the L4 and the server dies at startup with an assert that asks you to report a bug. What happened? Expected: the prefill graph for 8,192 tokens needed more memory than the 2.33 GB that the pool left; the assert is the last line, and the out-of-memory line above it is the cause.

## Wrong answers

- "Smaller chunks always smooth the stream." On the GB10 at 0.5 requests per second the 1,024 chunk raised the P99 ITL from 929 to 1,977 ms, and at higher rates the sizes tied.
- "The mixed chunk is free." It traded a smoother stream for a slower first token: the median TTFT rose 49 to 74 percent at 1 and 2 requests per second on the GB10.
- "The PyTorch assert at startup is a PyTorch bug." The real error is the out-of-memory line two lines above it; the prefill graph for the larger chunk did not fit in the memory that the pool left.
- "A bigger chunk needs no more memory because the pool is the same." The pool stayed at 24,094 tokens, but the captured prefill graph for 8,192 tokens needed more than the 2.33 GB that remained.

## Taught in

[The scheduler loop and --schedule-policy](../../../manuals/sglang-101/sections/2-2-the-scheduler-loop-and-schedule-policy.md) has the chunk and mixed-chunk sweeps, and [Keep long prompts from stalling short ones](../../../manuals/vllm-101/sections/3-3-keep-long-prompts-from-stalling-short-ones.md) measures the same trade in vLLM.
