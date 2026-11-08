# Metrics

> These are the Prometheus series this manual reads, what each one measures, and the question each one answers in production.

`--enable-metrics` turns on `/metrics`. Without the flag, the endpoint does not exist, and the default is off. Our default server exported 81 metric families with the prefix `sglang:` ([the metrics capture](manuals/sglang-101/capture/out/metrics.txt)). [Section 5.2](#s-the-metrics-endpoint) explains which ones to alert on. This table keeps the ones the manual uses.

## Latency

| Series | Type | Measures | The question it answers |
|---|---|---|---|
| `sglang:time_to_first_token_seconds` | histogram | the time from arrival to the first output token | are users waiting before they see anything |
| `sglang:inter_token_latency_seconds` | histogram | the time between two output tokens | does the stream stutter |
| `sglang:request_time_per_output_token_seconds` | histogram | per request, the decode time divided by the output tokens after the first | is decode slow for each user |
| `sglang:e2e_request_latency_seconds` | histogram | the time from arrival to the last token | how long does a full answer take |
| `sglang:queue_time_seconds` | histogram | the time a request waits before its first prefill | is the scheduler holding requests back |

## Load and memory

| Series | Type | Measures | The question it answers |
|---|---|---|---|
| `sglang:num_running_reqs` | gauge | requests in the running batch | how much work is on the GPU now |
| `sglang:num_queue_reqs` | gauge | requests in the waiting queue | is admission the bottleneck |
| `sglang:token_usage` | gauge | the fraction of pool slots in use | how close the pool is to full |
| `sglang:num_retracted_reqs` | gauge | requests the scheduler moved back to the queue in the last log interval | did the admission forecast fail just now |
| `sglang:num_retracted_requests_total` | counter | requests the scheduler moved back to the queue since start | how often does the admission forecast fail |
| `sglang:max_total_num_tokens` | gauge | the size of the KV pool in tokens | what did startup sizing decide |
| `sglang:kv_cache_memory_usage_gb` | gauge | memory used by the KV pools | how much memory the cache holds |
| `sglang:gen_throughput` | gauge | output tokens per second in the last interval | is the server producing tokens |
| `sglang:scheduler_idle_seconds_total` | counter | time with no runnable or queued work | is the server underused |

## Cache and tokens

| Series | Type | Measures | The question it answers |
|---|---|---|---|
| `sglang:cache_hit_rate` | gauge | the prefix cache hit rate | are prompts reusing the cache |
| `sglang:cached_tokens_total` | counter | cached prompt tokens, by source: device, host, or storage | which cache tier served the hits |
| `sglang:prompt_tokens_total` | counter | prefill tokens processed | how much prompt work arrived |
| `sglang:uncached_prompt_tokens_histogram` | histogram | prompt tokens that needed compute | how much prompt work was new |
| `sglang:generation_tokens_total` | counter | output tokens produced | how much decode work was done |
| `sglang:num_requests_total` | counter | finished requests | how many requests were served |
| `sglang:num_paused_reqs` | gauge | requests paused for a weight update | is an RL trainer pausing the server |

## What our runs recorded

After the shared-prefix benchmark, [the default server](manuals/sglang-101/capture/out/metrics.txt) reported `sglang:cache_hit_rate` 0.94. [The server with `--disable-radix-cache`](manuals/sglang-101/capture/out/no-radix-cache-metrics.txt) reported 0.0 for the same benchmark. The gauge covers a recent window.

The counters cover the whole life of each server, and the two servers ran different sets of benchmarks before the scrape. The default server counted 286,134 prompt tokens, 286,102 streamed plus 32. Of those, 182,079 came from the cache, a lifetime ratio of 0.64. Each counter appears once per label set, so sum the rows before you divide.

Sources: python/sglang/srt/observability/ at v0.5.22; capture/out/metrics.txt, no-radix-cache-metrics.txt, small-pool-metrics.txt.
