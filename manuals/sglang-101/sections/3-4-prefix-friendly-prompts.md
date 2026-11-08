# Prefix-friendly prompts

> The prefix cache matches tokens from the first one, so one changing token near the start of a prompt can cost more than server tuning recovers.

A team runs DeepSeek-V4 for long agent sessions on eight GPUs, with hierarchical caching turned on. Their dashboards show `#cached-token: 0` on requests that repeat 100,000 tokens of history. They tune the cache tiers and the write policy. The hit rate barely moves. Then they find a random hash that their relay put into the system prompt of every request.

When you finish this section, you can predict which prompts hit the prefix cache before you send them. You can also prove the hit rate with `cached_tokens`, the scheduler log, and `/metrics`.

## The experiment: one identifier, three places

The capture kit sends one 2,999-token system prompt and one short question, five times in each of three forms. The server runs with `--enable-cache-report`, so each response reports its cached tokens to the client. The kit sends two warm-up requests first.

- **Stable:** the same system prompt every time.
- **ID at start:** the system prompt starts with `Request id <random hex>.`, a new value on every request.
- **ID at end:** the same random ID goes at the end of the system prompt.

```listing
title: the summary of the cache experiment
source: capture/out/cache-experiment.txt
lang: json
note: The three summary lines. The fifteen per-request lines above them are cut. The stable case drops its first round, which filled the cache.
---
…
{"summary": "stable-system-prompt", "median_ttft_ms": 45.1, "min_ttft_ms": 34.0, "max_ttft_ms": 62.5, "median_cached_tokens": 2998.0, "prompt_tokens": 2999}
{"summary": "id-at-start", "median_ttft_ms": 1255.3, "min_ttft_ms": 1102.6, "max_ttft_ms": 2197.3, "median_cached_tokens": 5, "prompt_tokens": 3034}
{"summary": "id-at-end", "median_ttft_ms": 88.2, "min_ttft_ms": 83.7, "max_ttft_ms": 118.1, "median_cached_tokens": 2985, "prompt_tokens": 3028}
```

We measured a 28 times longer wait for the first token when the ID sits at the start: 1,255 ms against 45 ms. The run used our Mac with Qwen3-0.6B in 4-bit MLX. The factor depends on the prefill speed of the card. The number of missed tokens does not.

The same ID at the end cost 43 ms more than the stable prompt. The tokens are almost the same in all three cases. Only their order differs.

