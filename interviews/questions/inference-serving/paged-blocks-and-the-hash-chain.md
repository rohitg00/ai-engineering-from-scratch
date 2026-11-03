---
id: paged-blocks-and-the-hash-chain
title: Why the KV cache is a pool of 16-token blocks
card: inference-serving
kind: concept
level: 2
roles: [inference-engineer]
rounds: [ml-depth, system-design]
tags: [kv-cache, paged-attention, block-table, prefix-cache, preemption]
minutes: 8
lessons: [phases/17-infrastructure-and-production/04-vllm-serving-internals]
manuals: [vllm-101#s-how-the-block-pool-manages-kv-memory, vllm-101#s-why-one-token-budget-replaces-a-prefill-phase]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

Explain how vLLM keeps the KV cache in GPU memory. Why does it not give each request its own buffer, how does it recognize a prompt it has seen before, and what happens when the memory runs out?

## Short answer

The KV cache is one pool of 16-token blocks, and a request takes blocks one at a time as it grows, mapped by a small block table. A buffer per request wastes memory twice: on length that the request never reaches, and on gaps between requests of different sizes. Each full block gets a hash that is chained with the hash of the block before it, so one hash names a whole prefix, and a new request walks its chain and stops at the first miss. When no block is free, the scheduler preempts the newest request and computes it again later.

## Full answer

### Blocks, not buffers

At startup vLLM splits the cache into blocks of 16 tokens and keeps all of them in one pool. The blocks of a request do not need to be next to each other. A block table maps the token positions of the request to block numbers. The original paper called this PagedAttention, after the way an operating system pages memory.

The lesson gives the size of the waste that this removes. A classic allocator that reserves the full length for every request loses 60 to 80 percent of the memory to fragmentation. With blocks the waste stays under 4 percent. For a 70B model at 8192 tokens, one reserved sequence is about 1.25 GB in BF16, and a request that uses 1500 tokens wastes about 82 percent of it.

### The hash chain

When a block fills, vLLM hashes its tokens together with the hash of the block before it. The chain means that one hash names a whole prefix, not only 16 tokens. The hash also covers the other inputs that change the keys and values: the LoRA adapter, the images in the prompt, and an optional salt for each request. A new request computes the same chain over its prompt and looks each hash up in a map. Every block before the first miss is a hit and needs no compute. Only full blocks are cached, so the tail of a prompt below 16 tokens is always computed.

Since version 0.11 the hash is SHA-256 by default. A faster hash exists, and the documentation warns that a collision could return the wrong blocks or leak data between tenants.

### Eviction

A block that no request uses goes to a free list and keeps its hash. A later request with the same prefix can still use it. When vLLM needs a new block, it takes the head of the free list, the block unused the longest. Only then does the old content go away. So the cache is the pool: no separate cache memory exists, and a busy server keeps fewer old prefixes than an idle one.

### When memory runs out

A running request needs a new block every 16 tokens. If none is free, the scheduler preempts a request. Under the default first-come policy it picks the newest running request, frees all of its blocks, and puts it back at the head of the waiting queue. When the request runs again, vLLM computes its tokens again from the start. Older versions could also copy blocks to CPU memory and back; the current engine only recomputes, because the documentation judges that cheaper. The cost shows as a longer time for the preempted request and in the `vllm:num_preemptions` counter.

### Hybrid models

A model with sliding-window or state-space layers does not keep one entry per token in every layer. Each kind of layer gets its own group with its own page size and its own rule for a hit. The groups share one pool.

## Follow-ups

- **Level 2:** Every request starts with the same 25 tokens. How many of them come from the cache? Expected: 16, one full block; the last 9 tokens are computed on every request because only full blocks are cached.
- **Level 3:** Two tenants send the same system prompt. What can one learn about the other, and what field stops it? Expected: they share blocks, so the timing of one tenant can reveal what the other sent; a cache_salt per tenant goes into the hash, so the two never share a block.
- **Level 4:** Under the default policy, which request does vLLM preempt when no block is free, and what does it cost? Expected: the newest running request; all of its blocks are freed, it goes to the head of the waiting queue, and its tokens are computed again from the start, which the preemption counter records.

## Wrong answers

- "vLLM swaps preempted requests to CPU memory." Older versions could; the current engine only recomputes, because the documentation judges the recompute cheaper, and the cost shows in the time of that request and in the preemption counter.
- "The prefix cache has its own memory budget." The cache is the pool; a freed block keeps its hash on the free list until a new block is needed, so a busy server keeps fewer old prefixes than an idle one.
- "A block hash covers only its own 16 tokens." It is chained with the hash of the block before it, so one hash names a whole prefix, and it also covers the adapter, the images and the salt.

## Taught in

[How the block pool manages KV memory](../../../manuals/vllm-101/sections/8-3-how-the-block-pool-manages-kv-memory.md) explains the pool, [the token budget section](../../../manuals/vllm-101/sections/8-2-why-one-token-budget-replaces-a-prefill-phase.md) covers preemption, and [the serving engine internals lesson](../../../phases/17-infrastructure-and-production/04-vllm-serving-internals/docs/en.md) gives the fragmentation numbers.
