# Check that the server is healthy

> Three routes and one log line tell you in a minute that the server is up, that it loaded the right model, and how much it can hold.

Your server started and you want to know that it works before you send it real traffic. When you finish this section, you can check the health route, the model list, the metrics, and the KV cache size.

## Ask the health route

Run this command:

```bash
curl -i http://localhost:8000/health
```

You see `HTTP/1.1 200 OK` and an empty body. The server log shows the same request.

```listing
title: the first health check and model list, from a DGX Spark
source: capture/gpu/out-gb10/server-load-vllm.log
lang: text
note: Three lines from the end of startup.
---
INFO:     Application startup complete.
INFO:     127.0.0.1:35152 - "GET /health HTTP/1.1" 200 OK
INFO:     127.0.0.1:34616 - "GET /v1/models HTTP/1.1" 200 OK
```

The health route answers 200 when the engine runs. It does not generate a token, so a 200 does not prove that a request completes. Send one short request as well, as in [the first request](#s-install-vllm-and-serve-your-first-model).

If the route does not answer, the server is still loading or it stopped. Read the end of the server log. A load can take minutes for a large model.

## Check the model name

Run this command:

```bash
curl http://localhost:8000/v1/models
```

The reply lists one model. Its `id` is the name your requests must use. Its `max_model_len` is the longest request in tokens that the server accepts.

## Read the KV cache size

Go back to the startup log and find the line that starts with `GPU KV cache size`. On our DGX Spark it reads:

```listing
title: the KV cache line, from a DGX Spark
source: capture/gpu/out-gb10/server-load-vllm.log
lang: text
note: One line from the startup log.
---
(EngineCore pid=143) INFO 10-21 10:59:46 [kv_cache_utils.py:2464] GPU KV cache size: 234,960 tokens, Maximum concurrency for 8,192 tokens per request: 28.68x
```

The first number is the total tokens of context that the server can hold for all users together. The second number is how many requests of the full maximum length fit at the same time. Shorter requests fit in larger numbers.

If the first number is much smaller than you expected, another program holds GPU memory, or the memory fraction is low. [The memory page](#s-count-the-memory-before-you-pick-a-gpu) shows how to predict this number before you start.

## Read the metrics

Run this command:

```bash
curl -s http://localhost:8000/metrics | grep -E "^vllm:(num_requests_running|num_requests_waiting|kv_cache_usage_perc)\{"
```

You see three lines. With no traffic, the running and waiting counts are 0 and the KV cache usage is 0. Send a request in a second terminal and run the command again to see the counts change.

Three metrics give the first answer to most questions:

| Metric | What it tells you |
|---|---|
| `vllm:num_requests_running` | requests that the engine works on now |
| `vllm:num_requests_waiting` | requests in the queue because the batch or the cache is full |
| `vllm:kv_cache_usage_perc` | the part of the KV cache in use, from 0 to 1 |

A waiting count above 0 with the cache usage near 1 means the cache is full. [The production page](#s-watch-vllm-in-production) gives the full alert list.

```takeaways
- Use the health route for liveness and one short request for readiness.
- Read the KV cache size line after every start.
- Watch the waiting count and the cache usage first.
```

Sources: vLLM documentation at v0.31.0 (docs/serving/online_serving/openai_compatible_server.md, docs/design/metrics.md), capture/gpu/out-gb10/server-load-vllm.log.
