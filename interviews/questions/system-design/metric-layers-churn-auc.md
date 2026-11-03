---
id: metric-layers-churn-auc
title: A churn model with a good AUC that nobody uses
card: system-design
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, screen]
tags: [metrics, offline-online, guardrails, baselines]
minutes: 8
lessons: [phases/02-ml-fundamentals/19-ml-system-design]
manuals: []
practice: []
cheatsheet: [ml-system-design, ml-evaluation-metrics]
related: [system-design/churn-model-system, system-design/when-not-ml]
updated: 2026-11-03
---

A data scientist reports a churn classifier with an AUC of 0.91. Three months after launch, nobody on the retention team uses the scores. The algorithm was fine. Name the design decisions that were missing, and say which metric should have been reported instead.

## Short answer

The failures happened before training: nobody named the action a score starts, the scores arrived weekly while the team called customers daily, a feature leaked the label through the cancellation reason, and nobody compared the model with the rule the team already used. AUC averages over every threshold including ones never used; the decision was to contact the top 5 percent each night, so the right offline number was precision in that top 5 percent, paired with online, business and guardrail metrics.

## Full answer

### Four layers of metrics

| Layer | When measured | Churn example |
|---|---|---|
| Offline | Before launch, on held-out past data | Precision in the top 5 percent at the offer threshold |
| Online | During launch, on live traffic | Offer acceptance rate, share of users scored |
| Business | Weeks later, with an experiment | 30-day churn in the treated group versus a holdout |
| Guardrail | All the time | Offer cost per saved user, unsubscribe rate, p99 latency |

The layers disagree often. The offline score comes from a past that did not contain the model. The online metric depends on how people react to the decision. The business metric moves slowly and carries noise from everything else in the company. The guardrails must not get worse.

### Pick the offline metric from the decision

The job contacts a fixed share of users, so the metric is the precision of that share. AUC ranks every pair of users, most of which never reach the decision. The rules guide quoted in the lesson puts it first: design the metrics before deciding what the system does.

### Baselines

An F1 of 0.56 is good against a best alternative of 0.30 and poor against a rule that reaches 0.60. Three baselines are needed: the trivial one, a heuristic such as the idle-days rule the support team used, and the current system. The lift is measured against the strongest one, and a minimum lift is set before the results are seen.

### The other three failures

- Freshness: weekly scores for a daily process means the team acted on stale numbers.
- Leakage: a feature written after the outcome contained the answer, so the offline score was inflated.
- Decision: a score with no action attached cannot change a business metric.

## Follow-ups

- **Level 1:** Why is a 30-day churn label slow to evaluate? Expected: the label arrives at the end of the horizon, so the business metric lags the launch by at least that long.
- **Level 2:** Which guardrail would catch a model that saves users at any price? Expected: offer cost per saved user.
- **Level 2:** The heuristic baseline beats the model by a small margin. What ships? Expected: the rule, because it is cheaper to run and explain, unless the model clears the minimum lift.

## Wrong answers

- "A higher AUC would have fixed adoption." Adoption failed on freshness, action and trust, not on ranking quality.
- "Business metrics are enough; skip the offline one." The business metric arrives weeks later and is noisy; the offline metric gates the launch.
- "Guardrails are a product concern, not a model concern." A model that moves a guardrail the wrong way is rolled back no matter its offline score.

## Taught in

The [ML system design lesson](../../../phases/02-ml-fundamentals/19-ml-system-design/) opens with the churn model that nobody used and defines the four metric layers and the baselines.
