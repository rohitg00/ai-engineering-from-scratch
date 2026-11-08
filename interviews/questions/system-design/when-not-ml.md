---
id: when-not-ml
title: When to say no to a model
card: system-design
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, screen]
tags: [problem-framing, baselines, rules-vs-ml]
minutes: 8
lessons: [phases/02-ml-fundamentals/01-what-is-machine-learning, phases/02-ml-fundamentals/19-ml-system-design]
manuals: []
practice: []
cheatsheet: [ml-system-design]
related: [system-design/metric-layers-churn-auc, system-design/design-doc-blocking-review]
updated: 2026-11-03
---

A product owner asks your team for "a model" to decide which support tickets get escalated. Before you design anything, what questions decide whether this should be a learned model at all, and what would make you answer with a rule instead?

## Short answer

I ask whether a short rule already reaches the goal, whether labels exist or can be collected, whether anyone will act on the prediction, whether the data at decision time holds the signal, and whether one error is acceptable. A model loses when a few conditions stay correct and explain themselves, when there are no labels, or when the cost of building and running the system exceeds the value of the better decisions. A model wins when the rule has grown long and fragile, because a learned model is easier to update than a complex heuristic.

## Full answer

### The cases against a model

| Condition | Why a rule wins |
|---|---|
| The logic fits in a few conditions and stays correct | Cheaper to run, test and explain |
| No labels and no practical way to collect them | Nothing to learn from |
| Nobody acts on the prediction | A better score changes nothing |
| The decision-time data does not contain the signal | The model cannot see what matters |
| One error is unacceptable and no person checks the output | A probabilistic system will be wrong sometimes |
| The system costs more than the better decisions are worth | Negative return |
| The problem changes faster than retraining | The model is always stale |

A lookup table or a threshold that covers 99% of cases is the right system, and adding a model raises maintenance cost for little gain.

### The cases for a model

The rules guide quoted in the design lesson says not to fear launching without machine learning, and also to prefer a model over a complex heuristic. The crossing point is when the rule has many branches, breaks on new cases, and nobody can say why it decides as it does. A learned model is retrained; a long rule is rewritten.

### How I would run the ticket case

1. Ask what the escalation decision is, who makes it, and when the features exist.
2. Build the rule the support team already uses, even if it lives in a spreadsheet, and measure it.
3. Set the minimum lift a model must show over that rule before any training.
4. Only then collect labels and train, and compare against the rule with the same metric.

The rule is also the safe default when the model service fails, so it is built first either way.

## Follow-ups

- **Level 1:** Where do labels for ticket escalation come from, and what is their delay? Expected: from past escalation decisions or outcomes, which arrive after the ticket closes; the delay sets how fresh the training data can be.
- **Level 2:** The team has no escalation history at all. What do you build first? Expected: the rule, with logging of the decision and its inputs, so labels start to accumulate.
- **Level 2:** A regulator requires that every escalation decision be explainable. What changes? Expected: either keep the rule or restrict the model to interpretable forms such as a small tree or a linear model.

## Wrong answers

- "A model always beats a rule given enough data." The rule can win when the features carry weak signal, and the lift must be measured, not assumed.
- "Collect data later; ship the model first." Without labels there is nothing to train on and nothing to evaluate against.
- "The heuristic baseline is just a sanity check." It is the real competitor and the safe default for failures.

## Taught in

The [introduction to machine learning](../../../phases/02-ml-fundamentals/01-what-is-machine-learning/) gives the decision flowchart for when not to use a model, and the [ML system design lesson](../../../phases/02-ml-fundamentals/19-ml-system-design/) lists the cases where a rule wins and sets the minimum lift.
