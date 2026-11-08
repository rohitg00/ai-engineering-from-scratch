# Metrics

> This page lists the vLLM metrics the manual uses and the page that uses each one.

Use this page to find a metric that a section names.

vLLM exports the metrics at `/metrics` in the Prometheus format. Every name starts with `vllm:`.

Every counter shows on `/metrics` with a `_total` suffix, as these tables list it.

## Load and memory

| Metric | Type | What it counts | Page |
|---|---|---|---|
| `vllm:num_requests_running` | gauge | requests that the engine works on now | [health](#s-check-that-the-server-is-healthy) |
| `vllm:num_requests_waiting` | gauge | requests in the queue | [health](#s-check-that-the-server-is-healthy) |
| `vllm:kv_cache_usage_perc` | gauge | the share of the KV cache in use, from 0 to 1 | [health](#s-check-that-the-server-is-healthy) |
| `vllm:num_preemptions_total` | counter | requests stopped to free blocks | [troubleshooting](#s-troubleshoot-by-symptom) |

## Latency

| Metric | Type | What it counts |
|---|---|---|
| `vllm:time_to_first_token_seconds` | histogram | the time from arrival to the first token |
| `vllm:inter_token_latency_seconds` | histogram | the time between two tokens of one request |
| `vllm:request_time_per_output_token_seconds` | histogram | the mean time for each output token of a request |
| `vllm:request_queue_time_seconds` | histogram | the time a request waited before it ran |

## Cache and tokens

| Metric | Type | What it counts | Page |
|---|---|---|---|
| `vllm:prefix_cache_queries_total` | counter | prompt tokens looked up in the prefix cache | [troubleshooting](#s-troubleshoot-by-symptom) |
| `vllm:prefix_cache_hits_total` | counter | prompt tokens found in the prefix cache | [troubleshooting](#s-troubleshoot-by-symptom) |
| `vllm:prompt_tokens_total` | counter | prompt tokens processed | |
| `vllm:generation_tokens_total` | counter | output tokens generated | |

## Speculative decoding

| Metric | Type | What it counts | Page |
|---|---|---|---|
| `vllm:spec_decode_num_draft_tokens_total` | counter | tokens the proposer guessed | [speculative decoding](#s-how-speculative-decoding-checks-drafts) |
| `vllm:spec_decode_num_accepted_tokens_total` | counter | guessed tokens the target model kept | [speculative decoding](#s-how-speculative-decoding-checks-drafts) |

## What our runs recorded

Our benchmark client recorded TTFT, TPOT, ITL, and throughput for each request. A sampler recorded the GPU clock and temperature every second. We did not scrape `/metrics` during the sweeps.

Sources: vLLM documentation at v0.31.0 (docs/design/metrics.md), the vLLM source at v0.31.0 (vllm/v1/metrics/loggers.py).
