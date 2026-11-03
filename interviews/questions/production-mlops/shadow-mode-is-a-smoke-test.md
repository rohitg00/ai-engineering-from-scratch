---
id: shadow-mode-is-a-smoke-test
title: What a week in shadow mode proves
card: production-mlops
kind: concept
level: 1
roles: [ai-evaluation-reliability-engineer, inference-engineer, applied-ai-engineer]
rounds: [screen, ml-breadth]
tags: [shadow-mode, canary, rollout, release-gates]
minutes: 5
lessons: [phases/17-infrastructure-and-production/20-shadow-canary-progressive]
manuals: []
practice: []
cheatsheet: [progressive-delivery]
related: [production-mlops/canary-gates-above-noise, production-mlops/rollback-without-redeploy]
updated: 2026-11-03
---

A teammate wants to skip the canary. The new model ran in shadow for a week with no errors and a flat bill, so they call it proven. What does that week show, and what does it leave open?

## Short answer

Shadow mode copies the production requests to the candidate and logs its outputs, and no user sees them. It shows that the candidate does not crash, does not refuse more often, does not cost more and does not write longer answers. It cannot show that users prefer the answers, because no user read one. Shadow is a smoke test, and the canary is the first quality test.

## Full answer

### What shadow records

For each request, the candidate output is logged next to the production output:

- the output text, as a diff against production;
- the token counts, which give the cost delta;
- the latency;
- refusals and hard errors.

### What it catches

Cost blow-ups, length regressions, a change in the refusal rate and hard errors. These are the failures that make a launch expensive or embarrassing, and shadow finds them with zero user impact.

### What it misses

A quality change that a user would notice. The candidate output never reaches a person, so there is no thumbs-down, no ticket and no retention signal. A model that gives shorter, cheaper and wrong answers passes shadow.

### What comes next

A canary exposes a growing share of users to the candidate, with a gate at each step. The lesson gates on five metrics: latency percentiles, cost per request, error and refusal rate, the output length distribution, and the user feedback rate. The progression runs from 1 percent to 10, 25, 50, 75 and 100 percent. The first user feedback appears here, not in shadow.

## Follow-ups

- **Level 1:** Which signal does shadow give that an offline eval does not? Expected: the behavior of the candidate on the real request mix, including cost and output length per request.
- **Level 2:** Shadow shows the cost per request is 40 percent above production. What do you do? Expected: stop before any canary. A cost more than 20 percent above the baseline is a gate breach, and a model that breaks the unit economics is a rollback case.
- **Level 2:** Why can shadow not measure user feedback? Expected: no user sees the candidate output, so there is nothing for a user to rate or report.
- **Level 3:** Shadow doubles the load on your model service. How do you keep it affordable? Expected: send a fixed share of requests to the candidate instead of all of them, and log the same metrics for that share.

## Wrong answers

- "Shadow passed, so the quality is fine." Shadow has no user, so it measures cost, length, errors and refusals only.
- "Shadow is a canary at zero percent." A canary returns the candidate output to real users and gates on their feedback. Shadow never returns an output to a user.
- "A week in shadow replaces the offline eval." The eval judges correctness on a labeled set. Shadow records behavior on live traffic. They answer different questions.

## Taught in

The [progressive delivery lesson](../../../phases/17-infrastructure-and-production/20-shadow-canary-progressive/) defines shadow mode, the five canary gates and the rollback path.
