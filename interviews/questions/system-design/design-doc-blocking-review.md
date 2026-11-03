---
id: design-doc-blocking-review
title: Review an ML design document and name the blockers
card: system-design
kind: design
level: 4
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer, inference-engineer]
rounds: [system-design, design-review]
tags: [design-review, design-document, blocking-items, serving-fit]
minutes: 20
lessons: [phases/02-ml-fundamentals/19-ml-system-design]
manuals: []
practice: []
cheatsheet: [ml-system-design]
related: [system-design/when-not-ml, system-design/ab-test-prompt-rollout, system-design/churn-model-system]
updated: 2026-11-03
---

You are the reviewer for ML design documents before any training starts. A team hands you a document for a payment fraud check that proposes batch scoring, where one job takes an hour, with a three-minute staleness limit, reports an offline AUC, lists a majority-class baseline, and has no rollout section. Walk me through your review: the sections you expect, which gaps block, how you score it, and what you tell the team.

## Short answer

The document needs nine sections, and six items block a review because each one makes the system unsafe or useless: the decision that uses the prediction, a business metric, a heuristic or current-system baseline, confirmation that every feature exists at prediction time, a shadow or canary stage with a rollback, and a default action for every failure. This document fails at least three of them: the only baseline is trivial, there is no rollout and no rollback, and the serving choice fails the fit check because batch cannot meet a limit of three minutes when one job takes an hour. I send it back with the blocking list first, and I ask for precision at the decision threshold instead of AUC.

## Full answer

### The nine sections

| Section | Question it answers | Blocking item |
|---|---|---|
| Problem | What is predicted, which decision uses it, why rules are not enough | The decision |
| Metrics | Offline, online, business and guardrail metrics | The business metric |
| Baselines | Trivial, heuristic and current-system baselines | A heuristic or current baseline |
| Data | Label source, delay, feature availability at prediction time | No leakage |
| Budgets and serving | Latency, peak QPS, cost, staleness, and the mode that fits | None |
| Rollout | Shadow, canary, A/B and the rollback | Shadow or canary plus rollback |
| Feedback loops | How the model's decisions alter its later training data | None |
| Failure modes | The default action for each failure | A default for every failure |
| Monitoring | What is watched after launch | None |

### Scoring

Each checklist item has a weight, a blocking flag and a check. Blocking items weigh 2. The score is the sum of passed weights over the total, and the verdict is ready for review only when the score reaches 0.85 and no blocking item fails. A document can score high on the non-blocking items and still be sent back on one blocker; that is the point of the flag.

### The serving fit check

This check reuses the cost model. It reads the workload numbers from the document, prices the chosen mode, and fails when that mode misses the staleness limit, the latency budget or the daily cost budget. A batch job that takes an hour cannot meet a limit of three minutes at any price, so a document that says batch with that limit fails the check. For a payment decision made at request time the fit is online, and the document must state the peak QPS and the p99 budget that size it.

### What I tell the team

1. Blockers first: name the action that each score starts; add the rule the fraud team uses today as the heuristic baseline and set the minimum lift; add shadow and canary stages with a configuration rollback; write a default for a timeout, a missing feature, a new card and a sudden score shift.
2. Then the serving section: switch to online, give the budgets, price it.
3. Then the metric: AUC averages thresholds nobody uses; report precision and recall at the approve, review and block thresholds, and name the business metric and the guardrails.
4. Last the feedback loop and the monitoring, which are not blocking but will decide the second quarter.

### Why the review happens before training

Every failure in the churn story at the start of the design lesson happened before training: no decision, stale cadence, a leaked feature, no comparison with the existing rule. A one-page document asks about each, and the review costs a day where the failures cost a quarter.

## Follow-ups

- **Level 3:** The team says the majority baseline is enough since it scores zero on F1. Why is that the wrong baseline? Expected: it is the trivial one and usually weak; the heuristic or current system is the real competitor and the one the lift is measured against.
- **Level 4:** Why does the serving fit check belong in a document review rather than in load testing? Expected: it is arithmetic on stated budgets and prices, so it catches an infeasible design before a line of serving code exists.
- **Level 4:** The document proposes a hybrid serving mode. What does the checker do and what do you do? Expected: the lesson's cost model has no hybrid plan, so the check fails until a hybrid plan is added; ask the team to price the batch and the online parts and add the plan.
- **Level 4:** What is the one non-blocking section you would still refuse to skip for a fraud system? Expected: feedback loops, because blocked payments never get a label and the model drifts toward its own decisions without a clean sample.

## Wrong answers

- "A strong offline metric compensates for a missing rollout." A model with no shadow stage and no rollback reaches users with no way back; that is why rollout blocks.
- "Score the document and pass it at a high enough total." One failed blocker fails the review regardless of the total.
- "Serving mode is an implementation detail for later." The fit check shows batch cannot meet the limit at all, which changes the architecture and the cost.

## Taught in

The [ML system design lesson](../../../phases/02-ml-fundamentals/19-ml-system-design/) defines the design document, its six blocking items, the score threshold and the serving fit check.
