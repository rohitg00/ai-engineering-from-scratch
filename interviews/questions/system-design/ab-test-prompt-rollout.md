---
id: ab-test-prompt-rollout
title: Roll out a new prompt without betting the product on it
card: system-design
kind: design
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer]
rounds: [system-design]
tags: [ab-testing, shadow-mode, canary, prompt-versioning]
minutes: 12
lessons: [phases/11-llm-engineering/13-production-app, phases/02-ml-fundamentals/19-ml-system-design]
manuals: []
practice: []
cheatsheet: [progressive-delivery, production-llm-app]
related: [system-design/streaming-and-fallback, system-design/design-doc-blocking-review]
updated: 2026-11-03
---

A new version of a chat prompt looks better in a notebook. Design how it reaches users: the stages, how users are assigned, what you measure at each stage, and when it rolls back automatically.

## Short answer

Run it in shadow first, on all traffic, logging its answers without showing them, and compare quality metrics with the current prompt. Then route a small share of users to it, 10% in the lesson, and widen in steps to 25%, 50% and 100% while the metrics hold. Assign by a deterministic hash of the user id so each user sees one version, and roll back automatically when the new version's error rate reaches twice the old one over a window of requests.

## Full answer

### Shadow mode

The new prompt runs on 100% of traffic but only its logs are kept. Nobody sees its output. This gives a full comparison of latency, cost per request, guardrail block rate and quality scores against the current version, and users never see a shadow answer. Shadow calls can share the provider quota with live calls, so give them a separate quota or key; otherwise a quota limit can slow or fail live requests. It is the same first stage that the ML design lesson calls shadow deployment for a model.

### Percentage rollout

Route 10% of traffic to the new version. If quality holds, raise it to 25%, then 50%, then 100%. If quality drops, switch back at once. Both versions stay deployed and the switch is configuration, so a rollback takes minutes, which is the lesson's rule for every stage.

### Deterministic assignment

Hash the user id combined with the name of the experiment and take it modulo 100. Buckets below the traffic share get the variant, the rest get the control. A user then sees the same version across requests inside one experiment, and the assignment can be recomputed later from the log. Random assignment per request mixes versions inside one conversation and makes the comparison noisy.

### What to measure

Per prompt version: latency percentiles, user ratings where they exist, error rate, guardrail block rate and cost per request. The eval logger records the template name and version with every request, so the metrics split by version without extra plumbing.

### Automatic rollback

The lesson's exercise sets the rule: when a new version shows 2x the error rate of the previous version over 100 requests, revert automatically. The window matters; a handful of requests is noise, and waiting for thousands lets a bad prompt run too long.

### A note on the business metric

Shadow and canary protect the user. Whether the new prompt improves the outcome that matters, such as task completion, needs a randomized split with enough traffic and time, which is the A/B stage from the ML design lesson.

## Follow-ups

- **Level 2:** Why hash the user id and not pick randomly per request? Expected: a user then gets one consistent version across a session and the assignment is reproducible from the log.
- **Level 2:** What does shadow mode not tell you? Expected: how users react to the new answers; it only compares logged outputs and system metrics.
- **Level 3:** The new prompt costs more per request but scores higher. Who decides? Expected: a guardrail on cost per request decides whether it can ship at all; the quality gain against the cost is then a product decision with both numbers on the table.
- **Level 3:** How do you keep the control and the variant from sharing a cache entry? Expected: include the prompt version in the cache key, otherwise a hit returns the other version's answer and the comparison is corrupted.

## Wrong answers

- "Ship to everyone and watch the dashboard." A regression then hits every user before the dashboard moves.
- "Assign per request at random for a cleaner statistic." Users see both versions in one conversation and the logged metrics mix them.
- "Shadow mode is enough; skip the canary." Shadow mode never shows the output to a user, so it cannot measure user reaction.

## Taught in

The [production LLM application lesson](../../../phases/11-llm-engineering/13-production-app/) describes shadow mode, percentage rollout and hashed assignment for prompts, and the [ML system design lesson](../../../phases/02-ml-fundamentals/19-ml-system-design/) gives the same three stages with the rollback rule for models.
