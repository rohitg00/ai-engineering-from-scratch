# How the block pool manages KV memory

> This page explains hash-keyed blocks, eviction, and KV groups for hybrid models.

vLLM started as a paper about one idea: store the KV cache in fixed-size blocks, the way an operating system stores memory in pages. When you finish this section, you can explain how vLLM finds a block again for a repeated prefix. You can also say which block leaves first.

## Blocks, not one buffer for each request

At startup, vLLM splits the KV cache into blocks of 16 tokens and keeps all of them in one pool. A request gets blocks one at a time as it grows. Its blocks do not need to be next to each other in memory. A small table maps the request's token positions to block numbers.

This removes the two wastes of a buffer for each request. No memory sits reserved for a length the request never reaches. No gaps form between requests of different lengths. The original paper called this PagedAttention.

## Finding a prefix again

When a block fills, vLLM computes a hash of its tokens together with the hash of the block before it. The chain means that one hash names a whole prefix, not only 16 tokens. The hash also covers other inputs that change the keys and values. These are the LoRA adapter, the images in the prompt, and an optional salt for each request.

A new request computes the same chain of hashes over its prompt. The engine looks each hash up in a map and stops at the first miss. Every block before the miss is a hit, and its tokens need no compute. Only full blocks are cached, so the last part of a prompt below 16 tokens is always computed.

Since version 0.11, the hash is SHA-256 by default. A faster hash exists as an option, but the documentation warns that a collision could return the wrong cache entries, or leak data between tenants.

```figure
id: fig-8-3
kind: structure
title: the block pool
claim: The KV cache is one pool of 16-token blocks that requests take in any order, mapped by a block table for each request.
caption: Coloured blocks belong to the request of the same colour. Dashed blocks are free. From the vLLM source at v0.31.0.
```

## Eviction

A block that no request uses goes to a free list, and it keeps its hash. A later request with the same prefix can still use it. When vLLM needs a new block, it takes the block at the head of the free list, which is the one unused the longest. Only then does the old content go away.

So the cache is the pool. No separate cache memory exists, and a busy server keeps fewer old prefixes than an idle one.

## Hybrid models get groups

A model with sliding-window layers or state-space layers does not keep one entry for each token in every layer. The engine puts each kind of layer in its own group. Each group has its own page size and its own rule for a cache hit. A sliding-window layer, for example, needs only the blocks inside the last window. The groups share one pool. [The long-context page](#s-serve-long-contexts-and-hybrid-models) covers what this means for your settings.

```takeaways
- The KV cache is one pool of 16-token blocks that requests take as they grow.
- A chain of hashes finds a repeated prefix, block by block.
- The block unused the longest leaves first, and only when a new block is needed.
```

Sources: the vLLM source at v0.31.0 (vllm/v1/core/kv_cache_manager.py, vllm/v1/core/block_pool.py, vllm/v1/core/kv_cache_utils.py, vllm/config/cache.py), vLLM documentation at v0.31.0 (docs/design/prefix_caching.md, docs/design/hybrid_kv_cache_manager.md), the PagedAttention paper (SOSP 2023).
