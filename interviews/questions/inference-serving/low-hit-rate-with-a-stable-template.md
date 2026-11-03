---
id: low-hit-rate-with-a-stable-template
title: Cached tokens at zero with a stable template
card: inference-serving
kind: debug
level: 2
roles: [inference-engineer, applied-ai-engineer, agentic-ai-engineer]
rounds: [debugging, screen]
tags: [prefix-cache, radix-cache, request-id, hit-rate, routing]
minutes: 8
lessons: [phases/17-infrastructure-and-production/06-sglang-radixattention]
manuals: [sglang-101#s-prefix-friendly-prompts]
practice: []
cheatsheet: []
related: []
updated: 2026-11-03
---

A team runs long agent sessions on SGLang with hierarchical caching on. Their dashboards show `#cached-token: 0` on requests that resend a long history. They have tuned the cache tiers and the write policy, and the hit rate barely moves. The prompt template looks stable to them. Where do you look first, and what do you expect to find?

## Short answer

Look at the first tokens of the request as the server sees them, not at the template. A relay or a chat template often adds something that changes on every request near the start, such as a request ID, a session hash or the date, and the tree matches from the first token and stops at the first difference. In the manual's incident a random hash in the system prompt cost 27.6 points of hit rate, and removing it moved the engine hit rate from 66.8 to 94.4 percent.

## Full answer

### Reproduce it with one identifier in three places

The manual's capture kit sends one 2,999-token system prompt and a short question, five times in each of three forms, with `--enable-cache-report` on so that each response reports its cached tokens:

| Form | Cached tokens | Prompt tokens | Median TTFT |
|---|---|---|---|
| stable system prompt | 2,998 | 2,999 | 45.1 ms |
| random ID at the start | 5 | 3,034 | 1,255.3 ms |
| the same ID at the end | 2,985 | 3,028 | 88.2 ms |

The ID at the start made the first token 28 times slower. The ID at the end cost 43 ms. The tokens are almost the same in the three forms; only their order differs. The ID at the start matched the 5 tokens before the random hex digits and nothing after them.

### Why nothing after a change can match

The attention values of every later token depend on every earlier token. A cache that reused the later tokens would return wrong answers. So the tree is exact, and a change in the system prompt invalidates everything behind it, while a change in the newest message invalidates only that message.

### The incident behind the question

The reporter found three causes stacked on each other:

1. The relay put a per-session random hash and a rotating system message into every request. Removing them moved the engine hit rate from 66.8 to 94.4 percent.
2. The client wrote its task-list snapshot at the end of the system prompt. Every task update changed the system prompt and invalidated more than 100,000 tokens of history behind it.
3. Hierarchical cache load-back, when it found no room, evicted the prefixes of other sessions. The reporter counted 250,000 evict calls against 376 completed load-backs.

The first fix was a prompt edit. No cache flag could have recovered the 27.6 points that the hash cost. The lesson tells the same story from another deployment, where moving dynamic content out of the cacheable prefix took the hit rate from 7 to 74 percent.

### The order of checks

1. Dump the exact token sequence of two consecutive requests and compare them from the first token. Include what the relay and the chat template add.
2. Read `cached_tokens` in the usage block with `--enable-cache-report`, or in `meta_info` of the native `/generate` route.
3. Read `#new-token` and `#cached-token` in the `Prefill batch` lines.
4. Read `sglang:cache_hit_rate` from `/metrics`.
5. With several servers, check routing. A request that lands on a server without its prefix misses whatever the prompt looks like. One report moved from 64.7 to 92.1 percent by routing each conversation to the same server.

Two server settings look like prompt problems. A request for prompt log probabilities from position k can reuse only the first k tokens. Different LoRA adapters never share tree nodes, because the adapter is part of the tree key.

## Follow-ups

- **Level 2:** The same random ID moves behind the fixed text instead. What does it cost now? Expected: about 45 tokens of prefill instead of about 3,027; in the experiment that was 43 ms more than the stable prompt instead of 28 times longer.
- **Level 3:** After the prompt fix, one server hits well and the fleet still misses. What next? Expected: routing; a request that lands on a server without its prefix misses, and routing each conversation to the same server moved one report from 64.7 to 92.1 percent.
- **Level 4:** The host tier still hurts other sessions after the prompt fix. What did the incident count, and what does it mean? Expected: 250,000 evict calls against 376 completed load-backs; a load-back that finds no room evicts other sessions from the GPU pool, so the pool size and the write policy need a look only after the prompt is fixed.

## Wrong answers

- "Raise the hierarchical cache ratio until the hit rate recovers." No cache flag can recover a miss that starts at token 5; the first fix was a prompt edit, worth 27.6 points of hit rate.
- "The template is stable, so the prompt is stable." The template is not what the server sees; a relay, a gateway or the chat template can insert a hash, a date or a snapshot, so compare the token sequences of two consecutive requests from the start.
- "A changed field in the middle only costs the tokens of that field." Every token after the change is a different branch of the tree, because the attention values of later tokens depend on every earlier token.

## Taught in

[Prefix-friendly prompts](../../../manuals/sglang-101/sections/3-4-prefix-friendly-prompts.md) has the three-form experiment and the incident, and [the RadixAttention lesson](../../../phases/17-infrastructure-and-production/06-sglang-radixattention/docs/en.md) states the ordering rule.
