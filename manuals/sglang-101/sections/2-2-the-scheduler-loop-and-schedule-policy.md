# The scheduler loop and --schedule-policy

> The scheduler answers one question every few milliseconds, which tokens the GPU computes next, and at v0.5.22 its default answer is first come, first served.

Eight users send prompts in the same second. One of them pasted a 4,000-token document, and the others typed a sentence each. Should the long prompt go first, or the short ones? Should the request that shares a system prompt with yesterday's traffic jump the queue? Somebody has to decide, on every step, and in SGLang that somebody is the scheduler loop.

When you finish this section, you can read the scheduler's `Prefill batch` and `Decode batch` log lines. You can name the policy that orders the waiting queue and decide whether to change it.

## The cost of a bad order

For a dense model on a memory-bound GPU, a decode step costs about the same whether it computes tokens for 1 request or for 8. On our L4 with Qwen3-8B, one step took 60 ms for 1 user and 66 ms for 8. A mixture-of-experts model is different. On our GB10 the step grew from 33 ms to 102 ms, and a bigger batch can read more experts.

So the scheduler wants big batches. A user who waits in the queue sees nothing at all. So the scheduler also wants short queues. Every policy is a trade between those two costs.

The obvious fix is a smart order, for example the request with the most cached prefix first. The SGLang paper proposed exactly that, longest prefix match, and proved it optimal for an offline batch {{paper}}. Online traffic is not an offline batch, and the smart order costs CPU time on every step.

## One turn of the loop

**Scheduler loop:** the function that runs forever in the scheduler process. Each turn takes new requests, picks the next batch, runs it on the GPU, and processes the results.

One turn does four things in order {{code}}:

1. **Ingest.** Drain new requests from the ZMQ socket and add them to the waiting queue.
2. **Pick.** If the last batch was a prefill, merge it into the running decode batch. Then try to build a new prefill batch from the waiting queue. If one exists, run it. If not, run one decode step for every running request.
3. **Run.** Build a `ForwardBatch` from the `ScheduleBatch` and run the model.
4. **Process.** Append the sampled tokens, check stop conditions, free or cache the KV of finished requests, and send results to the detokenizer.

