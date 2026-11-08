# Make repeated prompts hit the prefix cache

> Prefix caching is on by default, and it pays only when the shared part of the prompt comes first.

Every request repeats the same long system prompt. When you finish this section, you can order a prompt so that the cache hits, and prove the hit from a metric.

**Our result:** on our L4, the cache kept the first token near 400 ms at every prefix length. Without it, the first token took 1,213 ms at 1,024 shared tokens.

## See what the cache saves

Prefix caching is on by default in vLLM 0.31.0. We ran the same workload with it on and off on the L4 with `Qwen/Qwen3-8B`. Each run sent 4 groups of 16 prompts at 8 users. The prompts in a group shared a system prompt of the length in the table. Each prompt then added a 128-token question and asked for 64 tokens back.

| Shared prompt tokens, L4 full-clock session | Median TTFT, cache on | Median TTFT, cache off | Output tok/s, on / off |
|---|---|---|---|
| none | 408 ms | 392 ms | 113.8 / 113.6 |
| 256 | 488 ms | 753 ms | 111.5 / 99.1 |
| 1,024 | 396 ms | 1,213 ms | 106.0 / 70.9 |
| 2,048 | 410 ms | 2,550 ms | 100.2 / 46.6 |
| 4,096 | 375 ms | 13,353 ms | 86.8 / 19.6 |

With the cache on, the first token took about 400 ms at every prefix length. With the cache off, the first token grew with the shared part, because every request computed the whole prompt again.

Read the last two rows with care. Without the cache, the GPU throttled. The median clock fell to 1,035 MHz at 2,048 tokens and to 675 MHz at 4,096 tokens. The cleanest comparison is the 1,024-token row, where both runs held 1,410 MHz or more. There the cache cut the first token about 3 times and gave 50 percent more output. The runs with the cache on were on 2026-10-17 and 2026-10-18, and the runs with it off on 2026-10-21.

The server log reports the hit rate every few seconds:

```listing
title: the prefix cache in the middle of a shared-prefix run
source: capture/gpu/out-l4/server-h2h-prefix-vllm.log
lang: text
note: 87 percent of the prompt tokens came from the cache.
---
INFO 10-18 00:43:16 [loggers.py:320] Engine 000: Avg prompt throughput: 231.0 tokens/s, Avg generation throughput: 93.6 tokens/s, Running: 8 reqs, Waiting: 0 reqs, GPU KV cache usage: 77.2%, Prefix cache hit rate: 87.2%
```

```figure
id: fig-3-2b
kind: chart
title: the cache on and off
claim: With the prefix cache on, the first token stayed near 400 ms at every shared length on our L4.
caption: Read the log scale with care: each grid line is about three times the one below. Bands span three runs. From capture/gpu/summary/l4.json.
```

## Put the shared part first

The cache matches a prompt from its first token, one 16-token block at a time. It stops at the first block that differs. So a cache hit needs the same tokens at the start of the prompt, in the same order.

1. Put the parts that never change first: the system prompt, the tool definitions, and the fixed instructions.
2. Put the parts that change rarely next, such as the documents of one session.
3. Put the parts that change on every request last: the user question, the time, and the request ID.

A timestamp or an ID near the start of the prompt changes the first block, and every later block then misses. Check your chat template too. Some templates put the date into the system prompt.

vLLM caches only full blocks. A shared part of 20 tokens gives one cached block of 16, and the last 4 tokens are always computed.

```figure
id: fig-3-2
kind: structure
title: a prefix hit
claim: A new request reuses cached blocks from the start of its prompt and stops at the first block that differs.
caption: Read the top row first, then the bottom row. Dashed blocks are computed again. From the vLLM source at v0.31.0.
```

## Keep tenants apart

Two users with the same prompt prefix share cached blocks. That saves compute, and it also lets one user's timing reveal what another user sent. To keep tenants apart, send a `cache_salt` field with each request. Requests with different salts never share blocks. The LoRA adapter is part of the block key too, so two adapters never share blocks.

## Prove the hit

Read two counters from `/metrics`:

```bash
curl -s localhost:8000/metrics | grep -E "^vllm:prefix_cache_(queries|hits)"
```

The hits divided by the queries is your hit rate. For one prompt, send the same long prompt twice and compare the second time to first token with the first.

If the hit rate is low, the cause is almost always the prompt order. A full pool is the next cause, because the cache keeps old blocks only until a running request needs the memory.

```takeaways
- On our L4, the default prefix cache kept the first token near 400 ms at every prefix length.
- Put the shared part of the prompt first and the changing part last.
- Use cache_salt to keep tenants apart.
- Prove the hit with the prefix cache counters, not with a guess.
```

Sources: capture/gpu/summary/l4.json (prefix.vllm, prefix.vllm-no-prefix-cache), capture/gpu/out-l4/server-h2h-prefix-vllm.log, capture/gpu/out-l4/server-h2h-prefix-vllm-no-cache.log, vLLM documentation at v0.31.0 (docs/design/prefix_caching.md), the vLLM source at v0.31.0 (vllm/v1/core/kv_cache_utils.py, vllm/config/cache.py).
