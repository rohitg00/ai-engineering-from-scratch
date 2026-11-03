---
id: metric-before-result
title: Set the success metric before the first result exists
card: behavioral
kind: design
level: 2
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, forward-deployed-ai-engineer, ai-data-engineer]
rounds: [behavioral]
tags: [metrics, guardrails, thresholds, gqm]
minutes: 10
lessons: [phases/14-agent-engineering/52-design-success-metrics]
manuals: []
practice: []
cheatsheet: [product-discovery, eval-driven-agents]
related: [behavioral/smallest-slice-that-decides, behavioral/feedback-ratchet-owner]
updated: 2026-11-03
---

Tell me about a time you defined how a project would be judged before you had any results. What did you write down, and what did you refuse to leave open until later?

## Short answer

I start from the goal, derive the questions it raises, and only then pick the smallest metrics that answer them. Each metric gets a direction, a threshold, a window, a source and a population before any value is observed, and each outcome metric is paired with a guardrail and a counter-metric. I also write the pass, fail and ambiguous decisions in advance, because a team that sees the result first moves the threshold to protect the build.

## Full answer

### Goal, question, metric

For an incident tool the goal was to cut the time to identify the affected service without raising unsafe actions. The questions followed: how fast is the correct service found, how often is it correct, does diagnosis stay read-only, and does the workflow raise alert dismissal or operator load. The metrics made each question operational.

### A metric needs a contract

| Field | Example |
|---|---|
| Name | median identification seconds |
| Direction | at most |
| Threshold | 120 |
| Window | ten incident replays |
| Source | the replay event log |
| Population | the on-call engineers in the pilot |
| Kind | outcome or guardrail |

Without a source and a window a number cannot be reproduced. Without a threshold it cannot drive a decision.

### Three kinds of metric

- Outcome: did the desired state improve?
- Guardrail: did a fixed constraint stay true?
- Counter-metric: did the local gain shift cost or harm somewhere else?

Speed alone is not enough. Correctness, production writes, operator workload and missed alerts protect against a fast but unsafe result. A plan without a guardrail is invalid even when the outcome metrics look complete.

### Decide before you measure

The lesson's example: pass when the correct-service rate is at least 0.9 and the median time is at most 120 seconds; fail on any production write or a correct rate below 0.75; ambiguous when the gain is small with wide variance, which calls for a larger replay set. A stable correct rate between 0.75 and 0.9 matches none of the three rules, so I also write a rule for it before the replay: it does not pass, and it names the next test. Offline replay gives repeatability and edge coverage. A bounded pilot gives real behavior and trust. I use the cheapest evidence that answers the current decision and do not expose real users only because the code is ready.

## Follow-ups

- **Level 2:** A metric is easy to collect but cannot change the decision. What do you do with it? Expected: remove it; measurement answers a decision, it does not decorate a dashboard.
- **Level 2:** Give a counter-metric for the incident tool. Expected: review time added for the incident commander, or escalations that moved to another team.
- **Level 3:** The outcome metric passes and the guardrail fails. What is the verdict? Expected: fail; a fixed constraint that broke means the outcome was not reached.
- **Level 3:** Results come back ambiguous. What was already written for that case? Expected: the next step, such as a larger replay set, decided before the result so nobody argues the threshold afterwards.

## Wrong answers

- "Pick the metric after you see what the system can do." The threshold then moves to protect the build and the measurement decides nothing.
- "One good outcome metric is enough." Without a guardrail, a fast but unsafe result passes.
- "Run a live pilot since the implementation is ready." Readiness is not a reason to expose users; the cheapest evidence that answers the decision comes first.

## Taught in

The [success metrics lesson](../../../phases/14-agent-engineering/52-design-success-metrics/) gives the metric contract, the three kinds of metric and the rule to decide before measuring.
