---
id: retries-that-amplify
title: The provider slowed down and your service fell over
card: production-mlops
kind: debug
level: 3
roles: [ai-evaluation-reliability-engineer, inference-engineer, applied-ai-engineer]
rounds: [debugging, system-design]
tags: [retries, backoff, fallback, rate-limits]
minutes: 12
lessons: [phases/11-llm-engineering/13-production-app, phases/17-infrastructure-and-production/24-chaos-engineering-llm]
manuals: []
practice: []
cheatsheet: [production-llm-app, sre-for-ai]
related: [production-mlops/budget-burn-pauses-chaos, production-mlops/checks-in-order-of-cost]
updated: 2026-11-03
---

During a provider slowdown, the provider began to return rate-limit errors. Within minutes your own service ran out of memory and crashed, although your incoming traffic had not changed. Reconstruct what happened, and fix the retry policy.

## Short answer

The gateway retried every rate-limited call, and each waiting retry kept its connection, its buffers and its request state in memory. The retries multiplied the in-flight concurrency several times over the real traffic, and the memory went with it. Fix the policy with exponential backoff and jitter, a small fixed number of attempts, a cap on in-flight requests, and a fallback chain that fails over instead of waiting.

## Full answer

### The chain of events

1. The provider returns 429 for a share of the calls.
2. The gateway retries each one. Each retry holds a connection, a buffer and the request state while it waits.
3. In-flight requests become the traffic multiplied by the attempts. The chaos lesson names this retry-amplified concurrency.
4. Memory follows the in-flight count, and the service that was healthy a minute ago runs out.

### The retry policy in the production application capstone

Exponential backoff with jitter: wait about 1 second, then 2, then 4, with a random spread added to each wait, and give up after 3 retries with a fallback response. The lesson's table separates the cases:

| Failure | Retry | Fallback |
|---|---|---|
| 429, rate limit | yes, with backoff | queue the request and tell the user it is in progress |
| 500, server error | yes, 3 attempts | switch to the fallback model |
| timeout over 30 seconds | yes, 1 attempt | a shorter prompt or a smaller model |

The jitter matters as much as the backoff. Without it, every client retries at the same instant and the provider sees a wave on each cycle.

### Bound the concurrency, not only the attempts

Attempts bound the retries of one request. Nothing bounds how many requests wait at once. Add a cap on in-flight requests at the gateway and a retry budget as a share of traffic. When the cap is reached, fail fast into the queue or the fallback instead of holding memory.

### The fallback chain

Primary model, then a secondary model, then a cached response, then a short unavailable message. Each step trades quality for availability, and the user always gets something.

### Test it before the next slowdown

The chaos lesson's first model-specific experiment injects a provider rate-limit for a few minutes and watches the fallback. Most teams learn there that the fallback was never fully exercised.

## Follow-ups

- **Level 3:** Why does backoff alone not stop the memory growth? Expected: backoff spreads the retries in time, and each waiting retry still holds its state. The fix needs a bound on in-flight requests.
- **Level 3:** What does a queue do that a retry does not? Expected: it stores the request without a connection or a worker, and it gives the user a progress message instead of a timeout.
- **Level 4:** The fallback model is cheaper and weaker. Who decides that it is acceptable, and how do you watch it? Expected: the product owner names the paths that may degrade. Log the fallback rate per path, and alert when it stays high.

## Wrong answers

- "Retry faster so the queue drains before memory runs out." Faster retries raise the request rate against a provider that is already limiting you.
- "Raise the maximum retries so users never see an error." Each attempt holds memory. More attempts multiply the in-flight state.
- "The provider caused the outage, there is nothing to fix here." The provider caused the errors. The retry policy turned them into an outage.

## Taught in

The [production app lesson](../../../phases/11-llm-engineering/13-production-app/) gives the backoff, the retry limits and the fallback chain, and the [chaos engineering lesson](../../../phases/17-infrastructure-and-production/24-chaos-engineering-llm/) names the retry storm as the failure to test.
