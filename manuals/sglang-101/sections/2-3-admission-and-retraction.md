# Admission and retraction

> SGLang admits a request only when a forecast of its future tokens fits the KV pool, so a full server queues new users instead of breaking the running ones.

Your dashboard says the GPU has free memory, yet new requests wait 28 seconds for their first token. Nothing crashed, nothing was dropped, and the per-token speed is fine. Users still feel that the service is down. This is what admission control looks like when it does its job, and you need to know why it chose to make them wait.

When you finish this section, you can explain the token budget that decides admission and compute how many requests fit in a pool. You can also tell a healthy queue from a retraction problem in the log.

## The cost: memory you will need later

A request needs KV cache for its prompt now, and for every token it generates later. The scheduler does not know how many tokens a request will generate. It knows only `max_new_tokens`, the upper limit.

There are two obvious fixes, and both fail. Reserve the full `max_new_tokens` for everyone, and most of the pool sits empty, because most requests stop early at an end-of-sequence token. Reserve nothing, and the pool fills during decode, and the server must throw away work.

## The forecast

SGLang uses a forecast with a correction. Two rules decide admission {{code}}:

- **A new request** must fit its uncached prompt tokens plus its remaining `max_new_tokens`, clipped to 4,096 by `SGLANG_CLIP_MAX_NEW_TOKENS_ESTIMATION`.
- **Each running request** holds back its remaining `max_new_tokens` times the **new token ratio**.

**New token ratio:** the share of remaining output that the scheduler expects a running request to use. It starts at 0.7 times `--schedule-conservativeness` (1.0 by default). It falls linearly to 0.14 of its start value, which is 0.098 at defaults, over 600 decode steps {{code}}.

The ratio falls because most requests stop early. The scheduler grows bolder the longer things go well. A request with `ignore_eos` set cannot stop early, so its ratio is always 1.0.

```figure
id: fig-2-3
kind: comparison
title: why five requests fit in 4,096 tokens and six do not
claim: With ignore_eos, each request reserves its 256 prompt tokens and all 512 output tokens, so five requests use 3,840 tokens and a sixth would need 4,608.
caption: Each bar is the KV pool of --max-total-tokens 4096. Green is reserved prompt KV, amber is reserved future output, grey is free. From capture/out/server-small-pool.log and small-pool-bench-long-output-c16.txt.
```

## What we measured with a small pool

We started a server with `--max-total-tokens 4096`, a pool far smaller than our Mac allows. Then we ran the benchmark at concurrency 16 with 256-token prompts and 512-token outputs.

The benchmark client sets `ignore_eos` to true by default, so every request generates exactly 512 tokens {{code}}. Each request therefore reserves 256 plus 512, which is 768 tokens. Five requests reserve 3,840 tokens, and a sixth would need 4,608. The scheduler admitted exactly five.

```listing
title: five running, eleven waiting
source: capture/out/server-small-pool.log
lang: text
note: Lines cut from the first minute of the run. The first line is the cached warm-up prompt.
---
[2026-10-16 14:08:02] Prefill batch, #new-seq: 1, #new-token: 1, #cached-token: 255, token usage: 0.06, #running-req: 0, #queue-req: 15, #pending-token: 0, cuda graph: False, input throughput (token/s): 0.80
[2026-10-16 14:08:02] Prefill batch, #new-seq: 4, #new-token: 896, #cached-token: 0, token usage: 0.28, #running-req: 1, #queue-req: 11, #pending-token: 2808, cuda graph: False, input throughput (token/s): 3889.60
…
[2026-10-16 14:08:14] Decode batch, #running-req: 5, #token: 1517, token usage: 0.37, cuda graph: False, gen throughput (token/s): 170.33, #queue-req: 11
[2026-10-16 14:08:17] Decode batch, #running-req: 5, #token: 2117, token usage: 0.52, cuda graph: False, gen throughput (token/s): 205.04, #queue-req: 11
…
[2026-10-16 14:08:26] Decode batch, #running-req: 5, #token: 3717, token usage: 0.91, cuda graph: False, gen throughput (token/s): 139.02, #queue-req: 11
```

Watch `token usage`. It climbs from 0.28 to 0.91 as the five requests generate into the space that the forecast reserved for them. Eleven requests wait the whole time. When the five finish, the next five start, and the log repeats in waves.

The client saw the cost of this order:

```listing
title: what the users felt
source: capture/out/small-pool-bench-long-output-c16.txt
lang: text
note: Lines cut from the summary block.
---
Successful requests:                     32        
…
Concurrency:                             13.06     
…
Median TTFT (ms):                        27943.11  
…
Mean TPOT (ms):                          24.26     
```

