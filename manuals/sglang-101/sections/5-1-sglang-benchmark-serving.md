# sglang.benchmark.serving

> One benchmark run measures one concurrency, so you sweep concurrency until extra load stops adding throughput and only adds waiting.

A teammate posts "SGLang does 255 tokens per second on my laptop" in the team channel. The number is true. It came from our capture. It is also useless on its own. The same server gave that throughput with a median first token of 0.8 s at one load and 3.9 s at another. A throughput number without the latency that came with it describes nothing a user feels.

When you finish this section, you can run `sglang.benchmark.serving` with settings you can defend and read every line of its report. You can find the knee where more concurrency stops paying. You can also say which of your own numbers will transfer to a GPU and which will not.

## The command we ran

The server is one process with the model `mlx-community/Qwen3-0.6B-4bit` on the capture Mac. Every run in this section talks to this one server.

```listing
title: the server under test
source: capture/out/server-default.command.txt
lang: text
note: The full command, as the capture kit started it.
---
SGLANG_USE_MLX=1 sglang serve --model-path mlx-community/Qwen3-0.6B-4bit --disable-cuda-graph --host 127.0.0.1 --port 30000 --enable-cache-report --enable-metrics --mem-fraction-static 0.4
```

Two flags in that command need a note. SGLang's Apple silicon guide still passes `--disable-cuda-graph`, and the v0.5.22 help marks it deprecated in favor of `--cuda-graph-backend-{decode,prefill}=disabled`. On the MLX backend, decode is greedy unless you add `--mlx-enable-sampling`, so our runs measured the greedy path. The benchmark sends temperature 0 by default, so the client and the server agree here.

The client is the benchmark module that comes with SGLang. We ran it three times, with a concurrency cap of 1, 8, and 32. The run at 8 looks like this:

```bash
python -m sglang.benchmark.serving --backend sglang --port 30000 \
  --dataset-name random --random-input-len 512 --random-output-len 128 \
  --random-range-ratio 1.0 --num-prompts 32 --max-concurrency 8 --seed 7
```

