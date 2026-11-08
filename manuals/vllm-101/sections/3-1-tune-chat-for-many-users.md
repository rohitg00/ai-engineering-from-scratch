# Tune chat for many users

> For chat, the worst gap between tokens matters more than throughput, so watch P99 ITL as users grow.

Your chat service streams smoothly for a few users and has long gaps between tokens for many. When you finish this section, you can keep the stream steady as the number of users grows.

**Our result:** on our L4, about two in three requests met our latency target at 16 users, and none at 32. Capping the batch did not fix it.

## Know what a chat user feels

A chat user feels two numbers. The first is the time to the first token (TTFT). The second is the gap between tokens while the answer streams (ITL). Throughput is what you pay for, but users do not see it.

Watch the P99 ITL, the worst gap in 100. One long pause in a stream feels worse than a slightly slower stream. Set a target for both numbers. Our target was a first token within 1 second and 100 ms or less per token.

## See where the stream breaks

**We measured** users at once from 1 to 64 on our L4 with `Qwen/Qwen3-8B` on 2026-10-21, in [the full-clock session](#l4-sessions). Each request sent 512 prompt tokens and asked for 128 tokens, with three seeds per point.

| Users, L4 full-clock session | Output tok/s | Median TTFT | P99 ITL | Share of requests that met the target | Median SM clock |
|---|---|---|---|---|---|
| 8 | 112.8 | 0.25 s | 67 ms | 75% | 1,485 MHz |
| 16 | 201.3 | 0.29 s | 85 ms | 64% | 1,455 MHz |
| 32 | 275.1 | 1.80 s | 613 ms | 0% | 1,275 MHz |
| 64 | 242.3 | 11.18 s | 1,233 ms | 0% | 1,005 MHz |

Up to 16 users, each new user added output, and the stream stayed steady. But at 16 users, one request in three already got its first token too late. At 32 users, the output still rose, but the P99 ITL grew seven times and no request met the target. The server was busy, and the users waited.

### Treat results below 32 users as affected by prefix-cache reuse

This sweep kept one server for all the user counts, and it did not reset the prefix cache between them. Each seed sent the same first prompts at every count, so many requests found their prompt in the cache and skipped the prefill. On 2026-10-23 we ran the sweep again on the same L4, with a reset before each run and the clock locked at 900 MHz. We compared it with an unflushed run of that same session:

```listing
title: median TTFT with and without a cache flush, Qwen3-8B on our L4 at 900 MHz
source: capture/gpu/out-l4/load-flushed-vs-unflushed.txt
lang: text
note: The median TTFT rows. The share that met the target and the P99 ITL lines are cut.
---
median TTFT, flushed against unflushed
users   vLLM                                   SGLang
4       650 / 145 ms (4.5x)                    532 to 645 / 141 ms (3.8 to 4.6x)
8       951 to 978 / 264 to 274 ms (3.6x)      1,174 to 1,273 / 173 to 178 ms (6.6 to 7.3x)
16      1,550 to 1,587 / 294 to 295 ms (5.3x)  1,804 to 1,944 / 218 ms (8.3 to 8.9x)
32      1,982 to 2,084 / 2,012 to 3,091 ms     3,216 to 3,228 / 2,710 to 2,917 ms
…
```

With the reset, 50 percent of the requests met our target at 8 users, against 75 to 81 percent without it. At 16 users the share fell from about 65 percent to 25 percent. The P99 ITL at 16 users was 522 ms with the reset, against 82 to 84 ms in the unflushed run of the same session. From 32 users the queue dominated, and the reset changed little. So the stream breaks between 8 and 16 users on this card, not between 16 and 32. The table above stays as a record of the full-clock session.

Each step has a budget of 2,048 tokens on this GPU. When new prompts arrive, their chunks share the step with the running streams, so the running streams pause. [The token budget page](#s-why-one-token-budget-replaces-a-prefill-phase) explains the order.

## Know what a cap on sequences does

`--max-num-seqs` sets how many requests run at once. On the L4 the default is 256, and [the token budget page](#s-keep-long-prompts-from-stalling-short-ones) gives the rule for other GPUs. We set it to 16 and ran the same sweep:

```figure
id: fig-3-1
kind: chart
title: a cap of 16 sequences as users grow
claim: A cap of 16 sequences matched the default up to 16 users, and at 32 users it cut output from 275 to 172 tokens per second.
caption: Each point is the median of three seeds, and the bands span them. The time to the first token uses a log scale. From capture/gpu/summary/l4.json.
```

| Users, L4 full-clock session | Config | Output tok/s | Median TTFT | Median ITL | P99 ITL | Median SM clock |
|---|---|---|---|---|---|---|
| 32 | default | 275.1 | 1.8 s | 80.5 ms | 613 ms | 1,275 MHz |
| 32 | `--max-num-seqs 16` | 171.8 | 12.3 s | 69.8 ms | 595 ms | 1,365 MHz |

The cap made each stream a little smoother. But half the users waited in the queue for their first token, and output fell by 38 percent. The cap run had the higher clock, so the clock does not explain the loss. At 64 users, the cap run fell to 630 MHz, so we do not compare that row.

A cap does not make room for more users. It only chooses who waits.

### Try a cap at 64 users

At 64 users, the P99 ITL of vLLM on our L4 was more than a second, against about 150 ms for SGLang. On 2026-10-23 we tried to close that gap with a cap. The clock was locked at 900 MHz, and each run had two seeds and a cache reset. `--max-num-active-seqs` is a second cap at 0.31.0, on the requests that run in one step.

```listing
title: caps at 64 users on our L4, vLLM 0.31.0 against SGLang 0.5.22
source: capture/gpu/out-l4/admission-cap-64-users.txt
lang: text
note: Rows from the evidence file. The rows that ran far below the lock are cut.
---
config                        median SM clock (s1/s2)   median TTFT       P99 ITL               output tok/s
SGLang default                900 / 900                 19.4 s            143 to 153 ms         225 to 231
…
vLLM default, earlier run     900                       11.8 s            1,359 ms              220
…
--max-num-seqs 32             900 / 795                 17.2 to 20.6 s    1,163 to 1,399 ms     196 to 230
…
--max-num-active-seqs 48      900 / 900                 11.8 s            1,329 to 1,373 ms     215 to 218
…
--max-num-active-seqs 16      795 / 683                 44.8 to 48.8 s    1,133 to 1,139 ms     129 to 136
```

No cap that we tried brought the P99 ITL of vLLM near the SGLang value. At 16 or 32 running requests, the P99 ITL stayed above 1.1 s, and the first token waited 17 to 65 s. Many runs in this block ran below the lock, and the file lists them all. So on this card, a cap does not fix the long gaps at 64 users. Fewer users per replica does.

## See what a small pool does

The KV pool limits the users too. **We measured** a pool of 6,560 tokens, with `--num-gpu-blocks-override 410` and `--max-model-len 4096`, against our pool of 24,096 tokens. Both ran on our L4 on 2026-10-22 in [the session locked at 900 MHz](#l4-sessions), at 32 users and two seeds each.

| Pool, L4 locked session | Median TTFT | P99 TTFT | Median SM clock |
|---|---|---|---|
| 24,096 tokens | 3.1 s | 7.1 s | 881 MHz |
| 6,560 tokens | 31.6 s | 48.0 s | 248 MHz |

A request of 640 tokens needs 640 tokens of pool by its end. So only about 10 requests fit in 6,560 tokens at once. The other 22 waited for a running request to finish.

vLLM starts a new request only when its blocks fit in the pool. A running request that needs a new block can push another one out, which vLLM counts as a preemption. So most of the 32 requests waited in the queue before they started.

The small-pool run fell to about 250 MHz, below the lock. A clock 3.6 times lower can make a step up to 3.6 times slower. The first token came 10 times later, so the queue caused most of the wait. Do not compare the throughput or the time per token of these two runs.

## Tune it

1. Set your targets for the first token and the time per token.
2. Run your own load at more and more users, and find the last count that meets both.
3. If the KV cache usage is near 100 percent and requests wait, the pool is too small. Add room with [an FP8 KV cache](#s-fit-more-users-with-an-fp8-kv-cache), or [FP8 weights](#s-fit-a-bigger-model-with-fp8-weights). A shorter maximum length does not help here, because the pool stays the same size.
4. If the pool has room but the P99 ITL is too high, the GPU is full. Add a GPU or a replica. A cap on sequences moves the wait to the first token.

On our DGX Spark, vLLM and SGLang gave the same output at 32 and 64 users. But the P99 ITL of vLLM was about twice as high, 478 against 220 ms at 32 users. So also compare the P99 ITL when you choose an engine for chat.

```takeaways
- Watch the P99 ITL and the first token, not only throughput, for chat.
- On our L4, the stream broke between 16 and 32 users, while the output still rose.
- A cap on sequences moves the wait to the first token and costs output.
- A small KV pool makes requests queue, so the first token comes late.
```

Sources: capture/gpu/summary/l4.json (load.vllm-b, load.vllm-seqs-16, load.vllm-lock-b, load.vllm-lock-small-pool), capture/gpu/summary/gb10.json (load.vllm, load.sglang), the vLLM source at v0.31.0 (vllm/engine/arg_utils.py, vllm/v1/core/sched/scheduler.py, vllm/v1/metrics/loggers.py), capture/gpu/out-l4/load-flushed-vs-unflushed.txt, capture/gpu/out-l4/admission-cap-64-users.txt.
