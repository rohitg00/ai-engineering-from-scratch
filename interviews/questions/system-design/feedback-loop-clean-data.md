---
id: feedback-loop-clean-data
title: Keep clean data when the model changes its own future
card: system-design
kind: design
level: 4
roles: [applied-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, design-review]
tags: [feedback-loop, holdout, logging, point-in-time]
minutes: 15
lessons: [phases/02-ml-fundamentals/19-ml-system-design, phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew]
manuals: []
practice: []
cheatsheet: [ml-system-design, feature-engineering]
related: [system-design/churn-model-system, system-design/fraud-check-100ms, system-design/feature-store-design]
updated: 2026-11-03
---

Three systems retrain monthly on their own production data: a churn model that sends save offers, a fraud model that blocks payments, and a ranking model that orders a feed. Each one gets a little worse after every retrain. Explain the shared cause, design the data layer that prevents it, and say what each training row must carry for the fix to work.

## Short answer

Each model's decisions change the data that trains its next version, which is a feedback loop. Offers keep users who would have churned, so high-risk users look loyal; blocked payments never get a chargeback, so fraud disappears from the blocked region; the feed shows only its top items, so only those collect clicks. The fix is to keep data the model did not influence: a random holdout that never receives the intervention, a small share of random decisions, and a log that stores the score and the decision with every row, joined to features as of the decision time so training can separate influenced from clean data.

## Full answer

### Three shapes of the same loop

| System | How the decision hides the label | What the retrain learns |
|---|---|---|
| Churn offers | Offers retain some at-risk users | Their features do not predict churn |
| Fraud blocks | A blocked payment has no outcome | The blocked region looks safe |
| Feed ranking | Only shown items can be clicked | The current top items are the only good ones |

The loop is listed among the main sources of technical debt in production ML systems because it is silent: every retrain looks fine on its own held-out data, which is also influenced.

### The data layer

1. A random holdout group that never receives the intervention. Its outcomes are the clean estimate of the base rate and the clean labels for training.
2. A small share of random decisions on live traffic, for example payments that are not blocked or items shown out of order, so the blocked and unshown regions keep producing labels. The share is sized as the smallest that keeps enough labels from those regions.
3. Logging of the score, the decision and the assignment with every row at decision time.
4. Features joined as of the decision time, with the point-in-time rule from the feature store, so that a row's inputs are what the model saw and not a later snapshot that already reflects the outcome.

### What a training row carries

The entity and the decision time, the features as of that time, the model score, the decision taken, the group it belonged to, the label and the label time. With those fields training can select clean rows, weight influenced rows, or model the decision as a feature. Without the decision and the group, influenced and clean rows are indistinguishable and the loop is invisible.

### Why the feature store is part of it

A naive join on the entity returns the newest feature snapshot for every label, which copies the outcome into the input. The same mistake inside a feedback loop is worse: the newest snapshot also reflects the intervention. The as-of join with a TTL makes each row describe the moment of the decision, and the created timestamp check keeps a backfill from reading data that arrived later.

### Measuring the fix

The holdout gives the business metric: the outcome in the treated group against the holdout group. It also gives the retrain test: evaluate the new model on holdout rows only, so the score is not inflated by the model's own decisions. A model that improves on influenced data and not on the holdout has learned the loop.

## Follow-ups

- **Level 3:** Why is a time split alone not enough here? Expected: the recent period is also influenced by the deployed model; time ordering prevents future leakage but not intervention bias.
- **Level 4:** The random non-blocking share costs real fraud. How do you argue for it? Expected: as the price of clean labels against the cost of a model that drifts blind; size it to the minimum that keeps enough labeled fraud from the blocked region.
- **Level 4:** How does the exposure loop in ranking differ from the other two? Expected: the label is never collected rather than hidden; random exposure of lower-ranked items is the only way to learn their click rate.
- **Level 4:** A retrain evaluated on the holdout is worse than on the full set. Which number do you trust? Expected: the holdout; the full set rewards the model for agreeing with its own past decisions.

## Wrong answers

- "More training data fixes a drifting model." The new data is influenced; more of it entrenches the loop.
- "A random train and test split shows the real performance." Both halves are influenced; only a holdout that never saw the intervention is clean.
- "Log the decision later from the outcome table." The decision and the assignment must be recorded at decision time, with the features as of that time, or the join leaks the outcome.

## Taught in

The [ML system design lesson](../../../phases/02-ml-fundamentals/19-ml-system-design/) names the three feedback loops and the shared fix, and the [feature store lesson](../../../phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/) gives the as-of join that keeps each training row at the decision time.
