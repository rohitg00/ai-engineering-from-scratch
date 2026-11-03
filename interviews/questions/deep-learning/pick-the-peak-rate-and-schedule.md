---
id: pick-the-peak-rate-and-schedule
title: Choose a peak learning rate and a schedule in a few hours
card: deep-learning
kind: design
level: 4
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [system-design, design-review]
tags: [learning-rate, lr-range-test, schedules, 1cycle, cosine]
minutes: 15
lessons: [phases/03-deep-learning-core/13-debugging-neural-networks, phases/03-deep-learning-core/09-learning-rate-schedules, phases/03-deep-learning-core/06-optimizers, phases/19-capstone-projects/44-cosine-lr-warmup]
manuals: []
practice: [lab-learning-rate-sweep]
cheatsheet: [optimizers-schedules]
related: [deep-learning/cosine-warmup-schedule-boundaries, deep-learning/loss-becomes-nan-mid-run]
updated: 2026-11-03
---

You inherit a model with no known good learning rate and a compute budget of a few hours. Design the procedure that picks the peak learning rate and the schedule for the run, and say what you log to defend the choice.

## Short answer

Run a learning rate range test first: train for about a hundred steps while the rate grows exponentially from 1e-7 toward 10 and record the loss at each rate. Take the rate where the loss falls fastest and set the peak about 10 times lower. Then run a linear warmup over 1 to 5 percent of the steps into a cosine decay with a floor near a tenth of the peak, or the 1cycle policy when the budget is short and the total step count is fixed. Log the range test curve, the schedule curve and the gradient norm beside the learning rate at every step.

## Full answer

### Step one: measure, do not guess

The debugging lesson's range test: save the weights, start at 1e-7, multiply the rate by a constant factor each step so it reaches about 10 after a hundred steps, record the loss, and stop when the loss turns NaN or exceeds ten times the best value seen. Restore the weights. The loss is flat at the low end, falls fastest around some rate, reaches its minimum, and diverges. The suggested peak is about 10 times below the steepest fall, which in the lesson's example puts the best rate near 1e-3 when the steepest point sits near 1e-2. The lesson's second rule covers the case where the curve is unclear: try three rates 10 times apart, such as 1e-2, 1e-3 and 1e-4, and read the loss after a few epochs.

### Step two: pick the shape from the budget

| Situation | Schedule | Why |
|---|---|---|
| Total steps unknown | constant, with manual drops | nothing else can be computed |
| Hours, step count fixed | 1cycle | fastest convergence for a fixed budget |
| Moderate budget | cosine, floor at a tenth of the peak | safe default with no extra knobs |
| Days or weeks | warmup plus cosine | the default for large transformer runs |

For a few hours with a known step count the schedules lesson points at 1cycle, which ramps from the peak over 25 up to the peak over the first half and down to the peak over 10000 in the second half. For anything longer, warmup plus cosine with a warmup of 1 to 5 percent. With an adaptive optimizer the warmup is not optional: its moment estimates are poor for the first steps.

### Step three: sanity check the peak

The schedules lesson's sensitivity run trains a few epochs at a constant rate and labels each run diverged, barely moved, learning or converged. Run it at the chosen peak and at the rates one step above and below. The peak should land in learning or converged, and the rate above it should show the first signs of trouble.

### What to log

- The range test curve, loss against rate on a log axis, with the chosen peak marked.
- The schedule rendered over the step axis, saved in the run directory so a reviewer can read it without running anything.
- Per step: step, learning rate, gradient L2 norm and loss, in that order. The capstone lesson's rule is that a healthy warmup shows the norm rising with the rate and settling after the peak, and that a peak set too high shows a norm that stays high.
- The four schedule numbers in a versioned config, with the warmup as a fraction of the total so the choice survives a longer run.

### Defaults for when there is no time

The optimizers lesson's fallback: AdamW at 3e-4 with weight decay 0.01 for an unknown model, 2e-5 for fine-tuning a pretrained one. Treat these as the starting point of the range test, not as its result.

## Follow-ups

- **Level 3:** Why set the peak below the steepest point rather than at it? Expected: the steepest point is close to where the loss starts to diverge, and a long run needs a margin; one order of magnitude lower keeps it.
- **Level 4:** When do you choose 1cycle over warmup plus cosine? Expected: a short, fixed budget where the total step count is known; it converges faster for a fixed compute and needs the step count in advance.
- **Level 4:** The peak is right and the loss still oscillates near the end. What do you adjust? Expected: the decay, not the peak; a schedule that ends too high leaves steps too large for the final minimum, so lower the floor or lengthen the decay.
- **Level 4:** How does the model's size change the plan? Expected: sweep the peak on a smaller version first as a prior, then confirm with the range test on the full model, because the optimum shifts with size.

## Wrong answers

- "Use 3e-4 for Adam, it always works." It is the lesson's starting default when nothing is known, not a result; the range test takes minutes and replaces a guess with a measurement.
- "Pick the rate with the lowest loss in the range test." The lowest point sits next to divergence; the lesson picks about 10 times lower than the steepest fall.
- "A constant rate is fine if it is the right one." The right rate changes during training; a constant that fits the start is too large at the end, and the lesson keeps constant rates for small models and debugging.

## Taught in

The [debugging lesson](../../../phases/03-deep-learning-core/13-debugging-neural-networks/) builds the range test, the [learning rate schedules lesson](../../../phases/03-deep-learning-core/09-learning-rate-schedules/) compares the schedules and gives the decision flow, the [optimizers lesson](../../../phases/03-deep-learning-core/06-optimizers/) gives the fallback defaults, and the [cosine warmup capstone](../../../phases/19-capstone-projects/44-cosine-lr-warmup/) sets the logging schema.
