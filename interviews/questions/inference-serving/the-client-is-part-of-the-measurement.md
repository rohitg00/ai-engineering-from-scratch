---
id: the-client-is-part-of-the-measurement
title: Two clients, two numbers, one server
card: inference-serving
kind: concept
level: 2
roles: [inference-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [screen, ml-breadth]
tags: [benchmark, client-bias, temperature, prompt-lengths, load-testing]
minutes: 8
lessons: [phases/17-infrastructure-and-production/22-load-testing-llm-apis]
manuals: [vllm-101#s-benchmark-your-server-in-15-minutes, sglang-101#s-sglang-benchmark-serving]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Two engineers benchmark the same server on the same day and report numbers that differ by a few percent. Both used standard benchmark clients. Before you look at the server, what about the clients could explain the gap, and what rules would you set for the team?

## Short answer

The client is part of the measurement. On one vLLM server the SGLang client read a median first token 3 to 10 percent higher and an output throughput 2 to 8 percent lower than the vLLM client, the two clients sent different random prompts, and temperature 0.7 raised the time per token by 10 to 13 percent at one user against temperature 0. The rules: one client, one temperature, one prompt length distribution with the range ratio stated, a flush and a new seed per run, the clock recorded, and all of that written next to every number.

## Full answer

### Three clients on one server

The manual ran the SGLang client, `vllm bench serve` and its Rust version against one vLLM server with Qwen/Qwen3-0.6B, with a cache reset before every run and the clients alternated over two rounds. Output tokens per second at 64 users:

| Temperature | SGLang client | vllm bench | vllm bench, Rust |
|---|---|---|---|
| 0 | 359, 348 | 379, 377 | 371, 365 |
| 0.7 | 331, 343 | 360, 363 | 356, 353 |

The two vLLM clients agreed within the noise at 1, 16 and 64 users. The SGLang client read a slower server: a median first token 3 to 10 percent higher, and at 16 and 64 users an output throughput 2 to 8 percent lower. The two clients send different prompt tokens from their random datasets, so part of a small gap can come from the prompts. Temperature 0.7 raised the median time per token over temperature 0 by 10 to 13 percent at one user and 3 to 6 percent at 16 and 64 users.

### Four defaults that change the result

The SGLang client makes choices before it measures anything:

| Setting | Default | What it does to the result |
|---|---|---|
| `--random-range-ratio` | 0.0 | each length is drawn from 1 to the length you asked for, so the average prompt is about half of it |
| `ignore_eos` | on | every request generates exactly the output length you asked for |
| `--request-rate` | inf | all requests are sent at time 0, and only the concurrency cap holds them back |
| `--warmup-requests` | 1 | one request runs before the clock starts |

The first row is the trap. With the default ratio, an input length of 512 gives an average prompt near 256 tokens, and the report says 512. Pass 1.0 or write the length distribution next to the result. With 1.0, 32 prompts of 512 tokens give an input total of 16384 in the report.

### Fixed lengths form waves

With the ratio at 1.0 every request has the same length, so requests that start together finish together and their replacements arrive together. At 16 users on the L4, fixed lengths gave a median time to first token of 1,996 ms and a P99 ITL of 82 ms; mixed lengths gave 291 ms and 300 ms. The two settings measure two different servers. Fixed lengths measure bursts, with a slow first token and smooth tokens. Mixed lengths measure steady traffic, with a fast first token and stalls in the stream. Keep 1.0 to compare two builds, and run your real length mix before you set a latency target.

### The client's own queue

The SGLang client sends every request from one Python process. A 2026 study found that such a client adds its own queue at high request rates and then reports a first token and a time per token higher than the server gave. Before you trust a number at a high rate, compare one client process with two processes that each send half the rate. The lesson names the same trap for a general load tester: tokenization under the interpreter lock in the client inflates the reported inter-token latency, and one prompt sent in a loop hits the prefix cache on almost every request and inflates the throughput.

### Hand-written scripts

One report measured 13 tokens per second for a large model on eight GPUs against 60 from a hosted API. The script counted words split on spaces and included the first-token time in the rate. A word is not a token, and TTFT is not decode time. Use the benchmark client, which counts tokens and keeps TTFT and TPOT apart.

### The rules

1. One client, one version, named in every result.
2. One temperature, named in every result.
3. `--random-range-ratio 1.0`, or the length distribution written down.
4. A flush and a new seed before every run, and the cached tokens recorded.
5. The GPU clock recorded and the hot runs set aside.
6. Throughput reported only together with the median and P99 TTFT and TPOT at the same cap.

## Follow-ups

- **Level 2:** Why does the default range ratio describe half the work? Expected: each length is drawn from 1 to the length asked, so the average prompt is about half of it; with 1.0 every prompt has the full length and the input token total in the report confirms it.
- **Level 3:** Fixed lengths gave a late first token and a steady stream, mixed lengths the opposite. Which do you use? Expected: fixed lengths to compare two builds, because they repeat exactly; your real length mix before you set a latency target, because the two shapes measure two different servers.
- **Level 3:** A teammate's hand-written timing loop reads 13 tokens per second where a hosted API reads 60. What is wrong with the loop? Expected: it counted words split on spaces and included the first-token time in the rate; a word is not a token and TTFT is not decode time, so use the benchmark client.
- **Level 4:** At 16 requests per second the client reports a first token you do not believe. How do you check the client itself? Expected: a single-process client adds its own queue at high rates; run two client processes that each send half the rate and compare, and record the CPU use of the client.

## Wrong answers

- "Both are standard clients, so the numbers are comparable." On one server the SGLang client read 3 to 10 percent higher first-token times and 2 to 8 percent lower throughput than the vLLM client; a gap of a few percent can come from the client alone.
- "Temperature does not change speed." Temperature 0.7 raised the median time per token 10 to 13 percent at one user and 3 to 6 percent at 16 and 64 users over temperature 0.
- "Set the input length to 512 and the prompts are 512 tokens." With the default range ratio of 0.0 the average prompt is about 256 tokens; pass 1.0 or state the distribution.
- "A load tester that handles HTTP handles model traffic." A generic tool sends one prompt in a loop, which hits the prefix cache almost every time, and it does not read the token gaps of a stream; use a client that samples prompt lengths and counts tokens.

## Taught in

[Benchmark your server in 15 minutes](../../../manuals/vllm-101/sections/5-1-benchmark-your-server-in-15-minutes.md) and [the SGLang benchmark section](../../../manuals/sglang-101/sections/5-1-sglang-benchmark-serving.md) compare the clients, and [the load testing lesson](../../../phases/17-infrastructure-and-production/22-load-testing-llm-apis/docs/en.md) names the two client traps.