A request rides one prefill batch, possibly over several chunks, and then joins the long-lived decode batch until it stops. Prefill wins when the scheduler can admit something. That rule keeps time to first token low, and [section 2.3](#s-admission-and-retraction) shows the budget check that decides "can admit".

```figure
id: fig-2-2
kind: flow
title: one turn of the scheduler loop
claim: Each turn ingests requests, orders the queue by policy, admits what fits the budget, and runs either one prefill batch or one decode step.
caption: Read top to bottom. Amber boxes are scheduler phases, the green box is the KV budget check, the plum boxes are GPU work. Function names are from the scheduler at v0.5.22.
```

## The two log lines

The scheduler prints one line per prefill batch and one decode line every 40 decode steps, the default of `--decode-log-interval` {{code}}. These lines are the most useful text the server writes. Here are three consecutive lines from our benchmark at concurrency 8.

```listing
title: eight requests, two prefill batches, one decode batch
source: capture/out/server-default.log
lang: text
note: Three consecutive lines from the concurrency 8 benchmark.
---
[2026-10-16 13:59:07] Prefill batch, #new-seq: 1, #new-token: 511, #cached-token: 1, token usage: 0.00, #running-req: 0, #queue-req: 7, #pending-token: 0, cuda graph: False, input throughput (token/s): 155.03
[2026-10-16 13:59:09] Prefill batch, #new-seq: 7, #new-token: 3553, #cached-token: 2, token usage: 0.02, #running-req: 1, #queue-req: 0, #pending-token: 0, cuda graph: False, input throughput (token/s): 1914.13
[2026-10-16 13:59:09] Decode batch, #running-req: 8, #token: 4075, token usage: 0.02, cuda graph: False, gen throughput (token/s): 98.37, #queue-req: 0
```

Read the fields:

- `#new-seq` is how many requests this prefill admits. `#new-token` is how many prompt tokens it computes, and `#cached-token` is how many it reused from the radix cache.
- `token usage` is the share of the KV pool in use. Our pool is large, so usage stays near zero here.
- `#running-req` counts requests that are decoding. `#queue-req` counts requests that are waiting.
- `cuda graph: False` is expected on a Mac. On CUDA, `True` means the decode step replayed a captured graph, and [section 4.1](#s-forwardmode-and-cuda-graphs) explains why that matters.

The first line admits one request while seven wait. The next prefill admits the other seven together, 3,553 new tokens in one step at 1,914 tokens per second. Then all eight decode as one batch. Batching prefill is where the throughput comes from, and the log shows it happen.

## The policies

**Schedule policy:** the rule that orders the waiting queue before admission. Set it with `--schedule-policy`.

The default at v0.5.22 is `fcfs` {{code}}. The choices split into two groups.

| Group | Policies | What they use |
|---|---|---|
| Cache-aware | `lpm`, `dfs-weight`, `hrrn`, `shortest-prefill-first` | the radix tree: how much of each prompt is already cached |
| Cache-agnostic | `fcfs`, `lof`, `random`, `routing-key` | arrival order, output length, or a routing key |

The parser also accepts `--schedule-policy priority`, but the scheduler has no such order, and the server stops with "Unknown schedule_policy". To order by priority, use `--enable-priority-scheduling` with `fcfs`.

Many readers expect `lpm`, because the paper describes it. It was the default in v0.4.3 and became `fcfs` by v0.4.6. The research for this manual did not find the pull request that changed it.

Two rules in the code limit the cache-aware policies {{code}}:

- When the waiting queue holds more than 128 requests, `lpm` and `hrrn` change to FCFS for that turn. The code comment says why: prefix matching and sorting cost too much when the queue is long.
- When the radix cache is off, `lpm`, `dfs-weight`, and `hrrn` become FCFS. `shortest-prefill-first` refuses to start.

So `lpm` helps only in a narrow band. The queue must be long enough to reorder, short enough to stay under 128, and full of shared prefixes.

## Chunk size under long prompts

**Chunked prefill:** the rule that splits a long prompt into pieces of at most `--chunked-prefill-size` tokens, one piece per prefill batch. The default depends on GPU memory, as the table in [section 4.1](#s-forwardmode-and-cuda-graphs) shows. It is 4,096 on a 22 GB L4 and 8,192 on the GB10.

The common advice is to make the chunk smaller, so that decode steps run more often between pieces of a long prompt. We tested that advice. Each run sent 48 prompts of 1,024 to 4,096 tokens, with 256 tokens of output. Requests arrived at a Poisson rate of 0.5, 1, or 2 per second, with three seeds.

| GPU, model | Chunk | Rate, per second | Output tok/s | Median TTFT | P99 ITL | Median SM clock |
|---|---|---|---|---|---|---|
| GB10, Qwen3-30B-A3B | 8,192, the default | 0.5 | 70.1 | 892 ms | 929 ms | 2,411 MHz |
| GB10, Qwen3-30B-A3B | 1,024 | 0.5 | 68.1 | 1,253 ms | 1,977 ms | 2,398 MHz |
| GB10, Qwen3-30B-A3B | 8,192, the default | 2 | 129.3 | 269 ms | 312 ms | 2,411 MHz |
| GB10, Qwen3-30B-A3B | 1,024 | 2 | 130.1 | 256 ms | 260 ms | 2,411 MHz |
| L4, Qwen3-8B | 4,096, the default | 0.5 | 44.1 | 36.0 s | 2,579 ms | 773 MHz |
| L4, Qwen3-8B | 1,024 | 0.5 | 43.3 | 37.4 s | 2,922 ms | 690 MHz |
| L4, Qwen3-8B | 4,096, the default | 2 | 46.2 | 59.8 s | 2,512 ms | 915 MHz |
| L4, Qwen3-8B | 1,024 | 2 | 44.0 | 62.5 s | 2,930 ms | 825 MHz |

**We measured** no gain from a smaller chunk on either machine. On the GB10 we ran the default, an explicit 8,192, and 1,024. At 1 and 2 requests per second, all three were inside the seed spread of each other. At 0.5 per second, the 1,024 chunk was worse. Its P99 ITL was 1,977 against 929 ms, and the seed ranges did not overlap.

A 2025 study of chunked prefill on MoE models gives a likely reason for that loss. Each chunk of a prompt loads the expert weights again, and in that study the extra loads raised memory traffic by up to 39 percent. Qwen3-30B-A3B is an MoE model. With a chunk of 1,024, a prompt of up to 4,096 tokens runs as up to four chunks. Each chunk reads the experts again. We did not measure the expert traffic, so this is a reading, not a result.

The rates of 1 and 2 per second need a second caution. In each seed, the sweep sent the same 48 prompts at every rate to one server, and it did not flush the cache. The rate of 0.5 ran first. The GB10 pool could hold those prompts, so the later runs could find many of them in the cache. That can explain why the first token at 1 and 2 per second was faster than at 0.5. [Section 5.1](#s-sglang-benchmark-serving) gives the protocol that prevents this.

On the L4, this workload was more than the card could serve at every rate. Output stayed near 44 tokens per second, and the median first token took 36 to 62 seconds. The card throttled, at a median clock of 690 to 915 MHz, and this sweep did not repeat throttled runs. The worst token gap stayed between 2.5 and 2.9 s with either chunk. The 1,024 runs also ran 80 to 90 MHz slower than the default at 0.5 and 2 per second. So the small gap between the two chunks is not a chunk effect.

The scheduler rule from the start of this section fits the L4 result. Prefill wins whenever the scheduler can admit something. With a full queue, a smaller chunk adds more prefill turns ahead of the decode steps, and the stream still waits.

`--enable-mixed-chunk` puts the decode tokens into the prefill batch, so a decode step does not wait for a prefill turn. We ran it on the L4 against a new default run in the same session, at a median clock of 953 to 1,095 MHz.

| Rate, per second | Output tok/s, default / mixed chunk | P99 ITL, default / mixed chunk |
|---|---|---|
| 0.5 | 46.5 / 46.5 | 2,521 / 2,406 ms |
| 1 | 46.6 / 47.5 | 2,491 / 2,289 ms |
| 2 | 47.3 / 47.6 | 2,572 / 2,418 ms |

The mixed chunk lowered the median P99 ITL by 5 to 8 percent, and the seed ranges overlapped at every rate. The worst token gap still took more than 2.2 s. On our L4 with Qwen3-8B, a card that cannot keep up with these prompts, neither flag gave the stream a smooth flow. We expect the fix to be more prefill capacity or fewer long prompts per second, but we did not test it.

The GB10 keeps up with this workload, and there the mixed chunk did help. We ran it with the same sweep on 2026-10-21, against a new default run on the same day. The default server had a pool of 251,910 tokens and the mixed-chunk server 236,751 tokens. Every run had a median clock of 2,405 MHz or more.

```listing
title: the GB10 pool with the mixed chunk
source: capture/gpu/out-gb10/server-mixed-chunk.log
lang: text
note: The pool at startup of the server with --enable-mixed-chunk.
---
[2026-10-21 06:26:47] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 236751, K size: 10.84 GB, V size: 10.84 GB
```

| Rate, per second | P99 ITL, default / mixed chunk | Median TTFT, default / mixed chunk | Output tok/s, default / mixed chunk |
|---|---|---|---|
| 0.5 | 922 / 781 ms | 841 / 910 ms | 70.9 / 72.1 |
| 1 | 219 / 177 ms | 244 / 362 ms | 108.8 / 112.6 |
| 2 | 261 / 221 ms | 238 / 416 ms | 133.2 / 138.1 |

**We measured** a smoother stream and a slower first token. The P99 ITL fell by 15 to 19 percent, outside the seed spread at 0.5 and at 2 per second. The median TTFT rose by 49 to 74 percent at 1 and 2 per second, outside the seed spread. Throughput rose by 2 to 4 percent, inside the spread. 

The default run from 2026-10-17 gave the same direction. Against it, the P99 ITL fell by 16 to 29 percent. The median TTFT rose by 35 and 54 percent at 1 and 2 per second. The cache caution above applies to both servers at 1 and 2 per second.

On our two cards with this workload, the flag was a trade, and the card decided whether you get it. When prefill keeps up, the decode tokens that ride in the prefill batch stop waiting, and each new prompt waits a little longer. When prefill cannot keep up, as on the L4, the queue sets the pace and the flag changes little.

```listing
title: a larger chunk that did not start
source: capture/gpu/incidents/l4-chunk-8192-prefill-graph-oom.txt
lang: text
note: SGLang 0.5.22 on the L4 with --chunked-prefill-size 8192. The last error names PyTorch, and the cause is two lines above it.
---
[2026-10-18 07:27:15] Memory pool end. avail mem=2.90 GB
Capturing prefill shape (num_tokens=8192 avail_mem=2.33 GB)
torch.AcceleratorError: CUDA error: out of memory
[2026-10-18 07:28:44] RuntimeError: num_active_captures_ > 0 INTERNAL ASSERT FAILED at "/__w/pytorch/pytorch/c10/cuda/CUDACachingAllocator.cpp":3209, please report a bug to PyTorch. markCaptureEnd called with no captures in progress
```

The other direction failed on the L4 at startup. With a chunk of 8,192, the KV pool took the same 24,094 tokens as before. The prefill graph for 8,192 tokens then needed more than the 2.33 GB that remained. The last line of the log is a PyTorch assert that asks for a bug report. The real error is the out-of-memory line above it.

## Our position

Keep `fcfs`. It is fair, it does not sort the queue by prefix, and the radix cache still gives you the cache hits. A shared prefix that arrived first is in the tree when the next request matches it, whatever the order.

Switch to `lpm` only when three things are true. Your traffic shares long prefixes. Your queue is often between a few and 128 requests deep. You measured the cache hit rate before and after with `/metrics`. [Section 5.2](#s-the-metrics-endpoint) shows the `cache_hit_rate` series to compare.

If you need tiers of users, use `--enable-priority-scheduling` instead of a cache policy. A new request can then preempt running ones when its priority beats theirs by `--priority-scheduling-preemption-threshold`, 10 by default {{code}}.

## An incident: the limit you set is not the limit you get

A user served a hybrid Mamba model and set `--max-running-requests 8` {{issue #36889}}. The server accepted the flag and reported 8. Throughput flattened at 2 streams anyway. Only an info line in the log said that the Mamba state cache capped `max_running_requests` to 2.

The scheduler loop admits against every limit at once, and the smallest one wins. The fix the reporter used was more Mamba cache, `--max-mamba-cache-size 40` with bf16 state and `--mem-fraction-static 0.90`, for 75 percent more throughput at concurrency 12. At v0.5.22 the cap is a warning. Read the log for the limit that the loop really uses, not the one you typed.

```takeaways
- Read Prefill batch and Decode batch lines to see admission, caching, and queueing.
- Keep the fcfs default unless you measured a cache gain from lpm.
- Expect lpm to change to FCFS above 128 waiting requests.
- Check the log for the effective limit after you set a limit.
- Measure P99 ITL before you make the prefill chunk smaller, because it did not help in our runs.
- On an MoE model, expect a small chunk to cost prefill time, because each chunk reads the experts again.
- Try --enable-mixed-chunk for a smoother stream when prefill keeps up, and expect a slower first token.
- Expect a chunk above the default for your GPU to need more free memory at startup.
```

Sources: python/sglang/srt/managers/scheduler.py (run_event_loop, event_loop_normal, get_next_batch_to_run, run_batch, process_batch_result), python/sglang/srt/managers/schedule_policy.py (CacheAwarePolicy, CacheAgnosticPolicy, WAITING_QUEUE_PREFIX_MATCH_MAX, _determine_active_policy, _validate_and_adjust_policy), python/sglang/srt/arg_groups/fields/schedule.py at v0.5.22; SGLang paper, arXiv 2312.07104; capture/out/server-default.log; issue https://github.com/sgl-project/sglang/issues/36889; capture/gpu/summary/gb10.json and capture/gpu/summary/l4.json (mixed); capture/gpu/sweep.py (mixed sweep); capture/gpu/incidents/l4-chunk-8192-prefill-graph-oom.txt; capture/gpu/out-gb10/server-mixed-chunk.log, capture/gpu/summary/gb10.json (mixed.mixed-chunk, mixed.graphs-on-b), capture/gpu/out-gb10/server-pools.log, Lee and others, From Tokens to Layers: Redefining Stall-Free Scheduling for MoE Serving with Layered Prefill, arXiv 2510.08055 (2025-10); capture/gpu/sweep.py (the mixed sweep plan).
