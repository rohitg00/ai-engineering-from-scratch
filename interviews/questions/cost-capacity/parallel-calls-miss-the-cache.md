---
id: parallel-calls-miss-the-cache
title: Ten parallel tool calls, ten cache writes, no reads
card: cost-capacity
kind: debug
level: 2
roles: [applied-ai-engineer, forward-deployed-ai-engineer, inference-engineer]
rounds: [debugging, ml-breadth]
tags: [prompt-caching, agents, fan-out, cost]
minutes: 8
lessons: [phases/17-infrastructure-and-production/14-prompt-semantic-caching, phases/11-llm-engineering/15-prompt-caching]
manuals: []
practice: []
cheatsheet: [llm-cost-caching]
related: [cost-capacity/cache-break-even, cost-capacity/two-cache-layers]
updated: 2026-11-03
---

An agent fans out ten tool calls at once for every user question. All ten share the same long system prompt, and prompt caching is on. The bill is several times what the cache should allow, and the usage fields show cache writes on nearly all calls and almost no cache reads. What is happening?

## Short answer

All ten requests reach the provider before the first one has finished writing the prefix into the cache. Each one sees a miss, each one pays the write premium, and none of them reads. The fix is sequential-first: send one request alone, let its cache write land, then fan out the other nine. It adds about one write latency to the first tool call and removes the inflation.

## Full answer

### The mechanism

Cache writes happen per request. The lesson puts the first write at about 300 ms after the provider sees the prompt. Requests that arrive inside that window find nothing to read, so each of them writes. Ten writes and zero reads, on every user question that finds the prefix cold. A question that arrives while an earlier write is still inside the cache lifetime reads it, so the trap shows when the questions are further apart than that lifetime. The lesson reports a bill of 5 to 10 times the expected cached cost from this pattern alone.

### Read the usage fields

Each response reports the tokens written to the cache and the tokens read from it. In this incident the written count is high on every request and the read count is near zero. That is the signature. A later sequential request with the same prefix does read, which separates this case from a prefix that never matches.

### The fix

Send the first request alone and wait for it to return. Its write has landed by then. Fan out the remaining nine, and each of them reads. The cost is about 300 ms on the first tool call. The lesson's exercise asks for the same fix without adding end-to-end latency: warm the prefix with one call at the start of the session, before the first fan-out, so the first tool call already reads.

### Rule out the other cause

A prefix that carries dynamic text looks the same in the usage fields: writes on every request, no reads ever. The lesson's example has the time to the minute, a user id and a reshuffled example order inside the system prompt. One field report moved the hit rate from 7 to 74 percent by moving that text below the cache boundary. Check the prompt template before you blame the fan-out.

## Follow-ups

- **Level 2:** How do you tell the fan-out trap from dynamic text in the prefix? Expected: both show writes and no reads. After the fan-out trap, a later sequential request with the same prefix reads. With dynamic text, nothing ever reads.
- **Level 3:** How do you fix the fan-out without adding latency for the user? Expected: warm the prefix with one call when the session starts, so the first fan-out already reads.
- **Level 3:** Does a self-hosted prefix cache have the same trap? Expected: the lesson says the self-hosted caches follow the same prefix pattern at your own compute, so measure the cached tokens on a fan-out before you assume they are shared.

## Wrong answers

- "Caching is on, so the provider should deduplicate them." Writes are per request, and the cache can be read only after the first write has landed.
- "Shorten the system prompt." That lowers every bill a little and leaves ten writes and zero reads in place.
- "Turn caching off, it costs more." It costs more only because of the arrival pattern. Sequential-first turns ten writes into one write and nine reads.

## Taught in

The [caching economics lesson](../../../phases/17-infrastructure-and-production/14-prompt-semantic-caching/) names the parallelization anti-pattern and its fix, and the [prompt caching lesson](../../../phases/11-llm-engineering/15-prompt-caching/) shows the usage fields to read.
