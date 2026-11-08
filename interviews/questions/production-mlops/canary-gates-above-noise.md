---
id: canary-gates-above-noise
title: Set canary gates that do not halt on noise
card: production-mlops
kind: design
level: 3
roles: [ai-evaluation-reliability-engineer, inference-engineer, applied-ai-engineer]
rounds: [system-design, design-review]
tags: [canary, release-gates, non-determinism, latency-percentiles]
minutes: 12
lessons: [phases/17-infrastructure-and-production/20-shadow-canary-progressive]
manuals: []
practice: []
cheatsheet: [progressive-delivery]
related: [production-mlops/shadow-mode-is-a-smoke-test, production-mlops/canary-samples-at-one-percent, production-mlops/rollback-without-redeploy]
updated: 2026-11-03
---

You run a canary for a new model. The team wants a rule that stops the rollout when the canary and the baseline differ on any metric. Design the gates so that they catch a real regression and let a healthy rollout through.

## Short answer

Write each gate as a multiplier above the baseline, never as equality. Gate on five metrics: latency percentiles, cost per request, error and refusal rate, output length distribution and user feedback rate. Put every threshold above the run-to-run variance, which the lesson measured at up to 15 percent on identical inputs, and hold each step long enough to collect the samples the gate needs.

## Full answer

### Why equality fails

Identical inputs produce different outputs. Floating-point reductions on the GPU run in a different order for each batch shape, the batch size changes between runs, and sampling above temperature zero adds its own randomness. The lesson reports up to 15 percent accuracy variation between runs on the same eval set. "Stable" therefore means inside the expected variance, not identical to the baseline.

### The five gates

| Metric | Breach |
|---|---|
| Latency P50, P95, P99 | canary P99 above 1.5x the baseline |
| Cost per request | more than 20 percent above the baseline |
| Error and refusal rate | 2x the baseline |
| Output length, mean and P99 | a shift in the distribution |
| User feedback, thumbs-down and tickets | 1.5x the baseline |

### Measure the noise floor first

Before the canary, run two arms of the same baseline model and record the spread of each metric between them. That spread is the floor. A gate below it halts every rollout, including a good one. The lesson's exercise asks for the multipliers when the eval noise is plus or minus 7 percent, and the answer is a gate above that band.

### Hold each step long enough

The progression runs 1, 10, 25, 50, 75 and 100 percent. Gates check every 5 to 15 minutes. At 1 percent of a load of 1,000 per minute, the canary sees 10 requests per minute, which is 50 to 150 data points per window. That is enough to read latency and errors, but one or two samples decide the P99, so the P99 gate must hold for more than one window. It is too few for user feedback. Each step must pause until the gate has its samples.

### Keep the exit cheap

A halt is only useful when the rollback is fast. Keep the traffic share in a policy flag and the model in a registry with a pinned digest, so that a breach reverts in seconds.

## Follow-ups

- **Level 3:** How do you learn the size of the noise before the canary starts? Expected: run two canary arms of the same baseline and record the spread of each metric between them.
- **Level 3:** User feedback at the first step is too thin to gate on. What do you do? Expected: gate the early steps on latency, cost, errors and length, and apply the feedback gate from the step that has enough samples.
- **Level 4:** A gate fires at one step, and the metric is normal again on the next check. Continue or halt? Expected: halt and look. A gate that flaps sits inside the noise or sees an intermittent regression, and both need a decision before more users see the model.

## Wrong answers

- "Stop on any difference from the baseline." Two runs of the same model differ, so that rule stops every rollout.
- "Gate on the mean latency." A mean hides the tail. Gate on the percentiles.
- "Allow zero cost increase." A better model can cost more. The lesson sets the breach at 20 percent, and the product decides whether the gain pays for it.

## Taught in

The [progressive delivery lesson](../../../phases/17-infrastructure-and-production/20-shadow-canary-progressive/) lists the five gates, the non-determinism ceiling and the step cadence.
