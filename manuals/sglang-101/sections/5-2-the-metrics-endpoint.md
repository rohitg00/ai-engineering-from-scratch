# The /metrics endpoint

> Gauges report one instant, and the cache hit rate gauge reports one log interval, so you alert on counters and histograms over a time window.

Your dashboard says the prefix cache hit rate is 94 percent. Over the same run, the server computed 104,057 prompt tokens and took 182,079 from the cache, a real hit rate of 64 percent. Both numbers came from one scrape of the server in our capture. One is a gauge that remembers the last prefill batch it logged. The other is a pair of counters that remember everything.

When you finish this section, you can turn the endpoint on and tell a gauge from a counter and a histogram. You can compute a hit rate that means something, and write six alerts for a server past its knee.

## Turn it on first

The endpoint is off by default. The field `enable_metrics` defaults to `False` at v0.5.22 {{code}}, and without `--enable-metrics` the server does not mount the path `/metrics` at all. Our capture server started with the flag, as [section 5.1](#s-sglang-benchmark-serving) shows. After the default experiments, it exported 81 metric families in 603 sample lines that start with `sglang:`.

**Our position:** start every server with `--enable-metrics`, including the one on your laptop. We did not measure its cost, and we expect it to be small next to a decode step. The cost of an incident without history is the whole investigation.

## Three kinds of series

**Gauge:** a value the scheduler overwrites on each log interval, such as the number of running requests. A scrape sees the latest value only. **Counter:** a total that only grows, such as the number of prompt tokens processed. You read it with a rate over a window. **Histogram:** a set of counters, one per bucket, that counts how many requests fell under each limit. You read percentiles from it with a rate over a window.

The snapshot below was taken when the server was idle, after all default experiments.

```listing
title: gauges at idle
source: capture/out/metrics.txt
lang: text
note: Labels are cut. The full lines carry engine_type, model_name, and rank labels.
---
sglang:num_running_reqs{…} 0.0
sglang:num_queue_reqs{…} 0.0
sglang:gen_throughput{…} 0.0
sglang:token_usage{…} 0.0
sglang:cache_hit_rate{…} 0.9418739997090062
sglang:num_retracted_reqs{…} 0.0
```

Five gauges show an idle server. One does not. The cache hit rate still holds the value from the last prefill batch that ran, which was the shared-prefix benchmark. A gauge answers "what happened in the last interval", and when nothing happens, some gauges decay and some keep their last value.

## The cache hit rate, two ways

The scheduler computes the gauge from the prefill tokens of one log interval. The value is hit tokens divided by hit tokens plus computed tokens. The counters below add up the same two quantities since the server started.

```listing
title: the counters behind the hit rate
source: capture/out/metrics.txt
lang: text
note: Labels are cut except mode. The HELP line is shown in full.
---
# HELP sglang:prefill_effective_tokens_total Effective prefill tokens with retracted-request re-counts excluded, updated on each log interval. mode: device_hit, host_hit, storage_hit, input. Windowed prefix cache hit rate = rate(sum of *_hit) / rate(sum of all modes); per-tier rate uses a single *_hit mode in the numerator.
sglang:prefill_effective_tokens_total{…mode="input"…} 104057.0
sglang:prefill_effective_tokens_total{…mode="device_hit"…} 182079.0
sglang:prefill_effective_tokens_total{…mode="host_hit"…} 0.0
sglang:prefill_effective_tokens_total{…mode="storage_hit"…} 0.0
```

The HELP text says that re-counted tokens are excluded. In the code, that is true only for the `input` mode. The three hit modes add the raw hit counts, so after a retraction they can count the same tokens twice {{code}}. Our run had no retractions, so the numbers below are exact.

From the counters, the hit rate over the whole run is 182,079 divided by 286,136, which is 0.636. The gauge says 0.942. Both are correct, and they answer different questions. The gauge describes the shared-prefix benchmark at the end of the run. The counters describe all of it, including the random-prompt benchmarks that could hit nothing.

```figure
id: fig-5-2
kind: comparison
title: one server, two cache hit rates
claim: The gauge reported the last prefill interval at 0.942, while the counters over the whole run gave 0.636.
caption: Left, the gauge and the interval it remembers. Right, the two counters and their ratio. Green is cached tokens, plum is computed prefill tokens. From capture/out/metrics.txt after the default experiments.
```

The HELP text of the counter gives the formula for a windowed rate. In PromQL it reads like this:

```promql
sum(rate(sglang:prefill_effective_tokens_total{mode=~".*_hit"}[5m]))
  / sum(rate(sglang:prefill_effective_tokens_total[5m]))
```

The server with `--disable-radix-cache` reported a gauge of 0.0 in its own snapshot, so the gauge does reach zero when nothing can hit. A low value from the counters is the signal [section 3.4](#s-prefix-friendly-prompts) teaches you to act on.

## What to alert on

These six series cover the failures in this manual. Every name below appears in our capture.

| Series | Type | Alert when | Why |
|---|---|---|---|
| `time_to_first_token_seconds` | histogram | p99 over 5 min is above your target | users wait for the first token before anything else |
| `inter_token_latency_seconds` | histogram | p99 over 5 min is above your target | prefill batches stall running decodes, as the 1,948 ms gap in section 5.1 showed |
| `num_queue_reqs` | gauge | above 0 for several minutes | the server is past its knee, and new requests only wait |
| `token_usage` | gauge | near 1.0 for several minutes | the KV pool is full, and retraction comes next |
| `num_retracted_requests_total` | counter | rate above about 1 per minute | the scheduler threw out requests and computes them again, see [section 2.3](#s-admission-and-retraction) |
| `prefill_effective_tokens_total` | counter | windowed hit rate drops after a deploy | a prompt change broke the prefix, see section 3.4 |

The p99 of a histogram comes from its buckets:

```promql
histogram_quantile(0.99,
  sum by (le) (rate(sglang:time_to_first_token_seconds_bucket[5m])))
```

**We measured** both histograms in the same snapshot. The queue time histogram has a sum of 251.7 s over 266 requests, a mean of 0.95 s. The streaming TTFT histogram has a sum of 612.7 s over 261 requests, a mean of 2.35 s. The two series count different requests, so their ratio is an estimate, not a measured share. It suggests that queueing was a large part of the first-token time on this Mac. For an exact share, compare queue time and TTFT of the same requests.

```listing
title: queue time against first-token time
source: capture/out/metrics.txt
lang: text
note: Labels are cut except is_streaming.
---
sglang:queue_time_seconds_sum{…} 251.74525608913973
sglang:queue_time_seconds_count{…} 266.0
sglang:time_to_first_token_seconds_sum{…is_streaming="true"…} 612.7282021734864
sglang:time_to_first_token_seconds_count{…is_streaming="true"…} 261.0
```

## Our position

Alert on latency and activity with histogram percentiles and counter rates over a window. Alert on state with a gauge only when the condition lasts, such as `num_queue_reqs` above 0 or `token_usage` near 1.0 for several minutes. A single gauge scrape describes the last few seconds. When a gauge and a counter disagree, as the cache hit rate did here, the counter is the one to trust.

Read every new metric in its HELP text and in the code before you build on it. Not every gauge works.

## The incidents

**A gauge that never moves.** The scheduler code at v0.5.22 carries a comment that `sglang:utilization` stays at 0 since a regression it links to #22713 {{code}}. Our capture agrees: the gauge reads 0.0 after a run that kept the server busy for minutes. A dashboard panel built on it would show an idle fleet during an outage.

**A health probe that piled up work.** [Issue #35884](https://github.com/sgl-project/sglang/issues/35884) reported that a timed-out `/health` call did not cancel its request in the scheduler {{issue #35884}}. Each failed probe left one more orphaned request behind, and under load the probes added to the load they were trying to detect. A related report, [issue #22511](https://github.com/sgl-project/sglang/issues/22511), shows the message "health check failed" under high load on a large model {{issue #22511}}. Watch the queue and latency series, and treat a failing probe as one more symptom.

```takeaways
- Start every server with `--enable-metrics`, because the endpoint is off by default.
- Alert on histogram percentiles and counter rates over a window, never on one gauge scrape.
- Compute the cache hit rate from `prefill_effective_tokens_total`, not from the `cache_hit_rate` gauge.
- Page on sustained `num_queue_reqs` above 0 and on `token_usage` near 1.0.
- Ignore `sglang:utilization` at v0.5.22, because it stays at 0.
- Compare queue time and TTFT of the same requests to see how much latency is waiting.
```

Sources: python/sglang/srt/arg_groups/fields/observability.py (enable_metrics), python/sglang/srt/managers/scheduler_components/metrics_reporter.py (cache hit rate and utilization), python/sglang/srt/observability/metrics_collector.py, all at v0.5.22 (baa9befa); capture/out/metrics.txt, capture/out/no-radix-cache-metrics.txt, capture/out/server-default.command.txt; issues #35884 and #22511.
