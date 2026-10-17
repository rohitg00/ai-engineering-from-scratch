# Eviction policies and HiCache

> When the GPU pool is full, SGLang evicts the least recently used prefix by default, and HiCache keeps evicted prefixes in host memory and in optional storage.

A coding agent holds a session of eight turns, and its history grows past 25,000 tokens. The GPU pool holds a few dozen such sessions. The ninety-first user arrives, and SGLang must evict a cached prefix to make room. When the first user returns, their history is gone, and the server computes all 25,000 tokens again.

When you finish this section, you can choose an eviction policy from a measured hit rate. You can also decide when hierarchical caching pays for its cost and which of its settings to change first.

## What eviction removes

Eviction removes only cached tokens that no running request locks, the leaves of [the radix tree](#s-radixcache). It never removes the KV of a running request. That case is retraction, and [section 2.3](#s-admission-and-retraction) covers it. Eviction starts from the leaves with the lowest score and moves toward the root.

`--radix-eviction-policy` decides the score {{code}}. The default is `lru`.

| Policy | Evicts first | When it helps |
|---|---|---|
| `lru` | the prefix with the oldest last access | most workloads, the default |
| `lfu` | the prefix with the fewest hits, then the oldest | a hot set of prompts that stays stable for hours |
| `slru` | prefixes with fewer than 2 hits, then the oldest | a stable hot set with a stream of one-time prompts |
| `priority` | prefixes of lower-priority requests | mixed traffic with request priorities |
| `tlru` | history that cannot change the next turn's prefill time | multi-turn agents with a tail-latency target |

**Tail-Optimized LRU (tlru):** a policy that keeps only the part of a conversation that the next turn's latency target needs, and evicts the rest first. It comes from a paper that the code names, arXiv 2510.15152. The SGLang team reports 43.9 percent lower p99 inter-token latency on DeepSeek-V4-Pro at concurrency 32 {{team 2026-10}}. That number comes from the release notes of v0.5.21, and we found no independent test of it.

## Our position: keep lru until you have measured a reason

The SGLang docs give the same advice: start with `lru` and change it only against a measured hit rate {{docs}}. Frequency-based policies hurt when popularity shifts, because yesterday's popular prompt stays in memory and today's prompt pays for it. Change the policy only when you can name the workload that the new policy serves, and measure the hit rate before and after.

## HiCache: three tiers for one tree

**HiCache:** SGLang's hierarchical cache, which extends the radix tree from GPU memory to host memory and to a storage backend. `--enable-hierarchical-cache` turns it on, and it defaults to off {{code}}. The tiers have names in the code and the docs.

- **L1:** the GPU pool from [section 3.1](#s-kv-bytes-per-token-and-the-kv-pool).
- **L2:** a pool in pinned host memory, private to one server instance.
- **L3:** an optional storage backend shared across instances, set with `--hicache-storage-backend`. The choices include `file`, `mooncake`, `hf3fs`, and `nixl`.

The tree records where the KV of each node lives. A match returns a GPU hit and a host hit length. SGLang then loads the host part back into fresh GPU slots, one layer ahead of the computation that needs it {{docs}}.

`--hicache-write-policy` decides when a node gets a copy in host memory. The default is `write_through`. The code sets a hit threshold of 1 for `write_through` and 2 for `write_through_selective` {{code}}. So `write_through` copies a prefix on its first hit, and `write_through_selective` waits for a second hit. `write_back` copies a node only when the GPU evicts it.

```figure
id: fig-3-5
kind: flow
title: one prefix through the three HiCache tiers
claim: Under write_through, a prefix gets a host copy on its first hit, so GPU eviction no longer forces a full prefill.
caption: Read left to right for writes and right to left for load-back. Thresholds and defaults from UnifiedRadixCache at v0.5.22.
```

## The settings that decide whether it helps

L3 prefetch has its own rules. SGLang skips a storage prefetch when the storage hit is shorter than 256 tokens {{code}}. The default prefetch policy is `timeout`, which stops waiting for storage after a time that grows with the prompt.

The docs and the code disagree on that time. The docs give a base of 2 seconds, 0.1 seconds per 1,024 tokens, and a maximum of 30 seconds {{docs}}. The code at v0.5.22 uses a base of 1.0 second and 0.25 seconds per 1,024 tokens {{code}}. We found no maximum in the cache code. The code wins. A 100,000-token prompt can wait about 25 seconds for storage before SGLang computes it again.

The host pool size comes from `--hicache-ratio` or `--hicache-size`. Without either, SGLang takes up to `--hicache-host-memory-fraction`, which defaults to 0.8 of available host memory {{code}}.

## What other teams measured

We could not run HiCache on the capture Mac, and the field evidence is thin. The next section has our own test on an L4. The numbers we found come from the SGLang team and its partners.

- The SGLang RBG team and the Mooncake team ran a multi-turn benchmark on Kubernetes {{field Alibaba Cloud 2026-03}}. The average time to first token was 5.91 seconds with GPU memory only. The L2 tier lowered it to 3.77 seconds, and a Mooncake L3 lowered it to 2.58 seconds.
- The SGLang HiCache post quotes Novita {{team 2025-09}}. Novita reported a 56 percent lower average time to first token, and a hit rate that rose from 40 to 80 percent.

The failure reports are better documented than the successes. In issue #35129, load-back that found no room evicted other sessions' GPU prefixes, with 250,000 evict calls against 376 completed load-backs {{issue #35129}}. Issue #30760 shows one tensor-parallel rank waiting forever in a prefetch check while the other ranks moved on {{issue #30760}}. Issue #42465 shows bursts of 540,000-token prompts that hang every rank with HiCache on and run without it {{issue #42465}}.

## What we measured on an L4

We tested L2 on one 24 GB L4 with `Qwen/Qwen3-8B`. Each group of 8 requests shared one 2,048-token system prompt and added a 64-token question. We changed the number of groups from 4 to 64, kept a cap of 8 concurrent requests, and ran three seeds per point. The second server added `--enable-hierarchical-cache --hicache-ratio 4`.

The GPU pool held 24,094 tokens, about 11 system prompts. So at 16 groups or more, the default server had to evict prompts that it would need again.

```listing
title: the host tier on the L4
source: capture/gpu/out-l4/server-working-set-hicache.log
lang: text
note: The host pool at startup, then two prefill lines from the 64-group run.
---
[2026-10-17 17:35:15] Allocating kv hierarchical KV host pool: 96377 tokens, 14.21 GB host memory.
[2026-10-17 18:19:03] Prefill batch, #new-seq: 4, #new-token: 4096, #cached-token: 2196, token usage: 0.65, #running-req: 2, #queue-req: 0, #pending-token: 5234, cuda graph: True, input throughput (token/s): 1431.87
[2026-10-17 18:19:03] Prefill batch, #new-seq: 3, #new-token: 953, #cached-token: 4281, token usage: 0.65, #running-req: 5, #queue-req: 0, #pending-token: 0, cuda graph: True, input throughput (token/s): 1251.76
```

```listing
title: the same workload with the GPU pool only
source: capture/gpu/out-l4/server-working-set-default.log
lang: text
note: Two prefill lines from the 64-group run of the default server.
---
[2026-10-17 17:34:02] Prefill batch, #new-seq: 3, #new-token: 4096, #cached-token: 0, token usage: 0.65, #running-req: 5, #queue-req: 0, #pending-token: 1138, cuda graph: True, input throughput (token/s): 1573.58
[2026-10-17 17:34:03] Prefill batch, #new-seq: 1, #new-token: 1138, #cached-token: 0, token usage: 0.65, #running-req: 7, #queue-req: 0, #pending-token: 0, cuda graph: True, input throughput (token/s): 1347.58
```

```figure
id: fig-3-5c
kind: chart
title: HiCache held the prompts that the GPU pool evicted
claim: At 32 distinct system prompts on the L4, HiCache cut the median TTFT from 5,449 to 817 ms.
caption: Median TTFT against the number of distinct system prompts, three seeds per point, on a log scale. Rose is the GPU pool only and green adds the host tier. From capture/gpu/summary/l4.json.
```

| Groups | Prompt tokens to keep | Median TTFT, GPU only | Median TTFT, HiCache | Output tok/s, GPU only | Output tok/s, HiCache |
|---|---|---|---|---|---|
| 4 | 8,192 | 360 ms | 361 ms | 82.39 | 81.64 |
| 16 | 32,768 | 3,259 ms | 553 ms | 37.95 | 74.75 |
| 32 | 65,536 | 5,449 ms | 817 ms | 25.72 | 69.29 |
| 64 | 131,072 | 6,821 ms | 3,610 ms | 21.37 | 35.93 |

**We measured** no cost at 4 groups, when every prompt fit on the GPU. At 32 groups the host tier cut the median wait 6.7 times and served 2.7 times the throughput. At 64 groups, the prompts needed more than the GPU and host pools held together, about 120,000 tokens. HiCache still halved the wait, but it was no longer near the 4-group result.

The card was hot in these runs. From 16 groups up, 52 to 95 percent of the samples had the thermal flag set, on both servers. The default server recomputed more and ran hotter, so part of its loss is the clock. The cache hit lines above do not depend on the clock.

The GB10 ran the same workload as a control, without HiCache. We left the host tier off there. The GB10 has one memory for the CPU and the GPU, so a host copy would take memory from the same place as the pool.

```listing
title: the GB10 pool and two prefill lines from the 64-group run
source: capture/gpu/out-gb10/server-working-set-default.log
lang: text
note: The pool at startup, then two consecutive prefill lines. Long lines are cut.
---
[2026-10-17 19:33:31] KV Cache is allocated. dtype: torch.bfloat16, #tokens: 260013, K size: 11.90 GB, V size: 11.90 GB
[2026-10-17 19:52:36] Prefill batch, #new-seq: 1, #new-token: 67, #cached-token: 2196, token usage: 0.01, #running-req: 0, #queue-req: 0, #pending-token: 0, cuda graph: True, input throughput (token/s): 29.36
[2026-10-17 19:52:36] Prefill batch, #new-seq: 7, #new-token: 476, #cached-token: 15146, token usage: 0.06, #running-req: 1, #queue-req: 0, #pending-token: 0, cuda graph: True, input throughput (token/s): 1605.53
```

Its pool held 260,013 tokens, room for all 64 system prompts at once. The second prefill line found 15,146 tokens in the cache for 7 new requests. The median TTFT stayed between 448 and 460 ms from 4 groups to 64. Nothing was evicted, so there was nothing for a host tier to bring back.

The rule from this test is the size of your working set. Add up the distinct prefixes that your users come back to within a few minutes. When that sum is larger than the GPU pool, the host tier pays for itself. When it is smaller, it adds a copy for nothing.

## Our position: add HiCache for long sessions, and add it in steps

HiCache pays for itself when sessions outlive the GPU pool: multi-turn chat, coding agents, and long documents asked several times. For short one-time prompts it adds copies and load-backs with nothing to reuse. Add it in this order, and measure the hit rate and the p99 time to first token at each step.

1. Make prompts prefix-stable first, as in [section 3.4](#s-prefix-friendly-prompts).
2. Turn on L2 only, with the default `write_through`.
3. Switch to `write_through_selective` if host copies use too much PCIe bandwidth.
4. Add an L3 backend when several instances should share prefixes.
5. Change the eviction policy last.

```takeaways
- Add the host tier when your repeated prefixes are larger than the GPU pool.
- Keep lru until a measured hit rate shows a reason to change it.
- Turn on HiCache for long multi-turn sessions, not for one-time prompts.
- Start HiCache with host memory only, then add storage after you measure.
- Trust the code's prefetch timeouts over the docs at v0.5.22.
- Watch for evict storms and rank hangs in the issues before you deploy HiCache.
```

Sources: python/sglang/srt/mem_cache/evict_policy.py, python/sglang/srt/mem_cache/unified_radix_cache.py (write_through_threshold, prefetch_timeout_base), python/sglang/srt/mem_cache/hybrid_cache/hybrid_pool_assembler.py (prefetch_threshold), python/sglang/srt/arg_groups/fields/memory.py at v0.5.22, docs/docs/advanced_features/hicache_design.mdx and radix_eviction_policy.mdx at v0.5.22, the v0.5.21 release notes, the SGLang HiCache post of 2025-09-10, the RBG and Mooncake post on the Alibaba Cloud blog of 2026-03-10, issues #35129, #30760, and #42465, arXiv 2510.15152. capture/gpu/out-l4/server-working-set-hicache.log, capture/gpu/out-l4/server-working-set-default.log, capture/gpu/summary/l4.json. capture/gpu/summary/gb10.json. capture/gpu/out-gb10/server-working-set-default.log.
