---
id: batched-inference-api-budget
title: Design a chat API for ten thousand daily users
card: system-design
kind: design
level: 3
roles: [applied-ai-engineer, inference-engineer, agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design]
tags: [llm-api, gateway, semantic-cache, observability, capacity]
minutes: 25
lessons: [phases/11-llm-engineering/13-production-app, phases/10-llms-from-scratch/13-building-complete-llm-pipeline]
manuals: []
practice: []
cheatsheet: [production-llm-app, llm-cost-caching]
related: [system-design/llm-cost-projection, system-design/streaming-and-fallback, system-design/demo-to-product-signals]
updated: 2026-11-03
---

Design the service behind a chat product with 10,000 daily active users who send about 5 queries each, with roughly 1,500 input tokens and 400 output tokens per query. Users must see a response start quickly, the tail must stay bounded, and the product has a unit cost target. Lay out the request path, the components, the budgets you hold each one to, and how you would scale it.

## Short answer

The request enters through a gateway that authenticates and rate limits per user, passes input guardrails, is matched against a semantic cache, and on a miss goes to the model with streaming, then through output guardrails, an eval logger and a cost tracker. The budgets are a median under 2s, a p99 under 10s, a cache hit rate above 30%, a guardrail block rate under 5%, and a cost per request under $0.01. At 50,000 queries a day this runs on a few async servers behind a load balancer; the servers are I/O bound, so a single async process holds a hundred or more concurrent requests and scaling means more servers, not more cores.

## Full answer

### The path

Gateway for authentication, rate limits of 10-50 requests a minute per user and CORS; input guardrails for injection patterns and personal data; a prompt router that picks the template and version; a semantic cache keyed by query embedding with a similarity threshold and a time to live; the model call with streaming and a fallback chain; output guardrails; an eval logger; a cost tracker; a server-sent events response. Seven components, each one a known piece; the engineering is the wiring and the budgets.

### Budgets

| Metric | Target | Why |
|---|---|---|
| Median latency | Under 2s | The typical experience |
| p99 latency | Under 10s | The tail drives churn |
| Cache hit rate | Above 30% | Direct cost savings |
| Guardrail block rate | Under 5% | Higher means false positives |
| Cost per request | Under $0.01 | Unit economics |

Streaming puts the first token inside the median budget even when the full answer takes seconds. Maximum token limits on input and output bound both the cost and the tail. Every external call has a timeout.

### Load and capacity

Traffic is 50,000 queries a day, and with the measured cache hit rate about 32,500 reach the model. Peak matters more than the average; size for the busiest minute. The servers wait on network I/O, so one async process serves 100+ concurrent requests and a box with four workers serves 400+. The lesson's scaling table puts this tier at a few async servers with a cache and a queue, for about $500 a month of infrastructure, with the model bill on top. Connection pooling to the provider avoids a new TLS handshake per request, which costs 100-200ms. Work that is not interactive, such as summarization, goes to a queue with workers and a job id the client polls.

### Observability

Every request writes one structured log line with the request id, the user, the template and version, the model, the input and output token counts, the latency, the cache result, the guardrail results and the cost. Traces across the components show where the time went. The five numbers in the table sit on one dashboard.

### If the model is self-hosted

The pipeline lesson's serving stage adds continuous batching, speculative decoding, and KV cache eviction, with quantized weights for serving and the eval gate rerun on the quantized model. The same gateway, cache and guardrails sit in front of it.

### Before launch

The deployment checklist has fifteen items; the ones people skip are per-user rate limits, maximum token limits, a health endpoint that reports dependency status, timeouts on every external call, and a load test with 100 concurrent users.

## Follow-ups

- **Level 3:** A user pastes a document far longer than the context window. Where is that caught? Expected: at the maximum input token limit before the model call, with a clear error, not at the provider.
- **Level 3:** Why does cost per user matter when cost per request is already under target? Expected: a few heavy users dominate the bill; per-user tracking and a daily cap move them to a cheaper model or stop them.
- **Level 4:** The provider has a regional outage during the daily peak. Walk the request path. Expected: backoff and retries on the primary, fall through the chain to a second model, then cached answers for repeated queries, then an unavailable message; the cost tracker shows the fallback's price and the dashboard shows the step that answered.
- **Level 4:** How do you prove the service meets its budgets before the first user? Expected: a load test at 100 concurrent users against the staging stack with the dashboard metrics as pass criteria, plus a shadow run of the prompts on logged traffic.

## Wrong answers

- "Scale the model servers first." The service is I/O bound at this traffic; the gateway, cache and async servers are the design, and the model is a dependency.
- "Skip the cache; the model is the product." A third of the traffic repeats, and the cache is the largest single saving in the bill.
- "The p99 is a vendor problem." Timeouts, maximum tokens, streaming and the fallback chain are what bound the tail on your side.

## Taught in

The [production LLM application lesson](../../../phases/11-llm-engineering/13-production-app/) gives the architecture, the budgets, the scaling table and the checklist, and the [complete LLM pipeline lesson](../../../phases/10-llms-from-scratch/13-building-complete-llm-pipeline/) describes the serving stage behind a self-hosted model.
