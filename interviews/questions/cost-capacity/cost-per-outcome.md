---
id: cost-per-outcome
title: The metric to give finance instead of a token price
card: cost-capacity
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer, forward-deployed-ai-engineer]
rounds: [screen, customer]
tags: [finops, unit-economics, attribution, cost-per-request]
minutes: 5
lessons: [phases/17-infrastructure-and-production/27-finops-llms]
manuals: []
practice: []
cheatsheet: [llm-cost-caching]
related: [cost-capacity/batch-lane-triage]
updated: 2026-11-03
---

Finance asks for the cost per million tokens as the key metric for the model service. You push back. What metric do you propose instead, and what must every call record so that you can compute it?

## Short answer

Propose a cost per product outcome: per resolved ticket, per generated article, per successful agent task or per session minute. A price per million tokens is the vendor's unit, and it says nothing about whether the spend produced anything. To compute the outcome metric, stamp every call at creation with the user id, the task id with its route, and the tenant id, split the tokens into prompt, tool, memory and response, and join the cost to the outcome event.

## Full answer

### Why the token price misleads

A cheaper model that needs twice the tokens per task costs more per task. A prompt change that cuts tokens and lowers the resolution rate raises the cost per resolved ticket while the token dashboard goes green. The lesson's rule is to tie cost to a product outcome, because an optimization without that anchor has no direction.

### Three attribution dimensions

| Dimension | Key | What it answers |
|---|---|---|
| per user | `user_id` | who costs what, for seat pricing and abuse |
| per task | `task_id` and `route` | which product surface costs what |
| per tenant | `tenant_id` | which customer is profitable |

Instrument all three at the call site on day one. A provider line item carries none of them, and retroactive tagging always misses cases.

### Four token layers

| Layer | Typical share |
|---|---|
| prompt, the system text and the user input | 40 to 60 percent |
| tool, the results fed back into the context | 20 to 40 percent on agent workloads |
| memory, the prior turns and retrieved documents | 10 to 30 percent |
| response, the model output | 10 to 30 percent |

One bucket hides which layer drives the spend, so you cannot pick the lever.

### The record on every call

The trace carries the trace id, the three dimension keys, the four layer counts, the cost, and two flags, one for a cached input and one for a batch call. The most accurate attribution pattern joins these traces to the billing export by trace id, which the lesson calls the telemetry joiner.

## Follow-ups

- **Level 1:** Why does the token price alone mislead? Expected: it says nothing about tokens per outcome. A cheaper model that needs twice the tokens per task costs more per task.
- **Level 2:** Why split the tokens into four layers? Expected: one bucket hides whether prompt bloat, tool results, memory or output drives the spend, so you cannot choose the right fix.
- **Level 2:** Why stamp the call at creation instead of tagging the bill later? Expected: the provider line item has no user, task or tenant on it, and retroactive attribution always misses cases.
- **Level 3:** Which attribution pattern is the most accurate, and what does it need? Expected: the telemetry joiner, which joins trace ids to billing. It needs the trace id on every call and a billing export with the same key.

## Wrong answers

- "Tokens are what we pay for, so tokens are the metric." They are the vendor's unit. The business pays for outcomes, and a cheaper token can mean a more expensive task.
- "Tag the cloud bill by team like any other resource." A model call is a transaction, not an asset. The line item has no team on it unless the call stamped one.
- "Per-tenant cost is enough." Per-task shows which feature to fix and per-user shows abuse. The lesson instruments all three.

## Taught in

The [FinOps for LLMs lesson](../../../phases/17-infrastructure-and-production/27-finops-llms/) replaces the token price with a cost per outcome and defines the attribution dimensions and layers.
