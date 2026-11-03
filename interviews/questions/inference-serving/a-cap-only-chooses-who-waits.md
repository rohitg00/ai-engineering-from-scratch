---
id: a-cap-only-chooses-who-waits
title: An admission cap decides who waits
card: inference-serving
kind: tradeoff
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [design-review, system-design]
tags: [admission, max-num-seqs, p99-itl, ttft, retraction]
minutes: 10
lessons: []
manuals: [vllm-101#s-tune-chat-for-many-users, sglang-101#s-admission-and-retraction]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

At 32 concurrent users your L4 chat service streams badly: the P99 inter-token gap is 613 ms, and your target is 100 ms or less per token with a first token within 1 second. A teammate proposes `--max-num-seqs 16` so that each step holds fewer requests. What do you expect, and what does the measurement say?

## Short answer

A cap does not make room for more users; it only chooses who waits. With the cap at 16 and 32 users, each stream got a little smoother, a median ITL of 69.8 against 80.5 ms and a P99 ITL of 595 against 613, but half the users waited in the queue, the median first token went from 1.8 to 12.3 s, and output fell 38 percent to 171.8 tokens per second. At 64 users no cap that the manual tried brought the P99 ITL under 1.1 s, so the fix on this card is fewer users per replica, not a cap.

## Full answer

### Where the stream broke

Qwen/Qwen3-8B on the L4 in the full-clock session, 512 prompt tokens and 128 output tokens, three seeds:

| Users | Output tok/s | Median TTFT | P99 ITL | Met the target | Median SM clock |
|---|---|---|---|---|---|
| 8 | 112.8 | 0.25 s | 67 ms | 75% | 1,485 MHz |
| 16 | 201.3 | 0.29 s | 85 ms | 64% | 1,455 MHz |
| 32 | 275.1 | 1.80 s | 613 ms | 0% | 1,275 MHz |
| 64 | 242.3 | 11.18 s | 1,233 ms | 0% | 1,005 MHz |

This sweep did not reset the prefix cache, so the rows below 32 users read too well; with a reset the share that met the target at 16 users fell to 25 percent and the P99 ITL there was 522 ms. Each step on this GPU has a budget of 2,048 tokens, and new prompt chunks share the step with the running streams, so the streams pause.

### The cap at 32 users

| Config | Output tok/s | Median TTFT | Median ITL | P99 ITL | Median SM clock |
|---|---|---|---|---|---|
| default, 256 | 275.1 | 1.8 s | 80.5 ms | 613 ms | 1,275 MHz |
| `--max-num-seqs 16` | 171.8 | 12.3 s | 69.8 ms | 595 ms | 1,365 MHz |

The cap run had the higher clock, so the clock does not explain the loss. The stream got a little smoother, half the users waited for their first token, and output fell by 38 percent.

### Caps at 64 users

With the clock locked at 900 MHz, two seeds and a reset per run, against SGLang on the same card:

| Config | Median TTFT | P99 ITL | Output tok/s |
|---|---|---|---|
| SGLang default | 19.4 s | 143 to 153 ms | 225 to 231 |
| vLLM default | 11.8 s | 1,359 ms | 220 |
| `--max-num-seqs 32` | 17.2 to 20.6 s | 1,163 to 1,399 ms | 196 to 230 |
| `--max-num-active-seqs 48` | 11.8 s | 1,329 to 1,373 ms | 215 to 218 |
| `--max-num-active-seqs 16` | 44.8 to 48.8 s | 1,133 to 1,139 ms | 129 to 136 |

No cap brought the vLLM P99 ITL near the SGLang value. At 16 or 32 running requests the P99 ITL stayed above 1.1 s and the first token waited 17 to 65 s. On this card a cap does not fix the long gaps at 64 users. Fewer users per replica does.

### The small pool is the other queue

A pool of 6,560 tokens against 24,096 at 32 users gave a median time to first token of 31.6 s against 3.1 s and a P99 first token of 48.0 against 7.1 s. A request of 640 tokens needs 640 tokens of pool by its end, so about 10 requests fit in the small pool and the other 22 waited for a running request to finish. The small-pool run also fell to 248 MHz, but a clock 3.6 times lower cannot explain a first token 10 times later; the queue did.

### How SGLang admits, and why a queue is the honest failure

SGLang admits a request only when a forecast fits the pool. A new request must fit its uncached prompt tokens plus its remaining `max_new_tokens`, clipped to 4,096. Each running request holds back its remaining `max_new_tokens` times a ratio that starts at 0.7 and falls to 0.098 over 600 decode steps, because most requests stop early. When the forecast is too bold, the scheduler retracts running requests to the queue and they prefill again. In a small pool of 4,096 tokens with 16 users asking for 512 tokens each, exactly five requests ran at a time: each token took 24 ms once a request started, and the median user waited 27.9 s for the first token. Every request succeeded. A long queue with fast tokens is admission control doing its job; a retraction is the alarm, and more than about one per minute is a configuration bug. Set realistic `max_new_tokens` in clients: a client that asks for 4,096 tokens and uses 200 makes the reservation of every new request about 20 times too big.

### What to do

1. Set the targets for the first token and the time per token.
2. Sweep users with a reset per run, and find the last count that meets both.
3. If the cache usage is near full and requests wait, the pool is too small: add room with an FP8 cache or FP8 weights.
4. If the pool has room and the P99 ITL is too high, the GPU is full: add a GPU or a replica, and enforce the knee in the client or the gateway.
5. Read the P99 ITL when you pick an engine for chat. On the GB10 the two engines gave the same output at 32 and 64 users, and the vLLM P99 ITL was 478 against 220 ms at 32 users.

## Follow-ups

- **Level 3:** The cap run had a higher clock than the default run. Why does that matter for the conclusion? Expected: a higher clock should help the cap run, so the clock does not explain its 38 percent lower output; the loss belongs to the cap.
- **Level 3:** How does SGLang decide to admit a request, and what happens when its forecast is wrong? Expected: a new request must fit its uncached prompt plus its remaining max_new_tokens, and running requests hold back their remaining output times a ratio that starts at 0.7 and falls to 0.098 over 600 decode steps; when the forecast is too bold the scheduler retracts running requests to the queue and they prefill again.
- **Level 4:** The pool has room, the tail gap is still over target, and a cap only moves the wait. What is left? Expected: the GPU is full; add a GPU or a replica and put fewer users on each, enforce the knee in the client or the gateway, and read the P99 ITL when you pick an engine, because at the same output the two engines differed about twofold on the GB10.

## Wrong answers

- "A cap on running requests makes room for more users." It only chooses who waits; at 32 users the cap of 16 moved the wait into the queue, with the first token at 12.3 s, and cost 38 percent of the output.
- "Lower the maximum model length to help the queue." The pool stays the same size, so it does not help when the cache usage is near full; add room with an FP8 cache or FP8 weights.
- "Clients should ask for a large max_new_tokens to be safe." The admission forecast reserves it; a client that asks for 4,096 tokens and uses 200 makes the reservation of every new request about 20 times too big, so fewer requests are admitted.
- "A queue means the server is broken." A long queue with fast tokens is admission control doing its job; the five admitted requests in the small-pool run got 24 ms per token while the median user waited 27.9 s, and a retraction, not a queue, is the alarm.

## Taught in

[Tune chat for many users](../../../manuals/vllm-101/sections/3-1-tune-chat-for-many-users.md) measures the caps and the small pool, and [Admission and retraction](../../../manuals/sglang-101/sections/2-3-admission-and-retraction.md) explains the forecast.
