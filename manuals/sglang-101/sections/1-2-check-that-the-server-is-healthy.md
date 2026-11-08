# Check that the server is healthy

> Before you send traffic, confirm that the server answers, that it can produce a token, and that it chose the memory sizes you expect.

The ready line in the log says that the server started. It does not say that the server can serve your traffic. A pool that is too small, or a server that cannot produce a token, still prints the same line.

When you finish this section, you can choose the right health endpoint for a script or a probe. You can also read the three startup lines that size the server, warm it up, and read its first metrics.

## Wait until /health returns 200

To wait for the server in a script, ask `/health` until it returns 200:

```bash
until curl -sf -o /dev/null http://127.0.0.1:30000/health; do sleep 2; done
```

Our capture kit did the same, every 2 seconds. The server log shows the answer change from 503 to 200:

```listing
title: /health during the start of our L4 server
source: capture/gpu/out-l4/server-default.log
lang: text
note: Lines 36 to 43 of the log. The /model_info request and the first two prefill lines are cut.
---
[2026-10-17 14:43:37] INFO:     127.0.0.1:58250 - "GET /health HTTP/1.1" 503 Service Unavailable
…
[2026-10-17 14:43:38] INFO:     127.0.0.1:58272 - "POST /generate HTTP/1.1" 200 OK
[2026-10-17 14:43:38] INFO:     127.0.0.1:58288 - "POST /freeze_gc HTTP/1.1" 200 OK
[2026-10-17 14:43:38] The server is fired up and ready to roll!
[2026-10-17 14:43:40] Prefill batch, #new-seq: 1, #new-token: 1, #cached-token: 0, token usage: 0.00, #running-req: 0, #queue-req: 0, #pending-token: 0, cuda graph: False, input throughput (token/s): 0.58
[2026-10-17 14:43:40] INFO:     127.0.0.1:58298 - "GET /health HTTP/1.1" 200 OK
```

Look at the line before the 200. The scheduler ran a one-token prefill for the health check. By default, `/health` does not only answer. It sends a one-token request through the model and waits for the result.

## Choose the endpoint for the job

SGLang has three health endpoints {{code}}. Pick one by the question you ask:

- **Is the server up and accepting requests?** Use `/ready`. It returns 200 when the tokenizer manager is ready, and it sends no request to the model.
- **Can the server produce a token now?** Use `/health_generate`. It sends a one-token request and returns 503 when no output arrives within 20 s.
- **`/health`** shares the handler of `/health_generate`. With the default settings, it also generates a token.

