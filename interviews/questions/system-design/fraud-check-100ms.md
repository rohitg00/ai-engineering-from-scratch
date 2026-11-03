---
id: fraud-check-100ms
title: A payment fraud check inside a hundred milliseconds
card: system-design
kind: design
level: 3
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design]
tags: [fraud, online-inference, latency, label-delay, feedback-loop]
minutes: 20
lessons: [phases/02-ml-fundamentals/19-ml-system-design, phases/02-ml-fundamentals/20-model-monitoring-and-drift]
manuals: []
practice: []
cheatsheet: [ml-system-design]
related: [system-design/batch-vs-online-serving-choice, system-design/drift-monitoring-design, system-design/feedback-loop-clean-data]
updated: 2026-11-03
---

A payment service must approve, review or block each payment within 100 ms, at 400 requests per second at peak. Fraud labels arrive as chargebacks weeks later. Design the system: the task, the serving mode and its sizing, the data and label plan, the rollout, the failure defaults, and the two things that will quietly break it after launch.

## Short answer

The task is binary classification of fraud probability with two thresholds that split the score into approve, review and block, served online because the decision needs the data of the request. At 400 requests a second and 50 ms per request about 20 requests are in flight at any moment, so the service is small, and the budget leaves room for a feature fetch plus the model. Chargeback labels come weeks after the payment, so training uses a time split and features that exist at payment time, and the rollout goes shadow, then canary on a small share, with the heuristic rule as the default on timeout. The two quiet failures are the feedback loop, where blocked payments never get a label, and concept drift, where the same basket changes its fraud risk and only outcome monitors see it.

## Full answer

### Task and decision

| Question | Answer |
|---|---|
| Prediction, per entity | Probability that this payment is fraud |
| Decision | Approve, send to review, or block, inside 100 ms |
| When, with what data | At the request, with the payment, the card history and the device |
| Success | Fraud losses down with the approval rate as a guardrail |

### Serving and sizing

Batch cannot serve this: the staleness limit is zero because the payment did not exist a minute ago. Online inference fetches features and runs the model inside the budget. Little's law sizes it: throughput times latency is the number in progress, so 400 requests a second at 50 ms each is 20 requests in flight, far below what two replicas handle. The p99, not the mean, must stay under the budget; a p99 of 100 ms means 99 of 100 requests finish in time.

### Data and labels

Chargebacks arrive weeks after the payment, so the outcome of recent traffic is unknown. Train on a time split with the most recent labeled period held out. Every feature must exist at payment time; anything written after the outcome, such as a dispute flag, leaks the label.

### Rollout

Shadow: score live payments and log, never act; compare latency, error rate and score distribution with the current rule. Canary: act on a small share, often 1 to 5 percent, widen in steps, roll back by configuration when a guardrail moves. Then measure losses against a holdout.

### Failure defaults

- Model times out: apply the heuristic baseline the team already uses.
- A feature is missing or out of range: use its documented default and log it.
- A new card with no history: the rule or the population average.
- The score distribution moves suddenly: pause automatic blocks and page a person.

### The two quiet failures

1. The feedback loop. A blocked payment never gets a chargeback, so the retrained model sees fewer fraud examples from the region it blocks and slowly learns that region is safe. Give a small random share of payments a non-blocking decision and log the score and the action with every row, so later training can tell influenced data from clean data.
2. Concept drift. Fraudsters change tactics, and payments that were safe start to charge back. Inputs look the same, so input monitors stay quiet; only the outcome monitor sees it, and only after the label delay. Prior drift, such as the fraud rate doubling during an attack, shows up earlier in the prediction monitor as a moving positive rate.

### Monitoring

System health at once, inputs and predictions at once, outcomes joined as chargebacks arrive and computed on the labeled part only. Alert policy with effect sizes, a corrected alpha and persistence, so the on-call person reads the alerts.

## Follow-ups

- **Level 3:** Why does a time split matter more here than a random split? Expected: a random split leaks future tactics into training and overstates performance on the next month's fraud.
- **Level 3:** The review queue grows after launch. Which guardrail caught it and what do you adjust? Expected: the review rate guardrail; move the review threshold, not the model.
- **Level 4:** The random non-blocking share costs real fraud losses. How do you size it? Expected: as the smallest share that keeps enough labeled fraud examples from the blocked region to retrain; price it as the cost of clean data against the cost of a model that drifts blind.
- **Level 4:** Retraining on the last quarter's labels after a tactic change makes the model worse. Why? Expected: concept drift; most of the labels still describe the old relation, so new labels must be collected before retraining helps.

## Wrong answers

- "Precompute fraud scores nightly for every card." The payment did not exist last night; the decision needs request-time data.
- "Retrain weekly on all blocked and approved payments." Blocked payments have no outcome, so the training set drifts toward the model's own decisions.
- "Watch feature drift and you will see the fraudsters change." Concept drift leaves inputs unchanged; only outcomes show it.

## Taught in

The [ML system design lesson](../../../phases/02-ml-fundamentals/19-ml-system-design/) gives the latency budget, Little's law, the rollout stages and the feedback loop, and the [model monitoring lesson](../../../phases/02-ml-fundamentals/20-model-monitoring-and-drift/) explains the drift kinds and the label delay.
