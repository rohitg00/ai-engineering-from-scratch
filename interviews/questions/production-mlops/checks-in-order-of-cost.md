---
id: checks-in-order-of-cost
title: Order the checks before a paid model call
card: production-mlops
kind: design
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, design-review]
tags: [rate-limiting, validation, http-status, demo]
minutes: 10
lessons: [phases/17-infrastructure-and-production/29-model-demo-interfaces]
manuals: []
practice: []
cheatsheet: [production-llm-app]
related: [production-mlops/stream-fails-after-200]
updated: 2026-11-03
---

You are about to share a public link to a model demo. Every request that reaches the model costs money. Design the sequence of checks a request passes before the model runs, and give the HTTP status for each refusal.

## Short answer

Run the cheap checks first and the paid step last. Refuse an oversized body from its `Content-Length` header before you read it, check the access token, take one token from the client's rate bucket, parse and validate the JSON, charge the daily usage cap, and only then call the model. Each refusal returns a JSON error with a stable code, a message and a hint, and the statuses in that order are 413, 401, 429, 422 and 503.

## Full answer

### Why the order matters

A bad request stops at the first check that it fails, and that check should cost the server almost nothing. The model call is the only step that costs money, so it comes last. The browser can repeat some checks with `maxlength` and `required`, but those help honest users only. Any client can send a request without the page, so the server repeats every check.

### The sequence

| Step | Refusal | Status |
|---|---|---|
| route exists | unknown endpoint | 404 |
| `Content-Length` present and numeric | missing, or not a number | 411, 400 |
| body size under the limit | over 4,096 bytes, refused before the read | 413 |
| body arrives in time | client stops sending | 408 |
| access token, when configured | missing or wrong | 401 |
| token bucket per client | bucket empty, with `Retry-After` | 429 |
| content type and JSON object | wrong type, or not an object | 415, 400 |
| fields | missing, empty, too long, control characters | 422 |
| daily usage cap | the day's budget is spent, with `Retry-After` | 503 |
| model call | | 200 |

The cap is charged after validation, so that only valid requests count against the day.

### The error shape

Every refusal has the same JSON body: a `code` that client code and tests compare, a `message` that states the fact with its numbers, a `hint` with one action, and a `request_id` that joins a user report to one log record.

### Two limits, not one

The token bucket bounds each client: a capacity for the burst and a refill rate for the long run. It does not bound the total. A hundred clients that each stay under the limit can still spend the whole budget, so the usage cap counts all model calls in a day and refuses after a fixed number.

### Behind a proxy

The bucket key is the client address. Behind a reverse proxy every request arrives from the proxy, so all clients share one bucket. Read the client address from the header that your own proxy sets, and trust that header from the proxy only.

### Log every request

One record per request, in the `finally` block, including the refused ones: the route, the status, the error code, the latency and the input length. The client address becomes a keyed hash. The text is never stored, and the page says so.

## Follow-ups

- **Level 2:** Why does the usage cap come after the field checks? Expected: so that only valid requests count against the day's total.
- **Level 2:** Why refuse on the header before reading the body? Expected: it stops a large upload before the server spends memory and time on it.
- **Level 3:** Behind a reverse proxy one heavy user gets everyone rate limited. Why? Expected: every request arrives from the proxy address, so all clients share one bucket. Read the client address from the proxy's header, and trust it from the proxy only.
- **Level 3:** What does the server do with a refused body before it answers 413? Expected: it reads and discards up to 64 KiB, because a close with unread data can trigger a TCP reset and the client loses the reply.

## Wrong answers

- "Validate the text first, then check the size." Reading the body before the size check spends the cost that the check exists to avoid.
- "A rate limit is enough, skip the cap." A per-client limit bounds each client. A hundred clients under the limit still spend the whole budget.
- "Return 500 with the stack trace, developers can read it." A stranger cannot act on a stack trace. An error needs a code, a fact and one next action.

## Taught in

The [model demo interfaces lesson](../../../phases/17-infrastructure-and-production/29-model-demo-interfaces/) orders the checks by cost and defines the error shape, the token bucket and the usage cap.
