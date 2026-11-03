---
id: loops-hold-the-pool
title: A few endless answers fill the pool for everyone
card: cost-capacity
kind: debug
level: 3
roles: [inference-engineer, applied-ai-engineer]
rounds: [debugging, ml-depth]
tags: [kv-pool, output-cap, graceful-shutdown, capacity]
minutes: 12
lessons: []
manuals: [sglang-101#s-operating-sglang, vllm-101#s-watch-vllm-in-production]
practice: []
cheatsheet: [sglang-serving, serving-engines-compared]
related: [cost-capacity/size-the-pool-from-peak, cost-capacity/autoscale-on-the-right-signal]
updated: 2026-11-03
---

A self-hosted server shows its KV pool near full for hours while the request rate is normal. A few requests have been generating for many minutes each, and the users behind the other requests wait. What is going on, and what do you change tonight and tomorrow?

## Short answer

A handful of requests are in a generation loop. Every token of a running request stays in the pool until the request ends, so a request that never stops grows until it crowds out the rest. Tonight, cap the output length so that every request ends, and add a presence penalty for the workloads that loop. Tomorrow, set the shutdown grace period from the new cap, because a request that runs to the cap decides how long a graceful restart takes.

## Full answer

### The mechanism

The pool holds the keys and values of every token of every running request. A request in a loop keeps generating, so it keeps taking slots until it reaches the output limit or the context length. With no cap, one looping request can hold a large share of the pool for the whole context, and new requests wait or running ones are retracted.

### A production report with the same shape

The SGLang manual summarizes an academic service that served a hundred billion tokens and ran into model loops that held KV cache. Their traffic came from agentic coding tools, with a median prompt of 2,179 tokens and a 95th percentile of 99,746 tokens. Their fix was operational, not a kernel: an output cap of 32K tokens and a presence penalty for the workloads that loop. The manual's advice is to read such a report for its order of fixes, and that service capped output before it tuned anything else.

### Read the metrics

The vLLM manual's alert table has the pattern: cache usage above 0.95 for more than a minute, waiting requests above zero, and a preemption rate above zero. Its pairing rule names the cause: preemptions with long answers mean that running requests grow until the pool runs out. The fixes it lists are lower concurrency or an FP8 KV cache, and the output cap is what turns the long answers into bounded ones.

### Why the cap comes before the grace period

A graceful shutdown drains the running requests before it stops. The grace period has to outlast the longest request, and the longest request is one that runs to the cap. The SGLang manual's arithmetic: an answer of 32K tokens at 30 tokens per second needs more than 18 minutes. Cap the output first, then set the termination grace period from the cap, or a drain can never finish in time and a rolling update kills requests mid-answer.

### Tomorrow

- Find the loops: requests that finished with the length reason at the cap, grouped by tenant and prompt template.
- Set per-tenant output caps that the product agreed to.
- If the long answers turn out to be real agent sessions, grow the pool with an FP8 KV cache or more memory, and lower the concurrency cap.
- Alert on the pair: cache usage near one with a normal request rate.

## Follow-ups

- **Level 3:** Why does a looping request hurt other users and not only itself? Expected: the pool is shared. A request that never ends keeps its slots, so new requests wait or running ones are retracted.
- **Level 3:** How do you find the looping requests after the fact? Expected: requests that finished with the length reason at the cap, grouped by tenant and prompt template.
- **Level 4:** Why does the cap on output length come first, before you pick how long a drain may take? Expected: the grace period must outlast the longest request, and the longest request runs to the cap. The manual's arithmetic gives more than 18 minutes for 32K tokens at 30 tokens per second.
- **Level 4:** The long answers are legitimate agent sessions. What then? Expected: grow the pool with an FP8 KV cache or more memory, lower the concurrency cap, and keep an output cap that the product agreed to.

## Wrong answers

- "Restart the server to clear the pool." Every running request fails, and the loops come back on the next prompt.
- "Raise the memory fraction." A larger pool delays the symptom. A request with no cap fills any pool.
- "Lower the temperature to stop the loops." Sampling settings change the odds of a loop. Only a cap guarantees that a request ends.

## Taught in

The [operating section of SGLang 101](../../../manuals/sglang-101/sections/7-1-operating-sglang.md) reports the output cap and the grace period arithmetic, and the [production watching section of vLLM 101](../../../manuals/vllm-101/sections/5-2-watch-vllm-in-production.md) pairs the preemption counter with the length of the answers.
