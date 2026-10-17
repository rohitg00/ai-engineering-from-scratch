# RadixCache

> RadixCache indexes every cached token run in a tree, so a new request reuses the longest matching prefix and prefills only the tokens after it.

A chat product sends the same 2,000-token system prompt with every question. A server without prefix reuse computes those 2,000 tokens for every request, and every user waits for the same work again. On our Mac, that repeated work made a shared-prefix benchmark take 129.7 seconds. With the radix cache on, the same benchmark took 48.8 seconds.

When you finish this section, you can explain how the tree finds a prefix and why a running request keeps its prefix. You can also say how eviction removes cached tokens. You can also read the scheduler log lines that prove a hit.

## The same workload with and without the tree

The capture kit runs SGLang's own shared-prefix benchmark twice. Four groups of 16 prompts share a 2,048-token system prompt per group, and each prompt adds a 128-token question. The second server starts with `--disable-radix-cache`.

| Result | Radix cache on | --disable-radix-cache |
|---|---|---|
| Benchmark duration | 48.81 s | 129.68 s |
| Median time to first token | 1,358 ms | 7,222 ms |
| P99 time to first token | 3,277 ms | 13,548 ms |
| Output tokens per second | 83.91 | 31.59 |

We measured a 2.7 times shorter run and a 5.3 times shorter median wait for the first token. The scheduler log shows where the time went.

```listing
title: one prefill batch with the radix cache
source: capture/out/server-default.log
lang: text
note: One line from the shared-prefix benchmark in the default configuration.
---
[2026-10-16 14:01:00] Prefill batch, #new-seq: 7, #new-token: 955, #cached-token: 15102, token usage: 0.05, #running-req: 1, #queue-req: 0, #pending-token: 0, cuda graph: False, input throughput (token/s): 1472.94
```

```listing
title: prefill batches without the radix cache
source: capture/out/server-no-radix-cache.log
lang: text
note: Three consecutive lines from the same benchmark with --disable-radix-cache.
---
[2026-10-16 14:02:34] Prefill batch, #new-seq: 3, #new-token: 4096, #cached-token: 0, token usage: 0.06, #running-req: 2, #queue-req: 3, #pending-token: 7883, cuda graph: False, input throughput (token/s): 2261.21
[2026-10-16 14:02:36] Prefill batch, #new-seq: 3, #new-token: 4096, #cached-token: 0, token usage: 0.08, #running-req: 4, #queue-req: 1, #pending-token: 3787, cuda graph: False, input throughput (token/s): 2245.89
[2026-10-16 14:02:38] Prefill batch, #new-seq: 2, #new-token: 3787, #cached-token: 0, token usage: 0.10, #running-req: 6, #queue-req: 0, #pending-token: 0, cuda graph: False, input throughput (token/s): 1626.02
```

