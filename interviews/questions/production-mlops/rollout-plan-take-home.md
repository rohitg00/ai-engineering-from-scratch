---
id: rollout-plan-take-home
title: Simulate a shadow, canary and rollback plan
card: production-mlops
kind: take-home
level: 4
roles: [ai-evaluation-reliability-engineer, inference-engineer, applied-ai-engineer]
rounds: [take-home, system-design]
tags: [canary, simulation, release-gates, rollback]
minutes: 60
lessons: [phases/17-infrastructure-and-production/20-shadow-canary-progressive]
manuals: []
practice: []
cheatsheet: [progressive-delivery]
related: [production-mlops/canary-gates-above-noise, production-mlops/canary-samples-at-one-percent, production-mlops/rollback-without-redeploy]
updated: 2026-11-03
---

Take-home. You receive a candidate model, a baseline model, and one week of production request logs with the latency, the token counts and the user feedback of each request. Deliver a rollout plan and a simulator that executes it: a shadow phase, a canary ramp with gates, and a rollback. Inject at least two regressions and show where the plan halts for each one. The logs hold user feedback only for the responses that users saw, so state how the simulator produces feedback for the candidate.

## Short answer

Build a simulator that replays the logs through both models, computes the five gate metrics per step, and advances the ramp only when every gate holds for the required number of windows. Set each threshold above the baseline's own run-to-run variance, which you measure by replaying the baseline against itself. Inject a cost regression and a quality regression, and show the step at which each one halts and the rollback that follows.

## Full answer

### What a complete submission contains

1. **The noise floor.** Replay the baseline against itself and report the spread of each metric. This is the floor under every gate.
2. **The gates.** Latency percentiles, cost per request, error and refusal rate, output length distribution, and user feedback rate. Write each as a multiplier above the floor. The lesson's defaults are a P99 above 1.5x, a cost more than 20 percent above the baseline, errors at 2x, a shift in the length distribution, and feedback at 1.5x.
3. **The shadow phase.** The candidate sees every request and returns nothing to a user. Report the cost delta, the length distribution, the refusals and the hard errors against the baseline.
4. **The ramp.** Steps at 1, 10, 25, 50, 75 and 100 percent. Compute the dwell at each step from the samples per window, so that a gate never decides on a handful of points.
5. **The rollback.** Model it as the lesson describes: a flag back to zero and a pin on the previous digest. The simulator shows the step and the time it takes.
6. **Two regressions.** The lesson's exercise injects a 25 percent cost regression, and a strong submission shows it halting at the first step. The second regression lives only in the feedback metric, and the submission shows that it stays invisible at the first step and halts only where the sample is large enough.
7. **A written decision.** The lesson's second exercise: a candidate with a 3 percent accuracy gain and a cost 18 percent above the baseline. Write both policy paths, ship and do not ship, and name who decides.

### What the reviewer looks for

- The floor is measured, not assumed.
- The gates are multipliers, and the thresholds sit above the floor.
- The dwell is computed from samples, not from the clock.
- The regression that the first step cannot see is shown, not hidden.
- The rollback is rehearsed inside the simulation.

### What to keep for production

The gate evaluation code and the noise-floor measurement become the checks of the real canary controller. The replay harness becomes the pre-release test for every future candidate.

## Follow-ups

- **Level 3:** The feedback regression was caught late. Is the plan wrong? Expected: no. It shows the limit of the feedback gate, and the fix is a longer dwell at the step where feedback first has samples, or a proxy metric with more volume.
- **Level 4:** The candidate has the same cost and tone as the baseline. What changes in the plan? Expected: skip the A/B step after the canary, which the lesson makes optional for an improved version of the same behavior.
- **Level 4:** What from the simulator survives into production? Expected: the gate evaluation code and the noise-floor measurement, which become the canary controller's checks.

## Wrong answers

- "Use the lesson's thresholds as they are." The lesson's numbers are defaults. The floor comes from your own baseline.
- "Advance the ramp on a fixed schedule." A ramp that moves on the clock ignores whether a gate had enough samples.
- "Model the rollback as a redeploy." The simulator should model the mechanism you will use, and a redeploy is the mechanism the lesson tells you to remove.

## Taught in

The [progressive delivery lesson](../../../phases/17-infrastructure-and-production/20-shadow-canary-progressive/) gives the gates, the ramp and the exercises that this take-home extends.
