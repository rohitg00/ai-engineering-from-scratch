# sgl-model-gateway and cache-aware routing

> With several servers, the router decides your cache hit rate, so send each conversation back to the server that already holds its prefix.

You start a second server to double capacity. Throughput rises, but time to first token gets worse for long conversations. Each server has its own KV cache, and turn 5 of a chat goes to the server that never saw turns 1 to 4. That server prefills the whole history again. [Section 3.4](#s-prefix-friendly-prompts) measured what a prefix miss costs on one server. A router that ignores prefixes makes the same miss on purpose.

When you finish this section, you can explain how `sgl-model-gateway` picks a server for each request. You can also choose a routing policy for your traffic and check that the gateway keeps your hit rate.

## Two places where requests get routed

SGLang routes requests in two places, with different defaults.

**Inside one server:** with `--dp-size` above 1, a data parallel controller gives requests to the copies. Its default method, `auto`, resolves to `round_robin` outside disaggregation {{code}}. Round robin ignores prefixes, as [figure 6.1b](#fig-6-1b) shows.

**In front of servers:** `sgl-model-gateway` is a separate Rust program that routes to many SGLang servers. It was named `sgl-router` until pull request [#14312](https://github.com/sgl-project/sglang/pull/14312) renamed it on 2025-12-05, for "less confusion". Its default policy is `cache_aware` {{code}}.

A field report shows the difference. Jarvislabs found that the default routing sends each request to the next GPU in turn. It does not look at where the cache of a conversation is {{field Jarvislabs 2026-08}}.

On their traffic, 23 percent of input tokens were computed again. One request header that pinned each conversation to one GPU raised their cache hit rate from 64.7 to 92.1 percent and halved median TTFT. Their [post](https://jarvislabs.ai/blog/managed-endpoints) does not name the component that did the round robin. The in-server default matches their description.

## How cache_aware picks a server

The gateway keeps one approximate radix tree per model. Each tree node records which servers have seen that prefix. The tree stores characters of the request text, not tokens, so the gateway never runs a tokenizer to route {{code}}.

**Match rate:** the number of characters of a new request that match the tree, divided by the request length.

```figure
id: fig-6-4
kind: decision
title: how cache_aware picks a server
claim: The gateway checks load balance first, then sends a request to the server with the longest match only when more than 30 percent of its text matches.
caption: Read top to bottom. Amber boxes are tests, blue boxes are outcomes, and both outcomes insert the request text into the tree. Defaults from the gateway command line at v0.5.22.
```

For each request, `select_worker` does three things {{code}}:

1. It checks balance. The system is imbalanced when two tests pass. The busiest server's load is more than 64 above the lightest, and more than 1.5 times the lightest. Then the request goes to the least-loaded server.
2. Otherwise it computes the match rate. Above 0.3, the request goes to the server with the longest match.
3. Below 0.3, the request goes to the least-loaded server, with a random choice among ties.

The gateway then inserts the request text under the chosen server. Every 120 seconds, a background task removes least recently used leaves until each tree is at most 67,108,864 nodes {{code}}.

A comment at the top of the policy file says that a low match goes to "the worker with smallest tree size". The code sends it to the least-loaded worker. The code wins, and this manual describes the code.

## The tree is a guess

The gateway never asks a server what it caches. Its tree records where it sent text, and a server can evict that prefix later. So the gateway can send a request to a server that no longer holds its prefix. That request then prefills like any other miss. Check the hit rate on the servers, with `sglang:cache_hit_rate` from [section 5.2](#s-the-metrics-endpoint), and not only the routing decisions.

## Settings that matter

| Flag | Default | Effect |
|---|---|---|
| `--policy` | `cache_aware` | also `random`, `round_robin`, `power_of_two`, `prefix_hash`, `manual` |
| `--cache-threshold` | 0.3 | the match rate above which prefix affinity wins |
| `--balance-abs-threshold` | 64 | the load gap that marks the system as imbalanced |
| `--balance-rel-threshold` | 1.5 | the load ratio that marks the system as imbalanced |
| `--eviction-interval` | 120 | seconds between tree cleanups |
| `--max-tree-size` | 67108864 | tree nodes kept per model |
| `--prometheus-port` | 29000 | the gateway's own metrics |
| `--request-timeout-secs` | 1800 | the longest request the gateway waits for |

All defaults come from the gateway source in the v0.5.22 release {{code}}. That source says version 0.3.2. The newest gateway tag in the repository, `gateway-v0.3.1`, points at a commit from 2026-01-08. Pin the gateway by the commit you run, not by that tag.

The source also has `bucket` and `consistent_hashing` policies. The command line does not accept them at v0.5.22. For two plain servers, the start command is `python -m sglang_router.launch_router --worker-urls http://127.0.0.1:30000 http://127.0.0.1:30001 --policy cache_aware`.

## Our position

Use `cache_aware` for chat and agent traffic, where turns share long prefixes. Use `power_of_two` or `round_robin` for batch traffic with unique prompts, because a match rate under 0.3 gives no affinity anyway. Do not put multi-turn traffic behind in-server `--dp-size` with its round robin default. Run separate servers behind the gateway, or set a different `--load-balance-method`.

The SGLang team introduced the cache-aware router in v0.4 {{team 2024-12}}. They reported up to 1.9 times more throughput and a 3.8 times better hit rate. Those are their numbers on their workload. Measure your own hit rate before and after.

## Pin the router with the engine

A user reported a two times throughput regression in SGLang on GB200 NVL72 with DeepSeek-R1 ([issue #22095](https://github.com/sgl-project/sglang/issues/22095)). The regression was in the router outside SGLang. With the same SGLang build, Dynamo router 0.8.1 gave 132,140 tokens per second and Dynamo router 1.0.0 gave 69,767. Benchmark the router and the engine as one system, and pin both versions.

A second incident shows that routing and service discovery interact. With disaggregation and Kubernetes service discovery, `cache_aware` failed with "Failed to select prefill/decode worker", and users switched to round robin ([issue #10608](https://github.com/sgl-project/sglang/issues/10608)). The issue was closed, and we could not find the fix that closed it. Test your exact deployment mode before you depend on a policy.

## What to measure

Compare `sglang:cache_hit_rate` on every server before and after you change the policy. Watch the gateway's metrics on port 29000 for retries and open circuits. The gateway retries a failed request up to 5 times by default, and it opens a server's circuit after 10 failures {{code}}. A rising TTFT with a falling hit rate means that requests no longer reach the server that holds their prefix. For a broader view of gateways in production, see the lesson on [AI gateways](phases/17-infrastructure-and-production/19-ai-gateways).

```takeaways
- Put several SGLang servers behind sgl-model-gateway with the cache_aware policy for chat traffic.
- Avoid in-server round robin data parallelism for multi-turn conversations.
- Use power_of_two or round_robin when prompts share no long prefix.
- Check sglang:cache_hit_rate on the servers, because the gateway tree is a guess.
- Benchmark and pin the router and the engine together.
```

Sources: sgl-model-gateway/src/main.rs, sgl-model-gateway/src/policies/cache_aware.rs, sgl-model-gateway/Cargo.toml, python/sglang/srt/arg_groups/serving_hook.py (handle_load_balance_method), and python/sglang/srt/managers/data_parallel_controller.py, all at v0.5.22. Pull request #14312, issues #22095 and #10608. Jarvislabs, "Managed Endpoints", 2026-08-26. LMSYS, "SGLang v0.4", 2024-12-04.