With the tree, seven new requests needed 955 new tokens, and 15,102 tokens came from the cache. Without the tree, the scheduler filled three batches of up to 4,096 tokens for eight requests, all computed from zero. The 4,096 is the chunked prefill size from [section 2.2](#s-the-scheduler-loop-and-schedule-policy).

```figure
id: fig-3-3
kind: comparison
title: one benchmark, two cache settings
claim: The radix cache cut the shared-prefix benchmark from 129.7 to 48.8 seconds and the median first-token wait from 7,222 to 1,358 ms.
caption: Read each pair of bars left to right. Both runs used the same 64 prompts on the same Mac. From capture/out/bench-shared-prefix.txt and capture/out/no-radix-cache-bench-shared-prefix.txt.
```

## The same test on a 24 GB L4

A Mac makes every prefill slow, so we repeated the test on an NVIDIA L4 with `Qwen/Qwen3-8B`. This time we changed the length of the shared system prompt from 0 to 4,096 tokens. Each run had four groups of 16 prompts, a 128-token question, 64 output tokens, and a cap of eight concurrent requests. We ran three seeds per length.

```listing
title: prefill on the L4 with the radix cache
source: capture/gpu/out-l4/server-prefix-default.log
lang: text
note: Two lines from the run with a 2,048-token shared prompt. Timestamps are cut.
---
… Prefill batch, #new-seq: 3, #new-token: 405, #cached-token: 12952, token usage: 0.58, #running-req: 1, #queue-req: 0, #pending-token: 0, cuda graph: True, input throughput (token/s): 1452.28
… Prefill batch, #new-seq: 4, #new-token: 546, #cached-token: 17269, token usage: 0.58, #running-req: 4, #queue-req: 0, #pending-token: 0, cuda graph: True, input throughput (token/s): 2532.09
```

```listing
title: prefill on the L4 without the radix cache
source: capture/gpu/out-l4/server-prefix-no-radix-cache.log
lang: text
note: Two lines from the run with a 4,096-token shared prompt. Timestamps are cut.
---
… Prefill batch, #new-seq: 2, #new-token: 4096, #cached-token: 0, token usage: 0.68, #running-req: 1, #queue-req: 0, #pending-token: 5527, cuda graph: True, input throughput (token/s): 1632.42
… Prefill batch, #new-seq: 2, #new-token: 4096, #cached-token: 0, token usage: 0.74, #running-req: 2, #queue-req: 0, #pending-token: 1431, cuda graph: True, input throughput (token/s): 1634.70
```

The L4 prefills about 1,600 tokens per second. Each 4,096-token batch costs about 2.5 seconds, and without the tree every request pays for its full prompt.

```figure
id: fig-3-3c
kind: chart
title: The longer the shared prompt, the more the tree saves
claim: With a 4,096-token shared prompt on the L4, the radix cache cut the median TTFT from 14,706 to 479 ms.
caption: Median TTFT against the shared prompt length, three seeds per point, on a log scale. Green is the default and rose is --disable-radix-cache. From capture/gpu/summary/l4.json.
```

| Shared prompt | Median TTFT, cache on | Median TTFT, cache off | Output tok/s, cache on | Output tok/s, cache off |
|---|---|---|---|---|
| 0 | 349 ms | 379 ms | 113.56 | 113.33 |
| 1,024 | 462 ms | 2,202 ms | 105.76 | 70.15 |
| 4,096 | 479 ms | 14,706 ms | 88.87 | 20.80 |

**We measured** a 30.7 times shorter median wait and 4.3 times the throughput at 4,096 shared tokens. With no shared prompt, the median TTFT differed by 9 percent and the throughput was the same, so the tree cost almost nothing. The card was hot during the longest run without the cache, with a thermal throttle flag in 62 percent of its samples. That run would be a little faster on a cool card, but not 30 times faster.

The same sweep on the GB10 with `Qwen/Qwen3-30B-A3B-Instruct-2507` gave a smaller factor. At 4,096 shared tokens, the median TTFT was 589 ms with the tree and 5,208 ms without it, 8.8 times. The output rate was 120.66 against 49.73 tok/s. The server without the tree ran a day after the other one.

Our reading is that prefill was cheaper on the GB10. That model activates about 3 billion parameters per token, so each repeated prompt cost less to compute again. The tree saves the prefill that the workload repeats, and a model with cheap prefill has less of it to save.

## The tree

**RadixCache:** a radix tree over token sequences, whose nodes hold the KV slot indices of the tokens on their edges. The design comes from the SGLang paper, which calls the mechanism RadixAttention {{paper}}. A radix tree stores runs of tokens on its edges, so one node can hold a whole system prompt.

**TreeNode:** one node of the tree. It holds its children, keyed by their first token, and the token run on its edge {{code}}. It also holds the KV slot indices for those tokens, a lock count, a last-access time, and a hit count.

Four operations do all the work.

1. **match_prefix** walks from the root and follows the child whose first token matches. If the match ends inside an edge, it splits that node so the boundary is exact. Every node on the path gets a new access time.
2. **insert** walks the same way and adds a leaf for the tokens that did not match. If another request already inserted the same tokens, SGLang frees the duplicate slots and points the request at the tree's copy.
3. **inc_lock_ref** and **dec_lock_ref** count the running requests that use a node. A count above zero protects the whole path to the root.
4. **evict** frees leaves that no request locks, oldest first, and moves up the branch as leaves disappear.

One rule surprises people. A match can cover at most the prompt length minus one {{code}}. The last prompt token always goes through prefill, because the model needs its logits to sample the first output token. Our cache experiment shows that rule: a 2,999-token prompt reported 2,998 cached tokens and 1 new token.

```figure
id: fig-3-3b
kind: tree
title: two groups of the shared-prefix benchmark in one tree
claim: Two running requests share one system-prompt node, and the tree splits exactly where their questions start.
caption: Read from the root down. Numbers on nodes are lock counts while two requests of group 1 run. Mechanism from RadixCache at v0.5.22, token counts from the benchmark settings in capture/out/bench-shared-prefix.txt.
```

## Which tree you get at v0.5.22

The class name in old blog posts and issues is `RadixCache`. At v0.5.22 the default is `UnifiedRadixCache`, one tree that also handles sliding-window and Mamba state {{code}}. The tree walks run in a Rust core by default since v0.5.21. The log on our Mac shows the exception.

```listing
title: the tree on the capture Mac
source: capture/out/server-default.log
lang: text
note: Three lines from the startup log of the default configuration.
---
[2026-10-16 13:58:06] Using the Python TreeCore: the Rust TreeCore supports Linux only
[2026-10-16 13:58:06] Init Unified Radix Cache. Components: (<ComponentType.FULL: 0>,). Tree Core: UnifiedTreeCore
[2026-10-16 13:58:06] Tree cache initialized: source=default impl=UnifiedRadixCache hybrid_swa=False hybrid_ssm=False hicache_attached=False
```

The no-cache server printed the same three lines. `--disable-radix-cache` still builds `UnifiedRadixCache`, in a disabled mode that matches nothing and inserts nothing. The separate `ChunkCache` class that older posts describe was deleted on 2026-10-08 {{issue #43201}}.

## How the scheduler uses the tree

The default `--schedule-policy` is `fcfs`, first come, first served {{code}}. The paper's longest-prefix-match order, `lpm`, is a choice you make. The code sorts by prefix length only while 128 or fewer requests wait, because matching every waiting request costs time {{code}}. Above that, `lpm` uses the FCFS order.

The scheduler also avoids a waste inside one round. When several waiting requests share a prefix that is not cached yet, it lets one of them prefill the shared part first. The others reuse it in the next round. [Section 2.2](#s-the-scheduler-loop-and-schedule-policy) covers the policies in full.

## Our position: leave the radix cache on

The cache costs almost nothing when prompts do not repeat. Cached tokens live in the same pool as running requests, and eviction frees them on demand. We know of one reason to turn it off: to test whether a wrong answer comes from reused KV. Even then, try `--kv-canary log` first, which checks KV slots for corruption while the cache stays on {{code}}.

Then measure the hit rate together with every other feature you add. Issue #32459 is the warning {{issue #32459}}. A team that replayed multi-turn agent traffic saw a deep-prompt hit rate of 97 percent without speculative decoding, and 40 to 53 percent with EAGLE. Input throughput fell from 43,981 to 12,881 tokens per second, with no error in the logs. The candidate cause was the extra KV that speculative decoding reserves, which forced the tree to evict cached prompts.

Field reports put the folklore in proportion. vLLM also reuses prefixes, so engine comparisons measure two caches against each other. One independent test of 16 models on an A10G found SGLang ahead on repeated prefixes {{field Varad More 2026-04}}. The gain was 20 to 40 ms of first-token time at 7B to 9B. A RunPod test of a 70B model with a cached 7,000-token context measured 35.0 against 32.8 tokens per second per stream {{field RunPod 2025-06}}. The SGLang paper reports up to 6.4 times higher throughput {{paper}}, which is the authors' best case against the systems of 2024.

```takeaways
- Leave the radix cache on, and turn it off only to isolate a KV bug.
- Expect the gain to grow with the length of the shared prompt.
- Read #cached-token and #new-token in prefill lines to prove a hit.
- Expect the last prompt token to prefill, even on a full hit.
- Choose lpm only for offline batches with shared prefixes and short queues.
- Measure the hit rate again after you add speculative decoding.
```

Sources: python/sglang/srt/mem_cache/radix_cache.py (TreeNode, match_prefix, insert, evict, inc_lock_ref), python/sglang/srt/mem_cache/unified_radix_cache.py, python/sglang/srt/mem_cache/unified_cache/tree_core_registry.py, python/sglang/srt/mem_cache/registry.py, python/sglang/srt/managers/schedule_batch.py (_compute_max_prefix_len), python/sglang/srt/managers/schedule_policy.py, python/sglang/srt/arg_groups/fields/schedule.py at v0.5.22, capture/out/bench-shared-prefix.txt, capture/out/no-radix-cache-bench-shared-prefix.txt, capture/out/server-default.log, capture/out/server-no-radix-cache.log, capture/out/cache-experiment.txt, the SGLang paper (arXiv 2312.07104), issues #32459 and #43201, the RunPod report of 2025-06-15, the Varad More benchmark of 2026-04-22. capture/gpu/out-l4/server-prefix-default.log, capture/gpu/out-l4/server-prefix-no-radix-cache.log, capture/gpu/summary/l4.json. capture/gpu/summary/gb10.json.
