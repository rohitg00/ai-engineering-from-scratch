# Watch vLLM in production

> Five metrics show most problems before users report them.

Your server is in production and you must know when it is in trouble. When you finish this section, you can pick the metrics to alert on.

## Scrape the endpoint

vLLM exports Prometheus metrics at `/metrics` on the same port as the API. No flag is needed. Add a job like this one to the `scrape_configs` list of your Prometheus config, and change the target to your server:

```yaml
scrape_configs:
  - job_name: vllm
    scrape_interval: 15s
    metrics_path: /metrics
    static_configs:
      - targets: ["vllm-host:8000"]
```

We did not run Prometheus against our servers.

## Alert on five metrics

| Metric | Alert when | What it usually means |
|---|---|---|
| `vllm:num_requests_waiting` | above 0 for more than a minute | the server cannot admit all the traffic |
| `vllm:kv_cache_usage_perc` | above 0.95 for more than a minute | the pool is full, so new requests wait or preempt |
| `vllm:num_preemptions_total` | the rate is above 0 | requests are stopped and computed again |
| `vllm:time_to_first_token_seconds` | the 99th percentile passes your target | users wait for the first word |
| `vllm:inter_token_latency_seconds` | the 99th percentile passes your target | the stream has long gaps between tokens |

Set the latency targets from your product, not from the defaults of a dashboard. Our sweeps used 1,000 ms for the first token and 100 ms for each output token.

The two latency metrics are histograms, so the 99th percentile comes from a PromQL query. This expression is above 0 when the P99 of the first-token time over the last five minutes is more than 1 second:

```text
histogram_quantile(0.99, sum by (le) (rate(vllm:time_to_first_token_seconds_bucket[5m]))) > 1
```

Use the same form with `vllm:inter_token_latency_seconds_bucket` and a target of 0.1 for the token gaps.

## Read them together

One metric alone misleads. Read them in pairs:

- **Waiting above 0 with the cache usage below 0.9.** The pool has room, but the batch is full. `--max-num-seqs` or `--max-num-batched-tokens` limits the admission.
- **Waiting above 0 with the cache usage near 1.** The pool limits the admission. Add memory, or serve fewer users on this GPU.
- **A slow first token with no waiting requests.** The prompts are long, or the tokenizer in the API server is slow. Compare the queue time, `vllm:request_queue_time_seconds`, with the first-token time.
- **Preemptions with long answers.** Running requests grow until the pool runs out. Lower the concurrency, or use an FP8 KV cache.

## Watch the cache and speculation

Two more pairs of counters tell you whether a feature pays:

- The prefix cache hits divided by the queries give the hit rate. A rate that falls after a release of your application often means a change at the start of the prompt.
- With speculative decoding, the accepted tokens divided by the draft tokens give the acceptance rate. A falling rate means the proposer guesses badly on the current traffic.

## Watch the GPU too

The vLLM metrics do not show the GPU clock or temperature. A hot or shared GPU runs slower, and every latency rises with no change in the vLLM metrics. Export `nvidia-smi` data or use the NVIDIA DCGM exporter next to the vLLM metrics.

Not measured on our hardware. Our sweeps did not scrape `/metrics`. Our run with a small pool made requests wait in the queue, but we did not save its log or its metrics. [The chat page](#s-tune-chat-for-many-users) shows that run.

```takeaways
- Alert on the waiting count, the cache usage, preemptions, and the 99th percentile of TTFT and ITL.
- Read the waiting count together with the cache usage to find the limit.
- Export the GPU clock and temperature next to the vLLM metrics.
```

Sources: vLLM documentation at v0.31.0 (docs/design/metrics.md), the vLLM source at v0.31.0 (vllm/v1/metrics/loggers.py), capture/gpu/summary/l4.json (slo).
