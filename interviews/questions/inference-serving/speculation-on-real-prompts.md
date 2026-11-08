---
id: speculation-on-real-prompts
title: Speculation won the benchmark and lost in production
card: inference-serving
kind: debug
level: 3
roles: [inference-engineer]
rounds: [debugging, ml-depth]
tags: [speculative-decoding, eagle3, kv-pool, max-running-requests, datasets]
minutes: 10
lessons: []
manuals: [sglang-101#s-speculative-decoding]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

A teammate benchmarked EAGLE-3 on Qwen/Qwen3-8B on one L4 with the random dataset and saw the time per token fall by half at 8 users. In production, with 32 concurrent chat users, the output throughput did not rise and the first token came later. The acceptance length in the log looks fine. What happened?

## Short answer

Two things, and the acceptance length hides both. On a 24 GB card the draft weights took pool space: the KV pool fell from 24,094 to 9,951 tokens, about 15 of the 640-token requests, so at 32 users most requests waited for a slot and the median first token went from 2,970 to 8,040 ms. The dataset also matters: at 32 users EAGLE-3 gave 1.6 times the output on GSM8K and code prompts and no more output on the random set or on ShareGPT, because the draft only pays when the GPU has idle time to spend on guesses.

## Full answer

### The L4 sweep

The default server against the EAGLE-3 server with the `Tengyunw/qwen3_8b_eagle3` draft, three seeds per point, 512 tokens in and 128 out:

| Concurrency | Default median TPOT | EAGLE-3 median TPOT | Default output tok/s | EAGLE-3 output tok/s |
|---|---|---|---|---|
| 1 | 60.16 ms | 25.61 ms | 13.42 | 31.81 |
| 8 | 66.01 ms | 35.58 ms | 112.62 | 181.55 |
| 32 | 96.18 ms | 43.82 ms | 270.11 | 269.42 |
| 64 | 107.42 ms | 51.50 ms | 250.85 | 245.34 |

The acceptance length was 2.73 to 2.74 tokens per step at every concurrency. Each token came out 1.6 to 2.3 times faster at every load. From concurrency 32 the server delivered no more tokens per second than the default.

### The pool explains the first half

The startup log of the EAGLE-3 server shows the price of a draft on a small card. The target alone had a pool of 24,094 tokens. With the draft loaded, the pool held 9,951 tokens, about 15 requests of 640 tokens, and the draft took nearly 60 percent of the pool. With 15 requests in the pool, the rest waited for a slot. At concurrency 32 the median first token was 8,040 ms with EAGLE-3 and 2,970 ms without it.

The same log line shows `max_running_requests=48`. The speculative handlers set that cap when you do not set it, with one warning that scrolls away before the first request. On the GB10, where the pool had room, the cap was the limit instead: at 64 users throughput was still higher with speculation, 276.32 against 235.38 tokens per second, but the median first token was 7,772 ms against 557 ms, because 16 requests waited behind the 48.

### The dataset explains the second half

The random dataset at this version takes the first turn of ShareGPT conversations and cuts or repeats it to 512 tokens, with the end token ignored. The manual then ran the same L4 sweep on four datasets with the clock locked at 900 MHz and a flush before each run:

| Dataset | Median TPOT at 8 users, default / EAGLE-3 / NGRAM | Output tok/s at 32 users, default / EAGLE-3 / NGRAM |
|---|---|---|
| random | 67.6 to 68.2 / 33.8 to 39.4 / 68.2 to 71.4 ms | 250 to 254 / 239 to 242 / 236 to 250 |
| ShareGPT | 66.4 to 68.6 / 39.5 to 43.1 / 69.5 to 72.4 ms | 281 to 288 / 277 to 283 / 245 to 256 |
| GSM8K | 65.5 / 33.3 to 34.3 / 54.6 to 55.0 ms | 397 / 648 to 660 / 433 to 435 |
| code | 65.9 to 66.4 / 36.8 / 58.2 to 58.8 ms | 365 to 366 / 566 to 581 / 377 to 386 |

EAGLE-3 cut the time per token about in half at 8 users on every dataset, with an acceptance length of 2.35 to 2.78. At 32 users it gave 1.6 times the output on GSM8K and code. On the random set and ShareGPT it gave no more output, and its first token came 2 to 3 times later, because the draft took pool space that the queue needed. NGRAM helped only on GSM8K and code, by about 1.1 to 1.2 times at 8 users, and on the other two sets it was slower, with a P99 ITL of 244 to 779 ms.

### The card and the model decide

The same feature on the GB10 with the mixture-of-experts Qwen3-30B-A3B held its gain at every load, 1.56 to 1.89 times shorter time per token, and still gave 1.17 times the throughput at 64 users. The manual's reading: a dense model reads all its weights per step, so a larger batch already uses the spare compute, while the expert model reads only the experts that the step's tokens chose and the verify pass scores four positions with weights it already read. That is one model and one GPU.

Other teams found the same limits. A benchmark study found that synthetic prompts overstated speculative throughput by 23 percent on average, that the best draft length fell to 1 as the batch grew, and that random token ids left 20 to 30 percent of the experts idle in some layers. A 2025 study of serving benchmarks saw the median TPOT 1.3 times lower and the P99 TPOT 1.16 times higher with speculation, and a later first token because the draft runs its own prefill.

### What to do

1. Read the `KV Cache is allocated` line of the speculative server and compare it with the plain server.
2. Set `--max-running-requests` yourself, from the concurrency where your sweep shows speculation still wins.
3. Benchmark with your own prompts and real output lengths, with `--disable-ignore-eos`, and read `accept len` on them.
4. Compare the P99 ITL and the P99 TTFT, not only the median.
5. Turn speculation on for interactive traffic with a few users per replica; leave it off for batch jobs and for high concurrency on a card where the pool is the limit.

## Follow-ups

- **Level 3:** The log showed 2.73 accepted tokens per step whatever the load. Why did that not predict the throughput? Expected: acceptance measures how well the draft guesses, not whether the GPU has idle time for the guesses or whether the pool has room; the draft took pool space, the queue grew, so each token was faster and the server was not.
- **Level 3:** Which startup lines should the teammate have read? Expected: the allocated KV cache line, 9,951 tokens against 24,094 without the draft, and the running-request cap of 48 that speculation sets when you do not.
- **Level 4:** On the GB10 with Qwen3-30B-A3B the gain held at 64 users. Why would an expert model behave differently? Expected: a dense model reads all its weights per step and a larger batch already uses the spare compute; the expert model reads only the experts that the step's tokens chose, and the verify pass scores four positions with weights it already read, so the gain held at 1.56 times or more; the manual calls this a reading from one model and one GPU.

## Wrong answers

- "The acceptance length is fine, so speculation is working." It measures the draft's guesses, not the server; on the L4 each token came 1.6 to 2.3 times faster at every load and the server delivered no more tokens per second from 32 users.
- "Random prompts are real text, so the benchmark is realistic." The random set cuts or repeats the first turn of ShareGPT conversations to 512 tokens with the end token ignored; on GSM8K and code prompts speculation gave 1.6 times the output at 32 users, and on ShareGPT it gave none.
- "Raise --max-running-requests to let more users in." On the L4 the pool held about 15 requests, so a higher cap changes nothing; the pool was the limit, and the draft took nearly 60 percent of it.
- "Use NGRAM instead, it needs no draft weights." It helped only on GSM8K and code, by about 1.1 to 1.2 times at 8 users, and on the other two sets it was slower with a P99 ITL of 244 to 779 ms.

## Taught in

[The SGLang speculative decoding section](../../../manuals/sglang-101/sections/4-4-speculative-decoding.md) has the L4 and GB10 sweeps and the four-dataset test.
