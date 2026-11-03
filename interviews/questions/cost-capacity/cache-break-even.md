---
id: cache-break-even
title: How many reads a cached prefix needs to pay off
card: cost-capacity
kind: estimate
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer, inference-engineer]
rounds: [screen, system-design]
tags: [prompt-caching, break-even, ttl, cost]
minutes: 8
lessons: [phases/11-llm-engineering/15-prompt-caching, phases/17-infrastructure-and-production/14-prompt-semantic-caching]
manuals: []
practice: []
cheatsheet: [llm-cost-caching]
related: [cost-capacity/two-cache-layers, cost-capacity/parallel-calls-miss-the-cache]
updated: 2026-11-03
---

Your provider charges a 25 percent premium to write a prefix into its cache, and it bills a cache read at a tenth of the normal input price. The cache lives for five minutes. A one-hour variant costs twice the normal input price to write. How many reads does each variant need to pay off, and what rule do you give the team?

## Short answer

With the five-minute cache, one write and one read average 0.675 of the normal cost per request, a saving of about 32 percent, so the cache pays off on the first read. One write and ten reads average 0.205, about 80 percent saved. The one-hour cache charges 2x for the write, so that block needs two reads before it comes out ahead. The rule: cache anything you expect to reuse at least three times inside its lifetime.

## Full answer

### The arithmetic

A write costs 1.25 times the normal input price, and a read costs 0.1 times it.

- One write and one read: the two requests average 0.675 of the normal price. That is 32 percent saved on the first read already.
- One write and ten reads: the requests average 0.205 of the normal price, about 80 percent saved.
- The one-hour cache writes at 2 times the normal price. With one read the average sits above the normal price, and with two reads it falls below. The lesson says the one-hour block pays back fast on any batch that reuses the prefix more than five times.

Three reuses inside the lifetime clear the break-even on either variant, which is the rule the lesson gives.

### What breaks the arithmetic

- A prefix that differs by one token on every request, because of a timestamp, a request id or a reshuffled tool list. Every request writes and none reads.
- A block below the minimum cacheable size, which is 1,024 tokens on the provider in the lesson. A smaller block silently does not cache.
- Requests that arrive in parallel before the first write has landed. Each one pays the write premium, and none reads.

### Verify it

Read the usage fields on every response: the tokens written to the cache and the tokens read from it. In CI, assert that the second identical request reads more than zero. On the dashboard, split input tokens into cached and uncached, or a traffic drop will look like a cache win.

## Follow-ups

- **Level 2:** Why does the five-minute cache pay off on the first read? Expected: the write premium is a quarter and the read saves nine tenths, so the two together already average below the normal price.
- **Level 2:** When does the one-hour cache make sense? Expected: a batch job that reuses the prefix across runs more than five minutes apart, more than five times.
- **Level 3:** Input tokens are down and the bill is flat. What is wrong with the dashboard? Expected: it does not split cached from uncached input, so a drop in traffic looks like a cache win.
- **Level 3:** Ten parallel requests share a prefix that nobody has cached yet. What happens to the arithmetic? Expected: all ten pay the write premium and none reads, so the cache costs more than no cache. Send one request first, then the rest.

## Wrong answers

- "Caching always saves money." A prefix written once and never read costs 25 percent more than no cache.
- "Pick the one-hour cache, it lasts longer." It writes at twice the normal input price, so a block read once costs more than without the cache.
- "Mark the whole prompt as cacheable." The user message changes every time, so the match ends at the first differing token, and a block below the minimum size does not cache at all.

## Taught in

The [prompt caching lesson](../../../phases/11-llm-engineering/15-prompt-caching/) gives the break-even arithmetic and the verification fields, and the [caching economics lesson](../../../phases/17-infrastructure-and-production/14-prompt-semantic-caching/) names the parallel-write trap.
