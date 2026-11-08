---
id: demo-to-product-signals
title: The signals that a demo has become a product
card: system-design
kind: concept
level: 1
roles: [applied-ai-engineer, ai-developer-relations-engineer, forward-deployed-ai-engineer]
rounds: [system-design, screen]
tags: [demo, product, availability, cost-control]
minutes: 6
lessons: [phases/17-infrastructure-and-production/29-model-demo-interfaces, phases/11-llm-engineering/13-production-app]
manuals: []
practice: []
cheatsheet: [production-llm-app]
related: [system-design/public-demo-controls, system-design/batched-inference-api-budget]
updated: 2026-11-03
---

You built a small web demo of a model for reviewers. Three months later a colleague asks whether it is "production". How do you tell, and what changes when the answer is yes?

## Short answer

A demo serves known people in short sessions from one process. It has become a product when people outside the team use it every week, when someone asks for an uptime target or reports an outage, when users want to sign in or see history, when the weekly model cost is a budget line, or when the input is covered by a contract or a law. At that point the demo moves onto the production stack with authentication, fallback models, tracing, and cost tracking per user.

## Full answer

### The five signals

- People outside your team use it every week.
- Someone asks for an uptime target, or reports an outage.
- Users ask to sign in, save results, or see their history.
- The weekly model cost is a line in a budget.
- The input includes data that a contract or a law covers.

### What changes

| Property | Demo | Product |
|---|---|---|
| Users | Known people, short sessions | Unknown people, daily use |
| State | None | Accounts, history, saved results |
| Availability | Best effort, one process | A written target, replicas, an on-call owner |
| Cost control | One daily usage cap | Per-user quotas and billing |
| Observability | One log record per request | Traces, metrics, and alerts |

### What the demo already had

A good demo already had the small versions of these controls: an input limit, a per-client rate limit, a daily cap, and a log that keeps the input length and not the text. The product stack adds real authentication at the gateway, a fallback model chain for provider failures, traces across the components, and cost accounting per request and per user. The input limit and the log privacy carry over unchanged.

### Why the question matters

The dangerous state is the middle: a demo with product traffic and demo controls. One daily cap does not stop one tenant from using the whole budget, and one process has no replica to take over when it dies.

## Follow-ups

- **Level 1:** Which single signal is the strongest? Expected: an outage report, because it means someone depends on the demo and expects availability.
- **Level 2:** The weekly model cost appears in a budget. What control replaces the daily cap? Expected: per-user quotas and billing, so the total is attributed and limited per tenant.
- **Level 2:** Regulated data starts arriving in the input. What must the log do? Expected: keep no input text and no client address, with a retention period and access control on the records.

## Wrong answers

- "It is production when it runs on a server instead of a laptop." Where it runs does not decide; who depends on it does.
- "Add a disclaimer that it is a demo." A disclaimer does not stop traffic, cost or outages.
- "Keep the demo and build the product separately later." The signals mean the demo already carries product risk now.

## Taught in

The [model demo interfaces lesson](../../../phases/17-infrastructure-and-production/29-model-demo-interfaces/) lists the signals and the demo-to-product table, and the [production LLM application lesson](../../../phases/11-llm-engineering/13-production-app/) describes the stack the demo moves onto.
