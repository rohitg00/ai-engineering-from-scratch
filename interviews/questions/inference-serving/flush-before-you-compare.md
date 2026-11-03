---
id: flush-before-you-compare
title: The knee that the prefix cache hid
card: inference-serving
kind: debug
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, screen]
tags: [benchmark, prefix-cache, flush, knee, ttft]
minutes: 8
lessons: []
manuals: [vllm-101#s-benchmark-your-server-in-15-minutes, sglang-101#s-sglang-benchmark-serving]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Your first concurrency sweep on an L4 shows a first-token median of 0.3 s up to 16 users and 1.8 s at 32, so you set the production limit at 20 users per replica. A second sweep with a reset before each run puts the first token at 1.6 s already at 16 users. Which sweep do you trust, and why do the two disagree?

## Short answer

Trust the sweep with the reset. The first sweep kept one server for all the user counts and sent the same first prompts at every count with a fixed seed, so below 32 users many requests found their prompt in the prefix cache and skipped the prefill. With the reset the median first token rose at every step, about 0.65 s at 4 users, 1.0 s at 8 and 1.6 s at 16, and the P99 ITL jumped from about 70 ms at 8 users to 522 ms at 16, so the knee on this card sits between 8 and 16 users, not between 16 and 32.

## Full answer

### How the cache inflated the first sweep

The random dataset with a fixed seed sends the same prompts in every run. The first sweep ran all the user counts against one server, so each run found the prompts of the earlier runs in the cache. This was the table it produced, Qwen/Qwen3-8B on vLLM 0.31.0, three seeds per point:

| Users | Output tok/s | Median TTFT | Median TPOT | P99 ITL |
|---|---|---|---|---|
| 1 | 13.5 | 191 ms | 60.4 ms | 105 ms |
| 8 | 112.8 | 253 ms | 65.8 ms | 67 ms |
| 16 | 201.3 | 288 ms | 69.5 ms | 85 ms |
| 32 | 275.1 | 1,800 ms | 101.8 ms | 613 ms |
| 64 | 242.3 | 11,181 ms | 129.2 ms | 1,233 ms |

The jump between 16 and 32 users looked like the knee. It was the throughput peak. A cached prompt skips its prefill, so its first token comes fast, and most requests below 32 users had that advantage.

### The flushed comparison

The same sweep at 900 MHz, the cache reset ahead of every run, against an unflushed run of the same session:

| Users | vLLM, flushed against unflushed | SGLang, flushed against unflushed |
|---|---|---|
| 4 | 650 / 145 ms | 532 to 645 / 141 ms |
| 8 | 951 to 978 / 264 to 274 ms | 1,174 to 1,273 / 173 to 178 ms |
| 16 | 1,550 to 1,587 / 294 to 295 ms | 1,804 to 1,944 / 218 ms |
| 32 | 1,982 to 2,084 / 2,012 to 3,091 ms | 3,216 to 3,228 / 2,710 to 2,917 ms |

From 32 users the queue dominated and the reset changed little. Below it, the cache made most of the fast first tokens.

### The size of the effect on one load

The same 64 prompts at 16 users, four times in a row, median TTFT in ms: vLLM read 925 fresh, 148 on a repeat without a flush, 1,163 on a repeat after a flush, and 184 on another repeat without one. SGLang read 394, 82.5, 289 and 77. The repeat without a flush read a first token about 6 times lower on vLLM and 4.8 times lower on SGLang. The time per token changed by less than 15 percent, because a hit removes prefill work and leaves the decode work the same.

On the GB10 the effect reversed a sweep. A single kit run read 677.61 ms as the median time to first token with a cap of 8 and 390.38 ms with a cap of 32: more load, a faster first token. The prefill lines showed why. At a cap of 8, 16 of the 64 prompts were in the cache before the run started; at 32, 64 of 128; at 64, 128 of 256. Three seeds with fresh servers put the first token back in order, 209.98 ms at 8 and 416.37 at 32.

### The protocol

1. Start each run with an empty cache. Restart the server, or call the reset route: `POST /reset_prefix_cache` on vLLM, which exists only with `VLLM_SERVER_DEV_MODE=1` and must never be exposed, or `--flush-cache` on the SGLang client, which calls `/flush_cache` after the warm-up. SGLang flushes only when no request runs or waits; otherwise the route answers HTTP 400 and the log says so.
2. Use a new seed for each run, so that the random dataset sends new prompts.
3. Record the cached tokens. Read the prefix cache counters before and after the run, or turn on the per-response count, `--enable-prompt-tokens-details` on vLLM and `--enable-cache-report` on SGLang.
4. Write the cache setting and the cached tokens next to the result.

The vLLM sweep tool resets the server caches between its runs for you.

## Follow-ups

- **Level 2:** Why did the time per token barely move between the flushed and the unflushed runs? Expected: a cache hit removes prefill work and leaves the decode work the same, so TTFT falls and TPOT moves by less than 15 percent.
- **Level 3:** On the GB10 a single run read a faster first token at a cap of 32 than at a cap of 8. How is that possible? Expected: the runs shared one server and one seed, so the run at 32 found 64 of its 128 prompts in the cache from the earlier runs and half of its requests skipped prefill; three seeds on fresh servers put the first token back in order.
- **Level 3:** The flush route on SGLang answered HTTP 400. What happened? Expected: the server flushes only when no request runs or waits; a request was still pending, so the flush did not run and the log says so, and the run must wait or restart the server.
- **Level 4:** How would you make the warm-cache effect part of a benchmark on purpose? Expected: measure it as its own axis; record the cached tokens per run from the counters or the per-response field, and report a warm-cache row next to a cold row, each with its hit rate, instead of letting an unknown mix of the two set the knee.

## Wrong answers

- "The jump from 0.3 to 1.8 s between 16 and 32 users is the knee." That sweep ran without a reset, so most requests below 32 users skipped their prefill; with a reset the P99 ITL jumped from about 70 to 522 ms between 8 and 16 users, and that is the knee.
- "Turn the prefix cache off for benchmarks." Production runs with it on; reset it between runs, use a new seed per run and record the cached tokens instead.
- "The time per token is inflated too, so throw the whole sweep away." A hit removes prefill work only; the time per token changed by less than 15 percent between flushed and unflushed runs, so the TPOT column stands and the TTFT column does not.
- "The random dataset gives new prompts every run." With the same seed the client sends the same prompts; the dataset is random only across seeds, so use a new seed per run.

## Taught in

[Benchmark your server in 15 minutes](../../../manuals/vllm-101/sections/5-1-benchmark-your-server-in-15-minutes.md) and [the SGLang benchmark section](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md) show the flushed and unflushed runs and the reset protocol.