For a script that waits for a start, any of the three works. For Kubernetes probes, the choice matters under load. A probe that generates waits in the same queue as your users. [Section 7.1](#s-operating-sglang) gives the probe settings we recommend and the incident behind them.

## Read the three startup lines

Three lines in the startup log tell you how much the server can hold. Read them on every start, because SGLang computes them for you:

```listing
title: the sizing lines of our L4 server
source: capture/gpu/out-l4/server-default.log
lang: text
note: Three lines from the startup log. The lines between them are cut.
---
[2026-10-17 14:42:45] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 22939, K size: 1.58 GB, V size: 1.58 GB
…
[2026-10-17 14:43:36] max_total_num_tokens=22939, chunked_prefill_size=4096, max_prefill_tokens=16384, max_running_requests=2048, context_len=40960, available_gpu_mem=1.31 GB
…
[2026-10-17 14:43:36] Tree cache initialized: source=default impl=UnifiedRadixCache hybrid_swa=False hybrid_ssm=False hicache_attached=False
```

**KV pool:** the GPU memory that holds the keys and values of every token that the server keeps, for all requests together. Our pool holds 22,939 tokens.

Compare the pool with `context_len=40960`. One request can be longer than the whole pool, so a single long request can fill it. Twenty-three users with 1,000 tokens each also fill it.

`max_running_requests=2048` is the most requests that the scheduler runs at once. The server computed this value, and we did not set it. The pool is the real limit long before 2,048 requests.

The last line names the prefix cache that the server uses. `UnifiedRadixCache` is the default radix cache, and `hicache_attached=False` says that HiCache is off. [Section 3.5](#s-eviction-policies-and-hicache) explains when to turn it on.

If the pool is smaller than your traffic needs, go to [section 3.1](#s-kv-bytes-per-token-and-the-kv-pool) to count the memory, and to [section 3.2](#s-mem-fraction-static-and-startup-sizing) to change the size.

## Warm up the server before you measure

The listing in the first part of this section shows a `POST /generate` and a `POST /freeze_gc` before the ready line. The server sent itself one request. Then it froze the Python garbage collector, so the objects from the start are not scanned again.

The freeze has a history. A field report from LinkedIn found garbage collection pauses of 100 to 300 ms every few seconds on a small ranking model {{field LinkedIn 2026-02}}. The fix was this warm-up and the frozen collector, merged as pull request 9241.

The warm-up does not make your first request fast on every machine. On our L4, the first request after the start reached its first token in 68 ms. On our Mac, the first request of the same kind took 889 ms. Send a few requests of your own before you measure anything.

## Check the first metrics

The server that we started with `--enable-metrics` serves Prometheus metrics on `/metrics`. Read four of them now, and keep the command for later:

```bash
curl -s http://127.0.0.1:30000/metrics | grep -E '^sglang:(num_running_reqs|num_queue_reqs|token_usage|cache_hit_rate)\{'
```

```listing
title: four metrics after our L4 runs
source: capture/gpu/out-l4/metrics.txt
lang: text
note: Four lines from /metrics, read after the benchmark runs of the default server.
---
sglang:num_running_reqs{engine_type="unified",model_name="Qwen/Qwen3-8B",moe_ep_rank="0",pp_rank="0",tp_rank="0"} 0.0
sglang:num_queue_reqs{engine_type="unified",model_name="Qwen/Qwen3-8B",moe_ep_rank="0",pp_rank="0",tp_rank="0"} 0.0
sglang:cache_hit_rate{engine_type="unified",model_name="Qwen/Qwen3-8B",moe_ep_rank="0",pp_rank="0",tp_rank="0"} 0.956268221574344
sglang:token_usage{engine_type="unified",model_name="Qwen/Qwen3-8B",moe_ep_rank="0",pp_rank="0",tp_rank="0"} 0.0
```

- `num_running_reqs` and `num_queue_reqs` count the requests that run now and the requests that wait.
- `token_usage` is the share of the KV pool in use, from 0 to 1.
- `cache_hit_rate` is the share of prompt tokens that the prefix cache found.

Our hit rate is 0.956 because our benchmarks sent many prompts with a shared prefix. On an idle server, all four values are near 0.

The endpoint is off by default. If the command prints nothing, start the server again with `--enable-metrics`. [Section 5.2](#s-the-metrics-endpoint) lists the metrics to alert on.

```takeaways
- Use /ready to wait for a start, and /health_generate to prove the model answers.
- Read the KV pool, max_running_requests, and tree cache lines on every start.
- Send warm-up requests before you measure anything.
- Read num_queue_reqs and token_usage before you blame the model for slow answers.
```

Sources: capture/gpu/out-l4/server-default.log, capture/gpu/out-l4/metrics.txt, capture/gpu/out-l4/generate.txt, capture/gpu/run.py, capture/out/generate.txt; python/sglang/srt/entrypoints/http_server.py (health, health_generate, ready, _execute_server_warmup, _freeze_gc_after_server_warmup) at v0.5.22; LinkedIn Engineering, "Scaling LLM-based ranking systems with SGLang at LinkedIn" (https://www.linkedin.com/blog/engineering/ai/scaling-llm-based-ranking-systems-with-sglang-at-linkedin, 2026-02-20); pull request 9241 (https://github.com/sgl-project/sglang/pull/9241).