The cached-token counts explain the times. The stable prompt reused 2,998 of 2,999 tokens, the maximum from [section 3.3](#s-radixcache). The ID at the start matched only the first 5 tokens, the ones that come before the random hex digits. Every token after a change is a different branch of the tree, even when the rest of the prompt is identical.

```figure
id: fig-3-4
kind: comparison
title: the same tokens in three orders
claim: A random ID at the start of the prompt made about 3,027 tokens miss the cache, and the same ID at the end cost about 45 tokens.
caption: Read each ribbon left to right as the prompt's tokens. Green is reused from the cache, and plum is computed in prefill. From capture/out/cache-experiment.txt.
```

## Why the order matters

The radix tree compares tokens from the first one onward, and it stops at the first difference. Nothing after a difference can match, because the attention values of every later token depend on every earlier token. A cache that reused the later tokens would return wrong answers. So prefix caching is exact by design, and it is unforgiving by the same design.

The same rule applies to each part of a chat request. The chat template turns the messages into one token sequence in a fixed order: system prompt, tool list, earlier turns, new message. A change in the system prompt invalidates everything. A change in the newest message invalidates only that message.

## The incident

Issue #35129 is the story at the top of this section {{issue #35129}}. The reporter found three causes stacked on top of each other.

1. The relay put a per-session random `cch=` hash and a rotating system message into each request. Removing them moved the engine hit rate from 66.8 percent to 94.4 percent.
2. The client wrote its task-list snapshot at the end of the system prompt. Every task update changed the system prompt, so it invalidated more than 100,000 tokens of history after it.
3. Hierarchical cache load-back, when it could not find room, evicted the prefixes of other sessions. The reporter counted 250,000 evict calls against 376 completed load-backs.

The first fix was a prompt edit. No server flag in [section 3.5](#s-eviction-policies-and-hicache) could have recovered the 27.6 points that the hash cost.

## Our position: fix prompts before you tune the server

Treat the prompt layout as part of the serving system. Before you change any cache flag, check these rules against your real requests.

- Put content that never changes first: the system prompt, then the tool list in a fixed order.
- Put content that changes per session after that, and content that changes per request last.
- Never put timestamps, request IDs, session hashes, or random sampling seeds in the system prompt. Send them as request metadata, or at the end.
- Keep tool and function definitions in a stable order. A JSON object whose keys change order is a different token sequence.
- Append to the conversation. Do not rewrite earlier turns, for example to summarize them, unless you accept a full prefill.

Two server-side settings break reuse in ways that look like prompt problems. A request for prompt log probabilities from position `k` can reuse only the first `k` tokens {{code}}. Different LoRA adapters never share tree nodes, even for identical tokens, because the adapter is part of the tree key {{code}}.

Routing can break reuse too. With several servers, a request that goes to a server without its prefix misses the cache, whatever the prompt looks like. Jarvislabs reported that routing each conversation to the same server moved their hit rate from 64.7 percent to 92.1 percent {{field Jarvislabs 2026-08}}. [Section 6.4](#s-sgl-model-gateway) shows how the gateway routes by prefix.

## How to prove a hit

Use three measurements, from the closest to the request to the most general.

1. **In the response.** Start the server with `--enable-cache-report`, which defaults to off {{code}}. The usage block then reports `cached_tokens`. The native `/generate` API returns `cached_tokens` in `meta_info` without the flag.
2. **In the scheduler log.** Every `Prefill batch` line reports `#new-token` and `#cached-token`.
3. **In the metrics.** `/metrics` exports `sglang:cache_hit_rate`, a gauge of recent prefill batches. After the shared-prefix benchmark in [section 3.3](#s-radixcache), our server reported 0.94. The server with `--disable-radix-cache` reported 0.0.

```listing
title: the scheduler's view of the three prompt forms
source: capture/out/server-default.log
lang: text
note: One line for each form, in the order the kit sent them. The other twelve lines are cut.
---
[2026-10-16 13:58:12] Prefill batch, #new-seq: 1, #new-token: 1, #cached-token: 2998, token usage: 0.02, #running-req: 0, #queue-req: 0, #pending-token: 0, cuda graph: False, input throughput (token/s): 7.09
…
[2026-10-16 13:58:14] Prefill batch, #new-seq: 1, #new-token: 3031, #cached-token: 3, token usage: 0.02, #running-req: 0, #queue-req: 0, #pending-token: 0, cuda graph: False, input throughput (token/s): 1937.91
…
[2026-10-16 13:58:20] Prefill batch, #new-seq: 1, #new-token: 45, #cached-token: 2983, token usage: 0.02, #running-req: 0, #queue-req: 0, #pending-token: 0, cuda graph: False, input throughput (token/s): 225.19
```

The lessons on [prompt caching](phases/11-llm-engineering/15-prompt-caching) and on [caching and cost](phases/11-llm-engineering/11-caching-cost) show the same rule for hosted model APIs. Those APIs bill cached input tokens at a lower price.

```takeaways
- Put fixed content first and per-request content last in every prompt.
- Keep IDs, timestamps, and hashes out of the system prompt.
- Keep tool definitions and JSON keys in a fixed order.
- Turn on --enable-cache-report and read cached_tokens in responses.
- Check routing when the prompt is stable and the hit rate is still low.
```

Sources: python/sglang/srt/mem_cache/radix_cache.py (RadixKey, match_prefix), python/sglang/srt/managers/schedule_batch.py (_compute_max_prefix_len), python/sglang/srt/arg_groups/fields/serving.py (enable_cache_report), python/sglang/srt/entrypoints/openai/serving_chat.py at v0.5.22, capture/out/cache-experiment.txt, capture/out/server-default.log, capture/out/generate.txt, capture/out/metrics.txt, capture/out/no-radix-cache-metrics.txt, issue #35129, the Jarvislabs report of 2026-08-26.
