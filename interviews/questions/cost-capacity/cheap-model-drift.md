---
id: cheap-model-drift
title: The router saved half the bill, then the escalations climbed
card: cost-capacity
kind: debug
level: 3
roles: [applied-ai-engineer, forward-deployed-ai-engineer, ai-data-engineer]
rounds: [debugging, ml-depth]
tags: [model-routing, cascade, drift, online-quality]
minutes: 12
lessons: [phases/17-infrastructure-and-production/16-model-routing]
manuals: []
practice: []
cheatsheet: [llm-routing-gateways]
related: [cost-capacity/semantic-threshold, cost-capacity/gateway-latency-budget]
updated: 2026-11-03
---

Six months ago a cascading router cut the bill by more than half with no measurable quality loss. Since then the escalation rate has crept from 8 percent to 22 percent, and a sales engineer reports that a competitor's demo now answers better than your product. Diagnose it.

## Short answer

The traffic drifted and the router did not. Its classifier learned the question mix of six months ago, users now ask longer and harder questions, and the cheap model's first pass fails its own confidence check more often, which is what the rising escalation rate records. Quality fell silently on the requests that were not escalated. Gate every route with online quality metrics, retrain the classifier on current traffic, and treat an escalation rate above about 30 percent as proof that the cheap model is over-routed.

## Full answer

### The failure mode the lesson warns about

A route sends a large share of traffic to a weaker model. Over months the task distribution shifts: users get more sophisticated and ask longer questions. The router does not notice, because its classifier was trained on the earlier quarter. Quality drops by a few percent on reasoning tasks, nobody complains loudly enough, and the team finds out from a competitor benchmark. The lesson's numbers for the pattern: 40 percent routed cheap, a 3 to 5 percent quality drop, unnoticed for a quarter.

### Three causes of a rising escalation rate

1. **Distribution shift.** More long prompts and more multi-step questions. The lesson's length signal says prompts above 4K tokens often need the frontier model, and prompts under 500 tokens usually do not. If the mix moved up, more first passes fail.
2. **The cheap model changed.** A provider update behind the same alias, or a routine version bump, moves the confidence signal and the refusal behavior.
3. **Stale thresholds.** The confidence cutoff and the embedding set of known-hard questions were tuned on old traffic.

Each cause has its own fix: retrain the classifier on recent labeled traffic, pin the model version and log the served model on every call, and refresh the hard set and the cutoff on a new eval.

### Gates on live traffic

The lesson gates routes with live signals, not with the offline set:

- thumbs up and down per route;
- an automated judge on a 5 percent held-out sample per route;
- the escalation rate, where a cascade that kicks up more than 30 percent of requests is over-routing;
- the refusal rate per route.

### What the cascade now costs

The cascade pattern was designed for about 1.2 times the median latency and about 2 times on the escalated share, with roughly 10 percent escalated. At 22 percent escalated, a fifth of the requests pay for two model calls and the slow path, so the saving shrank while the quality fell.

## Follow-ups

- **Level 3:** Why did the offline eval not catch the loss? Expected: the eval set was built from the old distribution. It scores the model on questions that users no longer ask.
- **Level 3:** Which online metric gives the earliest warning? Expected: the escalation rate per route. It rises as the cheap model fails its own confidence check more often, before the thumbs or a judge sample show the loss.
- **Level 4:** The provider updated the cheap model behind the same alias. How do you know? Expected: a step change in escalations or judge scores on a date with no deploy on your side. Pin the model version and log the served model on every call.
- **Level 4:** Where do you set the alarm on the escalation rate? Expected: near the design target, about 10 percent escalated for the cascade pattern, with the lesson's 30 percent as the hard line for over-routing.

## Wrong answers

- "The cheap model got worse, swap it." Possible, and the first suspect is the router's stale classifier against drifted traffic.
- "Quality is fine, the eval score did not move." The eval set comes from the old distribution and cannot see the new questions.
- "Raise the confidence cutoff so that more goes to the frontier model." That buys quality back at a cost without finding the cause. Retrain the router and gate it online.

## Taught in

The [model routing lesson](../../../phases/17-infrastructure-and-production/16-model-routing/) names cheap-model drift and the online quality gates that catch it.