**The path changed.** The benchmark tools moved into the `sglang.benchmark` package in 2026-06. `python -m sglang.bench_serving` still runs as a deprecated alias that imports the new module. `python -m sglang.bench_one_batch` and `python -m sglang.bench_offline_throughput` do not run at v0.5.22. [PR #40795](https://github.com/sgl-project/sglang/pull/40795) deleted both aliases on 2026-09-22 {{code}}. If a tutorial uses those two paths, it was written for an older SGLang, and its other flags are suspect too.

## Four defaults that change the result

The client makes choices before it measures anything. Each one changes the number you report, and most published benchmarks do not say which ones they kept.

| Setting | Default at v0.5.22 | What it does to the result |
|---|---|---|
| `--random-range-ratio` | 0.0 | Each length is drawn from 1 to the length you asked for, so the average prompt is about half of `--random-input-len` |
| `ignore_eos` | on | The server ignores the end token, so every request generates exactly `--random-output-len` tokens |
| `--request-rate` | `inf` | All requests are sent at time 0, and only `--max-concurrency` holds them back |
| `--warmup-requests` | 1 | One request runs before the clock starts |

The first row is the trap. With the default ratio, `--random-input-len 512` gives an average prompt near 256 tokens. Your report then says 512 and describes half the work. We set the ratio to 1.0, and the report confirms it. 32 prompts of 512 tokens give `Total input tokens: 16384`. With `ignore_eos`, the run gives `Total generated tokens: 4096`, exactly 32 times 128.

**Our position:** pass `--random-range-ratio 1.0` every time, or write the length distribution next to the result. A benchmark that hides its lengths cannot be compared with anything.

## Read the report, block by block

```listing
title: the report at a concurrency cap of 8
source: capture/out/bench-random-c8.txt
lang: text
note: Cut from the full output. The argument dump, the progress bar, and the P90 and P95 rows are cut.
---
============ Serving Benchmark Result ============
Backend:                                 sglang
Traffic request rate:                    inf
Max request concurrency:                 8
Successful requests:                     32
Benchmark duration (s):                  16.02
Total input tokens:                      16384
Total generated tokens:                  4096
Request throughput (req/s):              2.00
Output token throughput (tok/s):         255.63
Peak output token throughput (tok/s):    440.00
Peak concurrent requests:                16
Total token throughput (tok/s):          1278.13
Concurrency:                             7.96
…
Median TTFT (ms):                        785.79
P99 TTFT (ms):                           2180.87
…
Mean TPOT (ms):                          23.02
Median TPOT (ms):                        22.52
…
Median ITL (ms):                         20.35
P99 ITL (ms):                            78.79
Max ITL (ms):                            1948.37
```

The function `calculate_metrics` in the benchmark module computes every line. Five of them are easy to misread.

**Concurrency:** the sum of every request's end-to-end latency divided by the run duration. It is the average number of requests in progress, measured after the fact. Here it is 7.96 against a cap of 8. It tells you the cap was reached, and nothing more.

**Peak concurrent requests:** the run is cut into one-second buckets, and each request counts in every bucket that its interval touches. The line reports the largest bucket count. Two requests that run one after the other inside the same second both count, so the number can exceed the cap. That is why the report says 16 at a cap of 8, and 64 at a cap of 32.

**TTFT:** the time from sending the request to receiving the first streamed chunk. It contains queueing, prefill, and the network.

**TPOT:** for each request, the time after the first token divided by the remaining tokens, `(latency - ttft) / (output_len - 1)`. The report gives the mean and percentiles over requests. **ITL:** every gap between two streamed chunks, pooled across all requests. A chunk with several tokens counts as one gap.

**Max ITL:** the single longest gap, here 1,948 ms. One request waited almost two seconds between two tokens while new prompts ran their prefill. The median ITL of 20 ms hides that stall. The P99 of 79 ms shows part of it.

```figure
id: fig-5-1b
kind: structure
title: what each line of the report is computed from
claim: Concurrency and peak concurrent requests come from request timestamps after the run, so neither line repeats the cap you set.
caption: Read each row left to right, from the report line to the formula in calculate_metrics to our value at a cap of 8. Olive boxes are client measurements. From capture/out/bench-random-c8.txt and the benchmark module at v0.5.22.
```

## The sweep and the knee

One run tells you one point. Three runs at caps of 1, 8, and 32 tell you the shape.

| Cap | Output tok/s | Median TTFT | P99 TTFT | Median TPOT | Concurrency |
|---|---|---|---|---|---|
| 1 | 175.15 | 162.98 ms | 270.18 ms | 4.38 ms | 0.99 |
| 8 | 255.63 | 785.79 ms | 2180.87 ms | 22.52 ms | 7.96 |
| 32 | 252.74 | 3917.54 ms | 8262.86 ms | 93.61 ms | 31.94 |

**We measured** this on the capture Mac. From 1 to 8, output throughput rises 46 percent and the median first token gets 4.8 times slower. From 8 to 32, throughput falls about 1 percent. The median first token gets 5 times slower, and the median time per token gets 4.2 times slower.

```figure
id: fig-5-1
kind: comparison
title: throughput stops at a cap of 8, latency does not
claim: Raising the cap from 8 to 32 added no throughput and made the median first token five times slower.
caption: Left, output tokens per second at each cap. Right, median TTFT at the same caps on a shared scale. Olive bars are client measurements, and rose marks the run past the knee. From capture/out/bench-random-c1.txt, c8.txt, and c32.txt.
```

The knee is the cap after which throughput stops rising. On this machine it is at or below 8. Past the knee, the server has no idle compute left to give. New requests only wait for a share of the same decode steps. The scheduler in [section 2.2](#s-the-scheduler-loop-and-schedule-policy) accepts them anyway, because its admission limit on this Mac was `max_running_requests=4096`.

**What transfers to a GPU.** The absolute numbers do not. A 0.6B model on Apple silicon says nothing about an H100. The shape transferred to the servers we measured. Each one had a latency knee, the latency past it grew faster than the throughput, and the default admission limit sat far above it.

## The same sweep on a GPU, run as an experiment

One run on a GPU told us something false. The GPU kit started the default server on an NVIDIA GB10 with Qwen3-30B-A3B and ran each cap once.

```listing
title: the server under test on the GB10
source: capture/gpu/out-gb10/server-default.command.txt
lang: text
note: The full command, as the GPU kit started it.
---
sglang serve --model-path Qwen/Qwen3-30B-A3B-Instruct-2507 --host 127.0.0.1 --port 30000 --enable-cache-report --enable-metrics --mem-fraction-static 0.7
```

At a cap of 8 the single run reported a median first token of 677.61 ms. At a cap of 32 it reported 390.38 ms. More load gave a faster first token, and no queue explains that. One run is one sample, and one sample can be wrong for reasons you never see.

So we ran the sweep the way a model team runs a training comparison. [Our sweep script](manuals/sglang-101/capture/gpu/sweep.py) runs every cap from 1 to 64 three times, with seeds 1, 2, and 3. It passes `--output-details`, so each run keeps the TTFT and the token gaps of every request. [Our summary script](manuals/sglang-101/capture/gpu/summarize.py) reduces the three runs of each point to the median, the lowest, and the highest value.

| Cap | Single kit run, median TTFT | Three seeds, median TTFT (lowest to highest) |
|---|---|---|
| 8 | 677.61 ms | 209.98 ms (185.25 to 216.02) |
| 32 | 390.38 ms | 416.37 ms (338.06 to 434.64) |

**We measured** both on the same GB10, with two different servers. The single kit run had a pool of 227,243 tokens on 2026-10-17, and the sweep a pool of 234,600 tokens on 2026-10-16. The 677.61 ms result did not come back in three more runs. From a cap of 2 up, the first token gets slower as the cap grows, as the queue predicts.

Later we found the cause of the false result in the server log of the kit run. The kit sent every run with seed 7 to one server, and it never cleared the prefix cache. With one seed, the client sends the same first prompts in every run {{code}}. So each run found the prompts of the run before it in the cache:

```listing
title: a run that found its prompts in the cache
source: capture/gpu/out-gb10/server-default.log
lang: text
note: Three prefill lines from the kit run at a cap of 32. The first two admit 29 requests that need one new token each. The third is the first prompt that was new to the cache. The ends of the lines are cut.
---
[2026-10-17 14:23:00] Prefill batch, #new-seq: 14, #new-token: 14, #cached-token: 6879, token usage: 0.07, …
[2026-10-17 14:23:00] Prefill batch, #new-seq: 15, #new-token: 15, #cached-token: 7634, token usage: 0.07, …
[2026-10-17 14:23:47] Prefill batch, #new-seq: 1, #new-token: 510, #cached-token: 2, token usage: 0.01, …
```

**We counted** the prefill lines of each kit run. At a cap of 8, 16 of the 64 prompts were in the cache before the run started. At a cap of 32, 64 of the 128 prompts were, and at a cap of 64, 128 of the 256. A cached prompt skips its prefill, so its first token comes fast. Half of the requests at a cap of 32 had that advantage, and a quarter at a cap of 8. That is why the median first token fell.

```figure
id: fig-5-1c
kind: chart
title: output throughput against concurrency on a GB10
claim: Three seeds per point agree closely, so each line is a measurement and the gaps between the lines are real.
caption: Read each line from left to right, one server configuration per line. The band is the lowest and the highest of three seeds. Qwen3-30B-A3B, 512 tokens in and 128 out. From capture/gpu/summary/gb10.json.
```

The widest band in the figure is EAGLE-3 at a cap of 8, from 86.93 to 107.23 tok/s. Every other band is inside about 10 percent of its median. With that spread, a gap of 1.9 times is real. At a cap of 64, FP8 gave 440.86 tok/s and BF16 gave 235.38 tok/s. The run without CUDA graphs lies on the default line, and [section 4.1](#s-forwardmode-and-cuda-graphs) explains why.

### A median hides two populations

`--output-details` writes the first-token time of every request. We sorted all requests of the three seeds at a cap of 16 and plotted them.

```figure
id: fig-5-1e
kind: chart
title: TTFT quantiles of three runs at a cap of 16
claim: About half of the requests waited several times longer than the other half, so the median describes neither group.
caption: Each line is drawn from 51 quantiles of the pooled requests, from the fastest to the slowest. The rose line marks P90. The time axis is logarithmic. From the per-request records in capture/gpu/summary/gb10.json, the load sweep at a cap of 16.
```

**We measured** two groups on the GB10. For BF16, the fastest half of the requests had a first token from 186.3 to 211.8 ms. From the 68th percentile, requests waited 1,639.8 to 1,743.4 ms. The median was 237.6 ms and P90 was 1,721.5 ms, 7.2 times more. FP8 had the same two groups: 122.7 to 139.5 ms for the fast half, and 589.9 to 1,162.2 ms for the slow half.

EAGLE-3 had the slowest median, 579.3 ms, and the shortest tail, 1,007.4 ms at P90. Its time per token had the widest spread instead: 82.8 ms at the median and 191.3 ms at P98. The number of draft tokens accepted changes from step to step.

**Our reading of the two groups:** the workload made them. Every request asked for exactly 128 tokens, because `--random-range-ratio 1.0` fixes the length. Requests that start together therefore finish together, and their replacements arrive together. Each wave then queues for prefill behind the requests ahead of it. Real traffic has mixed lengths. If you test with fixed lengths, read P90 as the cost of a burst, not as the cost of a normal request.

The prefix cache gives a second reading, and we cannot rule it out. The sweep also kept one server for all the runs of one configuration, with no flush. Each seed sent the same first prompts at every cap. At a cap of 16, 32 of the 64 prompts were the prompts of the run at a cap of 8. If they were still in the pool, half of the requests skipped their prefill. We did not keep the full server logs of the sweep, so we cannot count the hits.

We tested this reading on the L4, not on the GB10. On 2026-10-23 we ran the load sweep of Qwen3-8B with a flush before each run and a 900 MHz lock. We compared it with a run of the same session that had no flush:

```listing
title: median TTFT with and without a flush, Qwen3-8B on our L4 at 900 MHz
source: capture/gpu/out-l4/load-flushed-vs-unflushed.txt
lang: text
note: The median TTFT rows. The share of requests that met the target and the P99 ITL lines are cut.
---
median TTFT, flushed against unflushed
users   vLLM                                   SGLang
4       650 / 145 ms (4.5x)                    532 to 645 / 141 ms (3.8 to 4.6x)
8       951 to 978 / 264 to 274 ms (3.6x)      1,174 to 1,273 / 173 to 178 ms (6.6 to 7.3x)
16      1,550 to 1,587 / 294 to 295 ms (5.3x)  1,804 to 1,944 / 218 ms (8.3 to 8.9x)
…
```

On the L4, the flush raised the median TTFT of SGLang 4 to 9 times at 4 to 16 users. The time per token changed by less than 10 percent. So on the L4, the cache made most of the fast group. On the GB10 we did not rerun the sweep, so both readings stay open there.

### We tested the waves on an L4

A reading is a hypothesis until you change the variable it blames. We ran Qwen3-8B on one L4 with a cap of 16 and 64 prompts, three seeds per point. Only `--random-range-ratio` changed, from 1.0 to 0.5 to 0.0.

```listing
title: one wave on the L4 with fixed lengths
source: capture/gpu/out-l4/server-waves-default.log
lang: text
note: Five consecutive lines from a run at a ratio of 1.0. Timestamps are kept, because the timing is the point.
---
[2026-10-17 15:54:33] Prefill batch, #new-seq: 8, #new-token: 4096, #cached-token: 1, token usage: 0.34, #running-req: 1, #queue-req: 0, #pending-token: 513, cuda graph: True, input throughput (token/s): 3509.80
[2026-10-17 15:54:34] Prefill batch, #new-seq: 8, #new-token: 3583, #cached-token: 0, token usage: 0.34, #running-req: 8, #queue-req: 0, #pending-token: 0, cuda graph: True, input throughput (token/s): 3503.78
[2026-10-17 15:54:35] Decode batch, #running-req: 16, #token: 8240, token usage: 0.34, cuda graph: True, gen throughput (token/s): 2.62, #queue-req: 0
[2026-10-17 15:54:37] Decode batch, #running-req: 16, #token: 8880, token usage: 0.37, cuda graph: True, gen throughput (token/s): 231.07, #queue-req: 0
[2026-10-17 15:54:40] Decode batch, #running-req: 16, #token: 9520, token usage: 0.40, cuda graph: True, gen throughput (token/s): 229.85, #queue-req: 0
```

The wave is in the log. Only one request was running, so fifteen had just finished together, and their replacements arrived together. The scheduler prefilled them as two chunks of up to 4,096 tokens, and then all 16 decoded together.

```figure
id: fig-5-1h
kind: chart
title: Fixed lengths trade a slow first token for smooth decoding
claim: With fixed lengths the median TTFT was 1,996 ms and P99 ITL 82 ms, and with mixed lengths they were 291 ms and 300 ms.
caption: Solid lines are median TTFT and dashed lines are P99 inter-token latency, three seeds per point, on a log scale. Plum is BF16 and green is FP8 with an FP8 KV cache. From capture/gpu/summary/l4.json.
```

| Ratio | BF16 median TTFT | BF16 P99 ITL | FP8 median TTFT | FP8 P99 ITL |
|---|---|---|---|---|
| 1.0 | 1,996 ms | 82 ms | 1,526 ms | 55 ms |
| 0.5 | 364 ms | 396 ms | 130 ms | 95 ms |
| 0.0 | 291 ms | 300 ms | 129 ms | 95 ms |

**We measured** a first token 6.9 times slower with fixed lengths on BF16, and 11.8 times slower on FP8. The FP8 runs at the two ratios had median clocks of 1,185 and 2,040 MHz. So part of the FP8 factor is the clock. Mixed lengths sent fewer tokens. In seed 1 they sent 17,870 input tokens at a ratio of 0.0, against 32,768 at 1.0. So part of the gap is less work.

The cache can explain another part. In each seed, the run at 1.0 came first and started with an empty cache. The runs at 0.5 and 0.0 came after it. Each of their prompts is the first part of a prompt from the run at 1.0. The BF16 pool of 24,094 tokens held only part of the 32,768 tokens of that run. The FP8 pool of 142,369 tokens could hold all of them.

Less work and the cache do not explain the other half of the result. With mixed lengths, P99 ITL rose from 82 to 300 ms. New prompts arrived one by one, and each prefill stopped the running decodes. With fixed lengths, prefill happened only between waves.

The GB10 gave the same shape with Qwen3-30B-A3B, three seeds per point. With fixed lengths, the BF16 median TTFT was 1,650 ms and P99 ITL 169 ms. With mixed lengths, they were 320 ms and 230 ms. FP8 went from 1,050 ms and 92 ms to 188 ms and 127 ms. Two GPUs and two models show the same trade, so on both of our machines it came from the workload, not from the hardware.

The two settings measure two different servers. Fixed lengths measure bursts: a slow first token and smooth tokens after it. Mixed lengths measure steady traffic: a fast first token and stalls in the stream. Keep `--random-range-ratio 1.0` when you compare two builds, because it repeats exactly. Before you set a latency target from it, run your real length distribution too.

## Reset the prefix cache between runs

The prefix cache keeps the KV of earlier prompts after a run ends. It changes two things in the next run: the speed, and sometimes the greedy output, as [section 4.6](#s-deterministic-inference-and-logprobs) shows.

To see the size of the speed effect, we ran one load four times in a row with the same seed. We used `Qwen/Qwen3-0.6B`, 64 prompts at a cap of 16, 512 tokens in and 128 out. This was on the second GPU of our L4 node, which its owner shares and which had no clock lock. So trust the ratios, not the times.

```listing
title: median TTFT in ms, the same load four times in a row
source: capture/gpu/out-l4/prefix-cache-flush.txt
lang: text
note: The SGLang row of the summary. The vLLM row is cut.
---
engine        fresh   repeat, not flushed   repeat after a flush   repeat, not flushed
SGLang 0.6B   394     82.5                  289                    77
…
```

The repeat without a flush read a median TTFT about 4.8 times lower than the fresh run. After a flush, the TTFT went back near the fresh run. The time per token changed by less than 15 percent.

Use this protocol for every run that you compare:

1. Start each run with an empty cache. Pass `--flush-cache` to `sglang.benchmark.serving`, which calls `/flush_cache` after the warm-up request {{code}}. You can also call `POST /flush_cache` yourself, or restart the server.
2. Check that the flush ran. The server flushes only when no request runs or waits. Otherwise the route answers with HTTP 400, and the log says `Cache not flushed because there are pending requests` {{code}}.
3. Use a new `--seed` for each run, so that the client sends new prompts.
4. Record the cached tokens. Read `sglang:cached_tokens_total` from `/metrics` before and after the run. With `--enable-cache-report`, each OpenAI-style response also gives `usage.prompt_tokens_details.cached_tokens`.
5. Write the cache setting and the cached tokens next to the result.

Our kit and our sweeps did not follow this protocol. Only the first run of each seed on each server started with an empty cache. The later TTFT numbers on this page can be too low, most of all on the GB10, whose pool held every prompt we sent. The time per token is less exposed, because a cache hit removes prefill work and leaves the decode work the same.

## Goodput finds the knee that throughput hides

On the GB10, BF16 throughput still rises at a cap of 64, because the KV pool holds 234,600 tokens. A throughput curve with no knee does not tell you where to stop. A latency target does.

**Goodput:** the number of requests per second that finish inside the latency target. Our summary script counts a request when its first token comes in under 1 s and its mean time per token is under 100 ms.

| Cap | BF16 goodput | BF16 median TPOT | FP8 goodput | FP8 median TPOT |
|---|---|---|---|---|
| 4 | 0.44 req/s | 71.01 ms | 0.80 req/s | 38.60 ms |
| 8 | 0, and up to 0.04 in one seed | 102.21 ms | 1.07 req/s | 54.96 ms |
| 16 | 0 | 154.24 ms | 1.10 req/s | 81.90 ms |
| 32 | 0 | 201.91 ms | 0 | 104.12 ms |

BF16 goodput is highest at a cap of 4. From a cap of 8, the median request takes longer than 100 ms per token, so goodput is 0. Throughput at that cap is 74.11 tok/s and still rising. FP8 holds the target up to a cap of 16. **Our position:** choose the cap from goodput at your own target, and use the throughput curve only to explain it.

A cap is a closed loop. Each client waits for its answer before it sends the next request, so the server can never receive more work than it finishes. Real users do not wait for each other. `--request-rate` sends requests at Poisson arrival times instead, and the queue grows when the server is slower than the arrivals. We ran the same model at 0.5 to 16 requests per second, three seeds each.

```figure
id: fig-5-1d
kind: chart
title: requests served and requests served within the target, against offered load
claim: FP8 served 1.03 requests per second within the target at 1 offered, and BF16 served almost no request within the target at any rate.
caption: Dashed lines are requests completed per second. Solid lines are requests that met the target, with the range of three seeds as a band. Green is FP8 with an FP8 KV cache, plum is BF16. From capture/gpu/summary/gb10.json, the rate sweep.
```

**We measured** this on the GB10. At 0.5 requests per second, BF16 already had a median time per token of 177.5 ms. The arrivals overlap: at 0.52 requests per second, each 128 tokens long at 177.5 ms per token, about 12 requests share each decode step. Only 0.07 requests per second met the target. FP8 met the target for every request up to 1 per second, then fell to 0.17 at 2.

At 16 per second, BF16 completed 3.88 requests per second, and its P99 first token took 55,640.4 ms. FP8 completed 8.26. The GPU clock stayed at 2,496 MHz up to 4 requests per second. At 16, the GPU reached 89 C and spent 7.3 percent of the samples in thermal slowdown. The last BF16 point measures a hot GPU as well as a full queue.

We ran the same open loop on one 24 GB L4 with Qwen3-8B, with the cool-down to 72°C before each run.

```figure
id: fig-5-1g
kind: chart
title: the same open loop on a 24 GB L4
claim: On the L4, FP8 served 3.18 requests per second within the target at 4 offered, and BF16 served none within the target from 4 offered.
caption: Dashed lines are requests completed per second. Solid lines are requests that met the target, with the range of three seeds as a band. Green is FP8 with an FP8 KV cache, plum is BF16. From capture/gpu/summary/l4.json, the rate sweep.
```

**We measured** a different shape on the smaller card. Both servers met the target for every request up to 1 per second. BF16 held 0.88 within the target at 2 offered and none from 4. FP8 held 3.18 within the target at 4 offered, three times the best BF16 point. The FP8 server also had a pool of 142,369 tokens against 24,094 for BF16. From 4 offered, the BF16 pool was the limit.

Past its peak, BF16 completed fewer requests as we offered more: 2.01 per second at 4 offered, 1.91 at 8, and 1.62 at 16. The telemetry shows why. The median SM clock fell from 1,320 MHz at 4 offered to 465 MHz at 16. At 16, 70 percent of the samples showed thermal slowdown. On our passively cooled L4, overload cost throughput as well as latency.

## Check the client at high rates

`sglang.benchmark.serving` sends every request from one Python process with asyncio {{code}}. A 2026 study of benchmark clients found that such a client adds its own queue at high request rates. The client then reports a TTFT and a TPOT that are higher than what the server did. The study uses a client that runs in several processes instead.

We did not measure this effect. Our open loop stopped at 16 requests per second, and we did not record the CPU use of the client. Before you trust a TTFT at a high rate, compare one client process with two processes that each send half the rate.

## Compare two clients on one server

Our sweep tables came from `sglang.benchmark.serving` at temperature 0, its default. Another client can read a different number from the same server. We ran three clients against one vLLM 0.31.0 server with `Qwen/Qwen3-0.6B` on 2026-10-23. They were this client with `--backend vllm`, `vllm bench serve`, and its Rust version. The GPU was the shared second L4 of our node. Its clock was throttled, but it stayed at 420 to 495 MHz for every run.

```listing
title: median TTFT in ms from three clients, two rounds each
source: capture/gpu/out-l4/bench-client-bias.txt
lang: text
note: The rows at temperature 0 from the TTFT table. The rows at temperature 0.7 and the throughput table are cut.
---
users   temperature   SGLang client    vllm bench       vllm bench, Rust
1       0             154, 164         149, 150         144, 144
…
16      0             1,077, 1,045     1,033, 1,027     1,088, 1,038
…
64      0             1,688, 1,838     1,624, 1,667     1,674, 1,789
```

- Our client read a median TTFT 3 to 10 percent higher than `vllm bench serve`. At 16 and 64 users, it read an output throughput 2 to 8 percent lower. At one user, one of its rounds read a higher throughput than every other round, so we give no throughput gap there.
- The Python and the Rust versions of `vllm bench serve` agreed within the noise.
- The clients send different prompt tokens from their random datasets, so part of a small gap can come from the prompts.
- Temperature 0.7 raised the median TPOT over temperature 0. It was 10 to 13 percent higher at one user, and 3 to 6 percent higher at 16 and 64 users.

So a gap of a few percent between two published numbers can come from the client alone. Report the client and the temperature with every result.

## Record the GPU clock with every run

Our first sweep on an NVIDIA L4 reported that CUDA graphs did nothing. The median time per token at a cap of 1 was 103.4 ms with graphs and 103.4 ms without. The three seeds at that cap gave from 10.0 to 14.9 tok/s, a spread of half the median. Then we read `nvidia-smi` during the sweep.

```listing
title: the L4 during the first sweep
source: capture/gpu/incidents/l4-thermal-throttle.txt
lang: text
note: The header row and the row of the GPU that ran the sweep.
---
index, temperature.gpu, power.draw [W], power.limit [W], clocks.current.sm [MHz], clocks.max.sm [MHz], clocks_event_reasons.active, clocks_event_reasons.sw_thermal_slowdown, clocks_event_reasons.hw_thermal_slowdown, clocks_event_reasons.sw_power_cap, utilization.gpu [%]
0, 87, 58.36 W, 72.00 W, 360 MHz, 2040 MHz, 0x0000000000000020, Active, Not Active, Not Active, 100 %
```

The GPU was at 87 C with software thermal slowdown active, and its SM clock was 360 MHz of 2040. The L4 is a 72 W card with passive cooling, and the second card in the same chassis ran other work at the same time. We had measured a hot GPU, and the server under it was not the cause.

Now the sweep script samples `nvidia-smi` once a second into a `.gpu.csv` file beside each run. Before each run it waits up to 900 s for the GPU to cool below the `--cool` limit, 65 C by default. The L4 in this chassis runs warm, so we ran with `--cool 72`. The summary script adds the median SM clock, the highest temperature, and the share of samples with a thermal slowdown bit to each point. The GB10 load sweep in [figure 5.1c](#fig-5-1c) ran before we added the sampler, so its tight bands are the only check on it.

We ran the L4 sweep again with the same command and the cool-down. The throttled sweep is the rose line in the next figure.

```figure
id: fig-5-1f
kind: chart
title: the same server on the same L4, measured hot and measured with a cool-down
claim: The hot sweep reported up to 28 percent less throughput than the cooled sweep, with the same command on the same card.
caption: Blue is the sweep with a cool-down to 72 C and the clock recorded, and rose is the first sweep with no telemetry. Bands are the range of three seeds. Qwen3-8B, 512 tokens in and 128 out. From capture/gpu/summary/l4.json and capture/gpu/summary/l4-throttled.json.
```

**We measured** the difference on the L4. At a cap of 32, the cooled sweep gave 270.11 tok/s and the hot sweep gave 194.16 tok/s. At a cap of 1, the median time per token was 60.16 ms against 103.38 ms.

The cooled runs are not at full speed either. Their median SM clock was 1,080 to 1,515 MHz of 2,040. At caps of 1 and 64, in the worst seed, 41 to 49 percent of the samples still had the thermal bit set. The cool-down removes the worst error, and the recorded clock tells you how much is left.

**Our position:** a benchmark without the clock and the temperature of each run is not evidence. Read the clock first, then the throughput.

## Our position

Report the highest concurrency that still meets your latency target, and report its throughput together with p50 and p99 TTFT and TPOT. "255 tok/s at a cap of 8, with a median first token of 0.79 s" is a result. "255 tok/s" is a slogan.

Then enforce the knee outside the engine. The engine's own limit is set from memory, and memory runs out long after latency is unacceptable. Put the cap in your client, your gateway, or `--max-running-requests`, and size it from the sweep.

## The incident: a hand-written script

[Issue #3196](https://github.com/sgl-project/sglang/issues/3196) reported 13 tok/s for DeepSeek V3 on eight H200 GPUs, against 60 tok/s from the DeepSeek API {{issue #3196}}. Another user reached 33 tok/s on two H100 nodes. The measuring script counted words split on spaces and included the first-token time in the rate. A word is not a token, and TTFT is not decode time, so the script reported less than the server did. The fix was to measure with the benchmark client, which counts tokens and keeps TTFT and TPOT apart.

```takeaways
- Run `python -m sglang.benchmark.serving`, never a hand-written timing loop.
- Pass `--random-range-ratio 1.0` or state the length distribution you used.
- Test your real length mix before you set a latency target, because fixed lengths form waves.
- Sweep at least three concurrency caps and plot throughput against median TTFT.
- Report throughput only together with p50 and p99 TTFT and TPOT at the same cap.
- Read Concurrency as an achieved average and Peak concurrent requests as a per-second count.
- Enforce the knee in your client or gateway, because the engine admits far more.
- Run each point with three seeds and plot the lowest and the highest result.
- Choose the concurrency cap from goodput at your latency target.
- Record the SM clock and the temperature with every run, and report them.
- Set aside runs below a clock floor.
- Pass --flush-cache, or call POST /flush_cache, before every run that you compare, and record the cached tokens.
- Split the client into several processes before you trust TTFT at a high request rate.
- Report the client and the temperature with every result, and keep both fixed.
```

Sources: python/sglang/benchmark/serving.py (calculate_metrics, argument defaults, flush_server_cache, --flush-cache, the asyncio client), python/sglang/benchmark/datasets/common.py (compute_random_lens), python/sglang/benchmark/datasets/random.py (sample_random_requests), python/sglang/srt/entrypoints/http_server.py (flush_cache), python/sglang/srt/managers/scheduler.py (flush_cache), python/sglang/srt/observability/metrics_collector.py (cached_tokens_total), python/sglang/srt/entrypoints/openai/usage_processor.py, python/sglang/bench_serving.py, PR #40795, all at v0.5.22 (baa9befa); capture/out/serve-help.txt, capture/out/server-default.command.txt, capture/out/server-default.log, capture/out/bench-random-c1.txt, capture/out/bench-random-c8.txt, capture/out/bench-random-c32.txt; capture/gpu/sweep.py, capture/gpu/summarize.py, capture/gpu/summary/gb10.json, capture/gpu/summary/l4.json, capture/gpu/summary/l4-throttled.json, capture/gpu/out-gb10/server-default.command.txt, capture/gpu/out-gb10/bench-random-c8.txt, capture/gpu/out-gb10/bench-random-c32.txt, capture/gpu/incidents/l4-thermal-throttle.txt; issue #3196. capture/gpu/out-l4/server-waves-default.log, capture/gpu/out-l4/waves-default-input-tokens.txt, capture/gpu/out-gb10/server-pools.log, capture/gpu/out-gb10/server-default.log, Chandrasekar and Kramberger, Identifying and Mitigating Systemic Measurement Bias in Production LLM Inference Benchmarks, arXiv 2605.24217 (2026-05), capture/gpu/out-l4/prefix-cache-flush.txt, capture/gpu/out-l4/bench-client-bias.txt, capture/gpu/out-l4/load-flushed-vs-unflushed.txt