Every request succeeded. Once a request started, each token took 24 ms. The median user still waited 27.9 seconds for the first token. The `Concurrency` value of 13.06 is the client's average number of open requests. Only five of them were on the GPU at any time.

## Retraction: when the forecast is wrong

The forecast can be too bold, because the ratio decays to 0.098. Requests that run long then need more slots than the pool has. Before each decode step, the scheduler checks that every running request can get one more slot {{code}}.

**Retraction:** removing running requests from the decode batch to free their KV slots, and putting them back in the waiting queue. They prefill again later.

When the check fails, SGLang logs `KV cache pool is full. Retract requests.`. It retracts the requests with the fewest output tokens first, and among those the longest prompts first, because they lost the least work {{code}}. It resets the ratio to a new estimate: tokens decoded so far plus 20 per request, divided by the total `max_new_tokens`. At v0.5.22, if even the last request cannot fit, it aborts that request with "Out of memory even after retracting all other requests" instead of looping.

Our small-pool run had no retractions at all. Its server log has no `Retract requests` line. The metrics endpoint agrees, with one limit. `num_retracted_reqs` is a gauge that the scheduler resets after each log interval. So a reading of 0 covers only the last interval. The counter `num_retracted_requests_total` covers the whole run.

```listing
title: zero retractions in the small-pool run
source: capture/out/small-pool-metrics.txt
lang: text
---
sglang:num_retracted_reqs{engine_type="unified",model_name="mlx-community/Qwen3-0.6B-4bit",moe_ep_rank="0",pid="38678",pp_rank="0",tp_rank="0"} 0.0
```

The forecast had nothing to correct. With `ignore_eos`, the reservation was exact. Real traffic stops early, so the ratio decays and admission becomes bolder, and retraction becomes possible.

```figure
id: fig-2-3b
kind: timeline
title: the new token ratio over 600 decode steps
claim: The ratio starts at 0.7, falls to 0.098 after 600 decode steps, and jumps back up after a retraction, so admission grows bolder until it fails.
caption: Read left to right over decode steps. The amber line is the default ratio for requests without ignore_eos. The rose mark is a retraction. Constants from new_token_ratio_tracker.py at v0.5.22.
```

## Incidents: when retraction is the problem

A server running DeepSeek-R1 on eight H20 GPUs logged `KV cache pool is full. Retract requests.` on every rank, again and again, and then stopped answering health checks {{issue #8463}}. A commenter traced it to retraction that could not free enough memory and repeated forever. The issue closed without a fix. At v0.5.22 the scheduler aborts the last request when it is still out of memory after it retracts all the others. That abort is meant to end the loop. We did not reproduce the issue.

Another user saw decode throughput fall from about 429 to between 20 and 38 tokens per second after a retraction, and stay there {{issue #26248}}. That issue closed for inactivity with no recorded cause. The lesson stands: a retraction in the log is a performance alarm.

## Our position

Queueing is the honest failure. A queue keeps every running request fast and makes the overload visible in `#queue-req` and in time to first token. Retraction hides overload as wasted prefill.

The SGLang tuning docs say an occasional retraction, about one per minute, is fine. Treat more than that as a configuration bug. Raise `--schedule-conservativeness`, for example to 1.3, so the forecast starts higher. Or lower `--max-running-requests`. Do not fix it with a larger `--mem-fraction-static` alone, because [section 3.2](#s-mem-fraction-static-and-startup-sizing) shows what that costs.

Set realistic `max_new_tokens` in your clients. A client that asks for 4,096 tokens and uses 200 makes the output reservation of every new request about 20 times too big.

```takeaways
- Compute admission as uncached prompt plus max_new_tokens, against the free pool.
- Read a long queue with fast tokens as admission control, not as a fault.
- Alert when the rate of num_retracted_requests_total is above about one per minute.
- Raise schedule-conservativeness before you add memory to stop retractions.
- Send realistic max_new_tokens from clients so admission sizes requests correctly.
```

Sources: python/sglang/srt/managers/schedule_policy.py (PrefillAdder.add_one_req, _get_running_request_total_token_offset, CLIP_MAX_NEW_TOKENS), python/sglang/srt/managers/scheduler_components/new_token_ratio_tracker.py, python/sglang/srt/managers/schedule_batch.py (check_decode_mem, retract_decode, _get_decode_retraction_order), python/sglang/srt/managers/scheduler.py (update_running_batch), python/sglang/srt/environ.py, python/sglang/benchmark/serving.py (ignore_eos default) at v0.5.22; docs/docs/advanced_features/hyperparameter_tuning.mdx at v0.5.22; capture/out/server-small-pool.command.txt, server-small-pool.log, small-pool-bench-long-output-c16.txt, small-pool-metrics.txt; issues https://github.com/sgl-project/sglang/issues/8463 and https://github.com/sgl-project/sglang/issues/26248.
