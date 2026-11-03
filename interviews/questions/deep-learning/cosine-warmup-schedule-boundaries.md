---
id: cosine-warmup-schedule-boundaries
title: Warmup plus cosine schedule with pinned boundaries
card: deep-learning
kind: take-home
level: 4
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [take-home, coding]
tags: [learning-rate, schedules, warmup, cosine, testing]
minutes: 25
lessons: [phases/19-capstone-projects/44-cosine-lr-warmup, phases/03-deep-learning-core/09-learning-rate-schedules]
manuals: []
practice: []
cheatsheet: [optimizers-schedules]
related: [deep-learning/warmup-before-the-peak-rate, deep-learning/pick-the-peak-rate-and-schedule]
updated: 2026-11-03
---

Take-home. Implement a learning rate schedule as one function of the step: a linear ramp from zero to a peak, a cosine decay from the peak to a floor, and a fixed floor after the last step. Deliver tests that pin the value at every boundary, prove the curve has no jumps, and show that a resumed run lands on the right value. Describe your design and your tests.

## Short answer

Write one function with three branches: up to the warmup step, the peak times the step over the warmup length; between the warmup step and the total, the floor plus half the gap times one plus the cosine of pi times the progress since warmup ended; past the total, the floor. Test the fixed points: zero at step zero, the peak at the end of warmup from both branches, the floor at the last step and the floor one step later. Add a continuity test that bounds each one step change, and a resume test that computes the schedule from a saved global step.

## Full answer

### The function

```text
if warmup_steps > 0 and step <= warmup_steps:
    lr = lr_max * step / warmup_steps
elif step <= total_steps:
    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    lr = lr_min + 0.5 * (lr_max - lr_min) * (1 + cos(pi * progress))
else:
    lr = lr_min
```

The cosine evaluates to 1 at the end of warmup, which gives the peak and matches the ramp's endpoint, and to -1 at the total, which gives the floor. The capstone lesson makes the point that this continuity is the reason to write one function over the step rather than three pieces glued together: a glued schedule loses a boundary the first time the peak or a step count changes. Two guards: the ramp branch runs only when the warmup is above zero, so a warmup of zero steps starts at the peak and decays at once, with no division by zero. The constructor rejects a warmup that is not less than the total, as the lesson's code does with an error, because the rate would hold the peak at the last step and drop to the floor one step later.

### Why the floor is pinned, not an error

A trainer that overshoots the configured total keeps a usable rate and logs a warning. Extending a run means changing the total in the config, not editing the loop. The floor is non-zero on purpose: the lesson keeps it near 10 percent of the peak so the optimizer keeps learning in the long tail, and warns that a floor of zero looks good on a plot and leaves the model under-trained.

### The tests

1. **Fixed points.** With a non-zero warmup, lr(0) is 0, lr(warmup) equals the peak from the ramp branch and from the cosine branch, lr(total) equals the floor, lr(total + 1) equals the floor.
2. **Continuity.** For every step from 0 to total, the change between consecutive steps is at most the larger of the warmup slope, peak over warmup steps, and the steepest cosine slope, pi times the gap over twice the decay length. The lesson's exercise notes that a short cosine segment can be steeper than the ramp, so the ramp slope alone is not a safe bound.
3. **Resume.** Save a checkpoint with a global step, reload, and assert that the next value equals lr(global step + 1). The schedule reads a monotonic global step from the checkpoint, not an epoch counter or a loop variable, because sharded datasets and restarted loaders break the epoch to step mapping.
4. **Shape.** Render the schedule to a text plot and a CSV, with one row per step, and check the plot into the run directory so a reviewer can see the curve without running anything.

### Production notes from the lesson

The schedule's four numbers live in a versioned config, not in code. The warmup is a fraction of the total, around 1 to 3 percent, so the shape survives a longer run. The log row is step, learning rate, gradient L2 norm and loss, in that order, so dashboards can read it.

## Follow-ups

- **Level 3:** Why implement the three regions in one function? Expected: so the ramp endpoint and the cosine start share one formula for the peak, and a change to the peak or the step counts cannot open a gap at a boundary.
- **Level 4:** What is the right bound for the continuity test? Expected: the larger of the ramp slope, peak over warmup steps, and the steepest cosine slope, pi times the gap over twice the decay length; a short cosine segment can be steeper than the ramp.
- **Level 4:** Why pin at the floor after the last step instead of raising? Expected: a trainer that overshoots keeps a usable rate and logs a warning; extending training means changing the total in the config, not the loop.
- **Level 4:** What makes a resumed run land on the right value? Expected: the schedule reads a monotonic global step saved in the checkpoint, not an epoch counter or a local loop variable.

## Wrong answers

- "Set the floor to zero so the schedule finishes cleanly." The lesson keeps a non-zero floor near 10 percent of the peak so the optimizer keeps learning in the tail; a zero floor looks clean and leaves the model under-trained.
- "Test a few steps in the middle, the boundaries follow from the formula." An off by one at a boundary is the bug the lesson warns about; it shows up hours into a run as a rate that is 1 percent off at the moment it matters.
- "Compute the rate from the epoch and the batch index." Sharded datasets and restarted loaders break that mapping; the global step is the durable axis.

## Taught in

The [cosine warmup capstone](../../../phases/19-capstone-projects/44-cosine-lr-warmup/) builds this schedule with its boundary contract and production patterns, and the [learning rate schedules lesson](../../../phases/03-deep-learning-core/09-learning-rate-schedules/) compares it with the other schedules.
