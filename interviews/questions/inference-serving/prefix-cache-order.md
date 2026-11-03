---
id: prefix-cache-order
title: Why one ID at the top of a prompt kills the cache
card: inference-serving
kind: debug
level: 2
roles: [inference-engineer, applied-ai-engineer, agentic-ai-engineer]
rounds: [debugging, ml-depth]
tags: [prefix-cache, kv-cache, ttft, prompt-layout]
minutes: 8
lessons: [phases/17-infrastructure-and-production/06-sglang-radixattention]
manuals: [sglang-101#s-prefix-friendly-prompts, vllm-101#s-make-repeated-prompts-hit-the-prefix-cache]
practice: []
cheatsheet: [sglang-serving, serving-engines-compared]
related: [scenarios/prefix-cache-inflated-benchmark]
updated: 2026-11-03
---

Every request to your service starts with the same long system prompt, and the prefix cache is on. The server reports almost no cached tokens, and the first token is slow. Last week a teammate added a request ID to the start of the system prompt for tracing. What happened, and what do you change?

## Short answer

The prefix cache matches a prompt from its first token and stops at the first token that differs. A new ID at the start makes every later token a miss, so the server computes the whole prompt again on each request. Move the parts that never change to the front and put the ID after them. Then prove the fix with the cached-token counters.

## Full answer

### Why the position matters

The attention values of each token depend on every token before it. So a cache can reuse a token only when the whole prefix before it is the same. The SGLang radix tree compares tokens from the first one and stops at the first difference. vLLM does the same with blocks of 16 tokens. It caches only full blocks and stops at the first block that differs.

### What it costs

The SGLang manual measured one system prompt of 2,999 tokens in three layouts:

| Layout | Median TTFT | Median cached tokens |
|---|---|---|
| The same prompt every time | 45.1 ms | 2998.0 |
| A random ID at the start | 1255.3 ms | 5 |
| The same ID at the end | 88.2 ms | 2985 |

With the ID at the start, only the 5 tokens before the random digits matched. The first token took 28 times longer. With the ID at the end, the cost was 43 ms.

### The fix

1. Put the parts that never change first: the system prompt, the tool definitions and the fixed instructions.
2. Put the parts that change rarely next, such as the documents of one session.
3. Put the parts that change on every request last: the user question, the time and the request ID.
4. Send the trace ID in a header or a request field, not in the prompt text.

Check the chat template too. Some templates put the date into the system prompt.

### The proof

On vLLM, read `vllm:prefix_cache_hits` and `vllm:prefix_cache_queries` from `/metrics`. The hits divided by the queries is the hit rate. On SGLang, start the server with `--enable-cache-report` and read `usage.prompt_tokens_details.cached_tokens` in each response. A good layout shows almost every prompt token as cached after the first request.

## Follow-ups

- **Level 2:** The hit rate is still low after the fix. What is the next cause to check? Expected: a full pool, because the cache keeps old blocks only until a running request needs the memory.
- **Level 2:** Where in a chat request does a change cost the least? Expected: in the newest message, because the template puts it last, so only that message is computed again.
- **Level 3:** Two tenants send the same system prompt. What is the risk, and what is the control in vLLM? Expected: one tenant can learn from timing what the other sent. Send a different `cache_salt` for each tenant, so that their requests never share blocks.
- **Level 3:** A team tunes the cache tiers and the eviction policy, and the hit rate does not move. What do you check first? Expected: the prompt text, for a value that changes on each request near the start, such as a random hash or a timestamp.

## Wrong answers

- "Give the cache more memory." A bigger pool keeps more blocks, but a prompt that differs at the first tokens has no block to reuse.
- "The cache matches the longest shared part anywhere in the prompt." The cache matches only from the first token, so a shared part after a difference never hits.
- "Turn on hierarchical caching." A second tier stores more prefixes. It cannot match a prefix that is different on every request.

## Taught in

The [prefix-friendly prompts section](../../../manuals/sglang-101/sections/3-4-prefix-friendly-prompts.md) measures the three layouts, the [vLLM prefix cache section](../../../manuals/vllm-101/sections/3-2-make-repeated-prompts-hit-the-prefix-cache.md) gives the counters, and the [RadixAttention lesson](../../../phases/17-infrastructure-and-production/06-sglang-radixattention/) builds the radix tree.
