# Hybrid models and the cache

> Sliding-window and Mamba layers keep state that a token-level tree cannot split at any position, so hybrid models are where many reported cache failures sit at v0.5.22.

A team serves a hybrid model that mixes linear-attention layers with full-attention layers. They turn on HiCache and run twenty requests that hit the host tier. All twenty answers are fluent and on topic for a different prompt. The usage block reports full cached tokens, and nothing in the logs warns them.

When you finish this section, you can say why hybrid models break the simple picture of [the radix tree](#s-radixcache). You can also test the cache on your model before your users test it for you.

## Three kinds of layer state

The radix tree in [section 3.3](#s-radixcache) works because full attention stores one key and one value per token. A cached prefix of any length is valid, so the tree can split a node at any token. Two other kinds of layer break that rule.

**Sliding-window attention (SWA):** attention that reads only the last few thousand tokens. A SWA layer needs only the window, so SGLang keeps a smaller pool for SWA layers and drops KV that leaves the window. A cached prefix is useful only where the window's KV still exists.

**Mamba layer:** a state-space or linear-attention layer that keeps one fixed-size recurrent state per sequence, updated token by token. The state at token 2,000 summarizes all 2,000 tokens. It cannot be cut back to token 1,500. A prefix can resume only where SGLang saved a snapshot of the state.

Our capture model has neither. The startup log says so.

```listing
title: a model with only full-attention layers
source: capture/out/server-default.log
lang: text
note: Two lines from the startup log of the default configuration.
---
[2026-10-16 13:58:06] Tree cache initialized: source=default impl=UnifiedRadixCache hybrid_swa=False hybrid_ssm=False hicache_attached=False
…
[2026-10-16 13:58:08] Attention KV pool initialized: pool_size=181574 (buffer size 181575 incl. padding slot 0), 28 full-attention layers (0 sliding-window layers stay per-request), 8 kv_heads, 128 head_dim
```

Read these two lines on your own model first. `hybrid_swa=True` or `hybrid_ssm=True` means that everything in this section applies to you.

## How SGLang handles each kind

`UnifiedRadixCache` keeps one tree with a component for each kind of state {{code}}. Each node holds data for the full-attention component and, when needed, for the SWA and Mamba components. A match advances only while every component agrees that the state at that position is valid.

For SWA, the tree keeps a marker where window KV was dropped, and a match stops at the marker. `--swa-full-tokens-ratio` sets the size of the SWA pool against the full pool. It defaults to `None`, and model-specific overrides set it. The DeepSeek-V4 override sets it to 0.1 {{code}}.

For Mamba, the tree stores state snapshots on some nodes and copies a snapshot when a request reuses it. `--mamba-radix-cache-strategy` chooses how SGLang keeps snapshots: `auto` by default, `no_buffer`, `extra_buffer`, or `extra_buffer_lazy` {{code}}. `--mamba-track-interval` sets how often decode saves a snapshot, every 256 tokens by default.

```figure
id: fig-3-6
kind: tree
title: a Mamba prefix resumes only at a snapshot
claim: A new request that matches 1,800 tokens of a Mamba model resumes from the last snapshot at 1,792 tokens, and prefills 8 tokens.
caption: Read from the root down. Snapshots every 256 decode tokens follow the --mamba-track-interval default. The token counts are an example, not a capture.
```

## What goes wrong, in the issues

Many reported cache bugs at v0.5.22 involve hybrid models. We did not run a hybrid model ourselves. These four issues show the range.

1. **A wrong answer from a host-tier hit.** Issue #39830 is the opening story of this section {{issue #39830}}. A hybrid linear-attention model with HiCache gave fluent answers to a different prompt on 20 of 20 host-tier hits. Cold requests and GPU hits were correct.
2. **Zero reuse for an identical prompt.** In issue #22935, the match of a repeated prompt ends inside an edge, and the node split creates a node with no Mamba state {{issue #22935}}. The match stops at the last node with state, so the identical prompt reuses nothing.
3. **A strategy that makes the first token 4.7 times slower.** In issue #37834, an option forced the `no_buffer` strategy {{issue #37834}}. The snapshot sat at a depth that later requests could not reach. On a retrieval workload the hit rate fell from 88.2 to 65.9 percent. The mean time to first token rose from 226 ms to 1,063 ms.
4. **A default that slowed decode.** Issue #36131 reports a new default that frees SWA slots outside the window {{issue #36131}}. It reduced single-stream decode throughput for hybrid SWA models on DGX Spark and Thor.

## Our position: test the cache on a hybrid model before you trust it

On a full-attention model, a wrong cache hit is rare enough that we leave the cache on and move on. On a hybrid model, run three checks before production. Each one takes minutes.

1. **Correctness.** Send the same prompts cold, with a GPU hit, and, if you use HiCache, with a host-tier hit. Compare the outputs at temperature 0. Run `--kv-canary log` during the test, which checks KV slots for corruption and keeps the server running {{code}}.
2. **Reuse.** Repeat a prompt and read `#cached-token`. An identical prompt that shows a small count has hit the split problem of issue #22935.
3. **Latency.** Measure the time to first token with `--mamba-radix-cache-strategy auto` and with the strategy your deployment guide recommends. Keep the faster one only if the hit rate holds.

Then read the open issues for your model family before each upgrade. Between 2026-09-01 and the v0.5.22 tag, about 330 commits touched the cache code in `python/sglang/srt/mem_cache`. On hybrid models, a new release can fix one of these bugs and add another.

```takeaways
- Read hybrid_swa and hybrid_ssm in the startup log for every new model.
- Compare cold, GPU-hit, and host-hit outputs at temperature 0 before production.
- Run --kv-canary log during cache tests on hybrid models.
- Check that an identical prompt shows a high cached-token count.
- Read the open cache issues for your model family before each upgrade.
```

Sources: python/sglang/srt/mem_cache/unified_radix_cache.py, python/sglang/srt/mem_cache/unified_cache/components/README.md, python/sglang/srt/arg_groups/fields/exec_.py (mamba_radix_cache_strategy, mamba_track_interval), python/sglang/srt/arg_groups/fields/schedule.py (swa_full_tokens_ratio), python/sglang/srt/arg_groups/model_overrides/deepseek_v4.py, python/sglang/srt/arg_groups/fields/observability.py (kv_canary) at v0.5.22, capture/out/server-default.log, issues #39830, #22935, #37834, and #36131; the GitHub commit list for path python/sglang/srt/mem_cache since 2026-09-01 at tag v0.5.22 (333 commits, counted 2026-10-22)
