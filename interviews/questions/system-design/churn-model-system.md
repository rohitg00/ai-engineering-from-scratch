---
id: churn-model-system
title: Design the churn system, not the churn model
card: system-design
kind: design
level: 2
roles: [applied-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design]
tags: [churn, batch-inference, baselines, feedback-loop]
minutes: 20
lessons: [phases/02-ml-fundamentals/19-ml-system-design]
manuals: []
practice: []
cheatsheet: [ml-system-design]
related: [system-design/metric-layers-churn-auc, system-design/batch-vs-online-serving-choice, system-design/feedback-loop-clean-data]
updated: 2026-11-03
---

A subscription company with 2,000,000 users wants to reduce churn. The retention team can send a save offer to a small share of users each night. Design the system end to end: the prediction, the decision, the serving mode, the baselines, the rollout, and the failure defaults. State the load and the budgets you assume.

## Short answer

The task is binary classification: the probability that a user cancels in the next 30 days, so that the nightly job can pick the top 5 percent for an offer. Nightly scores for every user fit batch inference; the lesson's cost model prices one run a day over the user base at under one dollar, while an online service sized for 40 peak QPS costs $24.00 a day for a freshness nobody needs. The model must beat the idle-days rule by a set lift, ship through shadow and canary stages, and fall back to that rule when anything fails.

## Full answer

### From the goal to a task

| Question | Answer |
|---|---|
| What is predicted, for which entity | Cancellation in the next 30 days, per user |
| Which decision uses it | The nightly job sends an offer to the top 5 percent |
| When is it needed, with which data | Each night, from data up to that night |
| How do we know the decision got better | 30-day churn in the treated group versus a random holdout |

### Load and budgets

Entities: 2,000,000 users. Requests: one score read per user visit. Freshness: a day is fine, because the job runs once a night. Latency budget: one key-value read at request time, a few milliseconds. Cost: the batch plan prices at $0.91 per day for one run over the user base, against $24.00 per day for the minimum two replicas of an online service. A hybrid can score new users online on their first visit, since batch has no score for them until the next run.

### Metrics and baselines

Offline: precision in the top 5 percent. Online: offer acceptance rate and share of users scored. Business: churn in treated versus holdout. Guardrails: offer cost per saved user, unsubscribe rate. Three baselines: majority class, which scores zero on F1 because it never predicts churn; a one-feature idle-days rule fitted on training data; and the current process. In the lesson's demo the model reaches an F1 of 0.564 against the fitted rule at 0.500, a lift of 0.064 above the minimum of 0.02, so the model earns its place. With weaker features the rule would ship instead.

### Data

Labels come from the cancellations table, with a 30-day delay. Every feature must exist at the moment of scoring; a cancellation reason written after the fact leaks the label. Hold out the most recent period for the test split.

### Rollout

Shadow first: score live users, log, never act. Then canary: act for a small share, often 1 to 5 percent, and widen in steps with a rollback switch. Then an A/B test against the holdout for the business metric. Keep the old model deployed and switch traffic by configuration.

### Feedback loop and failures

Offers keep some users, so next month high-risk users look loyal and the retrained model learns that their features do not predict churn. Keep a random holdout that never gets the offer and log the score and the decision with each row. Failure defaults: a failed nightly job serves the last good scores for a fixed time, then the rule; a missing feature takes its documented default and logs; a sudden move in the score distribution pauses automatic offers and alerts a person.

## Follow-ups

- **Level 2:** Why does the majority baseline score zero? Expected: F1 counts positive predictions, and the majority class is "stays", so there are none.
- **Level 2:** The retention team wants hourly freshness. What changes? Expected: more runs per day raise batch cost in proportion, and the online path becomes cheaper at some point; price both with the cost model.
- **Level 3:** How do you keep the model from learning its own interventions? Expected: a random holdout that never receives offers, plus logging of score and decision so training can separate influenced from clean rows.
- **Level 3:** What is the safe default when the model service is down during the nightly run? Expected: serve the last good scores for a fixed window, then fall back to the idle-days rule.

## Wrong answers

- "Serve it online so scores are always fresh." The decision runs once a night; online replicas cost more for freshness the process cannot use.
- "Use AUC as the offline metric." The decision uses one threshold; precision in the contacted share is the metric that matches it.
- "Retrain monthly on all users." Treated users carry the intervention in their labels; without a holdout the model degrades with each retrain.

## Taught in

The [ML system design lesson](../../../phases/02-ml-fundamentals/19-ml-system-design/) prices the nightly churn job against an online service, compares the model with its baselines, and lists the failure defaults.
