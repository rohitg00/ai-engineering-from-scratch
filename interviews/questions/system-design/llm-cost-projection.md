---
id: llm-cost-projection
title: Project the monthly bill of a chat feature
card: system-design
kind: estimate
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [system-design, screen]
tags: [cost, tokens, caching, unit-economics]
minutes: 10
lessons: [phases/11-llm-engineering/13-production-app]
manuals: []
practice: []
cheatsheet: [llm-cost-caching, production-llm-app]
related: [system-design/batched-inference-api-budget, system-design/streaming-and-fallback]
updated: 2026-11-03
---

A chat feature expects 10,000 daily active users with 5 queries each, about 1,500 input tokens and 400 output tokens per query, at $2.50 per million input tokens and $10.00 per million output tokens. Measured cache metrics give a 35% hit rate. Walk me through the monthly estimate, and say which number you would attack first.

## Short answer

The traffic is 50,000 queries a day, and a 35% cache hit rate leaves 32,500 that reach the model. Over 30 days that is $3,656 of input and $3,900 of output, about $7,556 a month, against $11,625 without the cache, so the cache saves about $4,070. Output tokens cost four times more per token, so after the hit rate the output length is the number to attack, with a maximum output tokens limit and tighter prompts.

## Full answer

### The sheet

| Variable | Value |
|---|---|
| Daily active users | 10,000 |
| Queries per user per day | 5 |
| Input tokens per query | 1,500 |
| Output tokens per query | 400 |
| Input price per million | $2.50 |
| Output price per million | $10.00 |
| Cache hit rate | 35% |
| Effective daily queries | 32,500 |

Input: 32,500 queries a day times 1,500 tokens times 30 days, divided by a million, times $2.50 gives $3,656. Output: the same with 400 tokens and $10.00 gives $3,900. The total is $7,556 a month.

### Why the cache matters this much

The same traffic without caching costs $11,625. A 35% hit rate removes 35% of the model calls, so it removes 35% of the token cost. The cache is an embedding lookup with a similarity threshold and a time to live, so two differently phrased versions of one question return one answer. The hit rate is measured from the cache metrics, not assumed.

### Which number to attack

- Hit rate first: every point of hit rate is a point off the whole bill.
- Output length second: output tokens are priced four times higher than input, and a maximum output tokens limit per template bounds the worst case.
- Input length third: the system prompt and retrieved context sit in every call; a provider-side cache of the fixed prefix and tighter retrieval cut it.
- Model routing last: a smaller model for simple templates cuts the per-token price, with an eval to prove quality holds.

### Where the estimate goes wrong

The averages hide a tail. A few users who paste long documents or run scripts can dominate the bill, which is why the production checklist tracks cost per user and per request, and why the cost alerting exercise moves a heavy user to a cheaper model past a daily threshold. The target in the lesson's dashboard is a cost per request under $0.01.

## Follow-ups

- **Level 2:** Which single metric on the dashboard tells you the estimate holds? Expected: cost per request, which combines token counts and prices and has a target under $0.01.
- **Level 2:** The cache hit rate drops to zero after a prompt template change. Why? Expected: the cache key is the query embedding and the response was generated with the old template; stale entries are invalid or the time to live cleared them.
- **Level 3:** How does prompt caching on the stable prefix change the input line? Expected: the system prompt and fixed instructions are billed at a discount when they repeat, so the effective input price per query falls without changing the token count.
- **Level 3:** What does a per-user daily cap protect that a per-request cost target does not? Expected: the total from one heavy user; many cheap requests still sum to a large bill.

## Wrong answers

- "Multiply users by a cost per user from a vendor page." The bill comes from tokens per query, queries per user and the hit rate; each is measured.
- "Caching saves money only on exact repeats." A semantic cache matches similar queries by embedding, which is why the hit rate reaches a third of traffic.
- "Input tokens dominate because there are more of them." At these prices and lengths the output line is larger even though there are fewer output tokens.

## Taught in

The [production LLM application lesson](../../../phases/11-llm-engineering/13-production-app/) works through this cost projection and the metrics dashboard.
