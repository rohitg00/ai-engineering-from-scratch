---
id: streaming-and-fallback
title: Keep a chat service answering when the provider does not
card: system-design
kind: design
level: 2
roles: [applied-ai-engineer, inference-engineer, forward-deployed-ai-engineer, agentic-ai-engineer]
rounds: [system-design]
tags: [streaming, retries, fallback-chain, graceful-degradation]
minutes: 15
lessons: [phases/11-llm-engineering/13-production-app]
manuals: []
practice: []
cheatsheet: [production-llm-app]
related: [system-design/batched-inference-api-budget, system-design/llm-cost-projection]
updated: 2026-11-03
---

Design the request path of a chat service that calls a hosted model. Users leave when nothing appears for a few seconds, the provider returns rate limits and server errors at night, and the vector store behind retrieval sometimes times out. Cover what the user sees, how you retry, and what happens when each part fails.

## Short answer

Stream tokens over server-sent events so the first token appears in a few hundred milliseconds even though the full answer takes seconds. Retry provider failures with exponential backoff and jitter, capped at three retries, then fall through an ordered chain of models to a cached answer and finally a short unavailable message. Secondary systems degrade instead of failing the request: no retrieval context when the vector store is down, a direct model call when the cache is down, and a clear message when a guardrail blocks.

## Full answer

### Streaming

A response of a few hundred output tokens takes 3-8 seconds to finish. Without streaming the user watches a spinner for all of it. With streaming the first token arrives in 200-500ms, the total time is the same, and the perceived latency drops. Server-sent events are the default: one direction, over plain HTTP, consumed by the browser's event source or any HTTP client. Websockets are for two-way needs such as voice, and long polling is for clients that cannot do either.

### Three layers of failure

| Layer | Example | Recovery |
|---|---|---|
| Provider | 429 rate limit, 500 server error, timeout | Backoff with jitter, then the fallback chain |
| Model | Malformed JSON, invented function name | Retry once with the error in the prompt |
| Application | Vector store slow, cache down, guardrail exception | Degrade: skip the secondary system |

Backoff starts at one second, doubles on each attempt and adds random jitter so that many clients do not retry in step. Three retries is the cap; after that the request moves to the next model. Every external call has a timeout, with a default around 30s.

### The fallback chain

Primary model, then a cheaper or more available model, then a smaller one, then a cached response, then the unavailable message. Each step trades quality for availability. The user always gets something, and the log records which step answered so the cost tracker and the quality dashboard can attribute it.

### Degradation table

- 429: retry with backoff; queue the request and tell the user it is processing.
- 500: retry up to three times, then switch model; transparent to the user.
- Timeout: one retry with a shorter prompt or a smaller model.
- Malformed output: retry with the error attached, else return the raw text.
- Guardrail block: no retry; explain why the request was blocked.
- Vector store down: no retry on the store; answer without retrieval context.
- Cache down: no retry on the cache; call the model directly.

### The user-visible contract

The dashboard targets are a median under 2s and a p99 under 10s. Streaming moves the first-token time inside the median target even when the full response does not. A streamed response has one trap: the status line is sent before the first token, so a failure after that must be sent as an error event inside the stream.

## Follow-ups

- **Level 2:** Why add jitter to the backoff? Expected: many clients that fail at once would otherwise retry at the same instants and reproduce the overload.
- **Level 2:** Why is a guardrail block not retried? Expected: the input is the problem; retrying the same input gives the same block and spends a call.
- **Level 3:** The fallback model has a different price. Where does that show up? Expected: in the cost tracker per request and per model, so the dashboard shows the cost of the outage, not only its rate.
- **Level 3:** The stream has started and the model fails. What can the server still do? Expected: send an error event inside the stream, because the HTTP status is already committed.

## Wrong answers

- "Retry until the provider answers." Unbounded retries pile up during an outage; cap them and fall through the chain.
- "If retrieval is down, fail the request so the answer stays grounded." A secondary system must not take down the primary flow; answer with reduced context and log it.
- "Buffer the whole response and send it at once for simplicity." The user sees nothing for seconds and leaves; the total time is the same either way.

## Taught in

The [production LLM application lesson](../../../phases/11-llm-engineering/13-production-app/) gives the streaming protocols, the three failure layers, the backoff schedule and the fallback chain.
