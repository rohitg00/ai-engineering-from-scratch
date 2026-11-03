---
id: shared-prefix-first
title: Why the shared part of the prompt goes first
card: inference-serving
kind: concept
level: 2
roles: [inference-engineer, applied-ai-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-depth]
tags: [prefix-cache, radix-cache, kv-cache, ttft, prompt-order]
minutes: 8
lessons: [phases/17-infrastructure-and-production/06-sglang-radixattention]
manuals: [vllm-101#s-make-repeated-prompts-hit-the-prefix-cache, sglang-101#s-prefix-friendly-prompts, sglang-101#s-radixcache]
practice: []
cheatsheet: []
related: [inference-serving/prefix-cache-order, inference-serving/low-hit-rate-with-a-stable-template]
updated: 2026-11-03
---

Every request to your chat service repeats the same long system prompt, and the engine has prefix caching on by default. What decides whether the next request reuses the work of the last one? How would you lay out the prompt, and how do you show a hit with a number instead of a guess?

## Short answer

The cache matches tokens from the first one onward and stops at the first difference, so a hit needs the same tokens in the same order at the start of the prompt. Put the parts that never change first, the parts that change per session next, and the question, the time and any request ID last. Prove the hit from the server: the `cached_tokens` field in the usage block, the `#cached-token` count in the prefill log line, or the prefix cache counters in `/metrics`.

## Full answer

### What a hit saves

On our L4 with Qwen/Qwen3-8B, vLLM 0.31.0 ran 4 groups of 16 prompts at 8 users. The prompts in a group shared a system prompt of the length in the table, then added a 128-token question and asked for 64 tokens back.

| Shared prompt tokens | Median TTFT, cache on | Median TTFT, cache off |
|---|---|---|
| none | 408 ms | 392 ms |
| 256 | 488 ms | 753 ms |
| 1,024 | 396 ms | 1,213 ms |
| 2,048 | 410 ms | 2,550 ms |
| 4,096 | 375 ms | 13,353 ms |

With the cache on, the first token took about 400 ms at every length. Without it, the first token grew with the shared part, because every request computed the whole prompt again. The 1,024 row is the cleanest comparison, because both runs held 1,410 MHz or more; there the cache cut the first token about 3 times and gave 50 percent more output. SGLang on the same card gave the same shape: 479 ms against 14,706 ms at 4,096 shared tokens, with the cache-off run throttled to 930 MHz.

### Why the order decides

The attention values of every token depend on every earlier token. A cache that reused tokens after a change would return wrong answers, so prefix caching is exact by design and unforgiving by the same design. In vLLM the match runs one 16-token block at a time and only full blocks are cached: a shared part of 20 tokens gives one cached block, and the last 4 tokens are computed every time. In SGLang the radix tree matches token by token, and the last prompt token always goes through prefill, because the model needs its logits to sample the first output token. A 2,999-token prompt reported 2,998 cached tokens.

### The order

1. The parts that never change: the system prompt, the tool definitions in a fixed order, the fixed instructions.
2. The parts that change rarely: the documents of one session, the earlier turns, sent unchanged.
3. The parts that change on every request: the user question, the time, the request ID.

Check the chat template too. Some templates put the date into the system prompt. A JSON object whose keys change order is a different token sequence.

### Prove the hit

- vLLM: `vllm:prefix_cache_hits_total` divided by `vllm:prefix_cache_queries_total` from `/metrics`, and the log line that prints `Prefix cache hit rate`, which read 87.2 percent in the middle of the shared-prefix run.
- SGLang: start with `--enable-cache-report` and read `cached_tokens` in the usage block, read `#cached-token` and `#new-token` in every `Prefill batch` line, or read the `sglang:cache_hit_rate` gauge, which read 0.94 after the shared-prefix benchmark and 0.0 with the cache off.

If the hit rate is low, the prompt order is almost always the cause. A full pool is the next cause, because the cache keeps old blocks only until a running request needs the memory. Routing is the third: with several servers, a request that lands on a server without its prefix misses whatever the prompt looks like, and one report moved its hit rate from 64.7 to 92.1 percent by routing each conversation to the same server.

### Keep tenants apart

Two users with the same prefix share blocks, and the timing of one can reveal what the other sent. A `cache_salt` field per tenant goes into the block key, so different salts never share. The LoRA adapter is part of the key too.

## Follow-ups

- **Level 2:** On vLLM every request starts with the same 20 tokens. How many come from the cache? Expected: 16, one full block; the last 4 are computed each time because only full blocks are cached.
- **Level 3:** The prompt is stable, one server hits well, and the fleet still misses. Name two causes outside the prompt. Expected: a full pool that drops blocks before the next request arrives, and a router that sends a session to a server which never saw its prefix; sticky routing moved one report from 64.7 to 92.1 percent.
- **Level 3:** Why does SGLang report 2,998 cached tokens for a 2,999-token prompt and never 2,999? Expected: the last prompt token always goes through prefill, because the model needs its logits to sample the first output token.
- **Level 4:** A client writes a task-list snapshot at the end of the system prompt and updates it on every turn. What does the tree do? Expected: every update changes the system prompt, so every token after it misses, including the whole history behind it; in the manual's incident that invalidated more than 100,000 tokens per turn, and the fix is to move the snapshot behind the history or into request metadata.

## Wrong answers

- "The cache is on, so repeated prompts hit it." The match is exact from the first token; a timestamp, a request ID or a reordered tool list near the start makes every later block miss, and one random ID at the start matched only 5 tokens of a 3,034-token prompt.
- "Put the user question first so the model reads it first." The question changes on every request, so the shared system prompt behind it never matches; put the fixed part first and the question last.
- "Turn the cache off for a fair benchmark." The cache is on in production, so the test must reset it between runs, not remove it; with it off the first token at 4,096 shared tokens took 13,353 ms on vLLM and 14,706 ms on SGLang.
- "Measure the hit rate from the response time of the client." Read it from the server, in the usage block, the prefill line or the counters; a faster second response can also come from a warmer GPU.

## Taught in

[Make repeated prompts hit the prefix cache](../../../manuals/vllm-101/sections/3-2-make-repeated-prompts-hit-the-prefix-cache.md), [Prefix-friendly prompts](../../../manuals/sglang-101/sections/3-4-prefix-friendly-prompts.md) and [RadixCache](../../../manuals/sglang-101/sections/3-3-radixcache.md) measure the cache on both engines, and [the RadixAttention lesson](../../../phases/17-infrastructure-and-production/06-sglang-radixattention/docs/en.md) gives the ordering rule.
