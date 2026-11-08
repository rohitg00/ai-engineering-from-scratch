---
id: warmup-before-the-peak-rate
title: What a learning rate warmup protects
card: deep-learning
kind: concept
level: 3
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [ml-depth, design-review]
tags: [learning-rate, warmup, schedules, adam]
minutes: 10
lessons: [phases/03-deep-learning-core/09-learning-rate-schedules, phases/19-capstone-projects/44-cosine-lr-warmup]
manuals: []
practice: [lab-learning-rate-sweep]
cheatsheet: [optimizers-schedules]
related: [deep-learning/adam-bias-correction-first-steps, deep-learning/cosine-warmup-schedule-boundaries]
updated: 2026-11-03
---

A transformer recipe starts the learning rate at zero and ramps it linearly up to the peak during the first steps, then decays it with a cosine. A teammate wants to start at the peak to save those steps. Explain what the ramp protects, how long it should be, and how to write it down so the recipe scales to a longer run.

## Short answer

The first updates are the fragile ones: the weights sit near their initialization, Adam's running estimates of the gradient mean and variance are built from a handful of samples, and the gradient norm is large and noisy. A full size step on that footing diverges or drops the model into a plateau it never leaves. Warmup keeps the effective step small until the statistics settle, over about 1 to 5 percent of the total steps, and the schedule should express that length as a fraction of the run rather than as a fixed step count.

## Full answer

### What is wrong at step zero

Adam's two moment estimates start at zero. Bias correction fixes their scale, but the first steps still use statistics from one or two gradients, which the schedules lesson calls garbage statistics. At the same time the weights are at their random initialization and the gradient norm is at its largest and noisiest. A peak step on that mix is a large, poorly directed move. The capstone lesson gives the two outcomes: the run diverges outright, or it settles into a loss plateau it never escapes.

### What warmup does

```text
lr(t) = lr_max * t / warmup_steps     for t below warmup_steps
```

The rate climbs from zero to the peak over the warmup steps. By the time the full rate arrives, the moment estimates have seen hundreds of gradients and the weights have moved off their starting point. The schedules lesson's examples of published runs use a warmup of 2000 steps to a peak of 3e-4 followed by a cosine decay to 3e-5, and a warmup over 375 million tokens to a peak of 6e-4.

### How long

The schedules lesson gives 1 to 5 percent of the total steps and, when in doubt, 3 to 5 percent. The capstone lesson gives 1 to 3 percent and makes the stronger point: write the warmup as a fraction. A run of 200 million steps with 2,000 warmup steps is at the peak almost at once, and a run of 20,000 steps with the same count warms up for 10 percent. The same number describes two different schedules.

### How to see that it worked

Log the gradient norm next to the learning rate at each step. In a well tuned warmup the norm rises roughly in step with the rate and settles after the peak. A norm that stays high after the ramp ends says the peak is too aggressive. A divergent run shows the norm spike before the loss does.

## Follow-ups

- **Level 3:** Why is Adam sensitive at step zero in particular? Expected: its moment estimates start at zero and the first steps use statistics from one or two gradients; bias correction fixes their scale but not their noise.
- **Level 3:** What does the gradient norm look like during a healthy warmup? Expected: it rises roughly in step with the learning rate and settles after the peak; a norm that stays high after the ramp says the peak is too aggressive.
- **Level 4:** Why does a fixed warmup step count break when the run gets longer? Expected: 2000 steps is 10 percent of a 20,000 step run and a vanishing share of a 200 million step run, so the same count gives two different schedules; a fraction keeps the shape.
- **Level 4:** You change the batch size. What do you revisit? Expected: the warmup length and the peak; the schedules lesson lists the warmup period as the setting that must change when the batch size changes.

## Wrong answers

- "Warmup wastes steps at a low rate." The lessons spend 1 to 5 percent of training on it, and a run that diverges in its first steps wastes all of them.
- "Bias correction already handles Adam's cold start, so warmup is redundant." The correction rescales the averages; it cannot turn two samples into a good estimate.
- "Set the warmup to 2000 steps, the big runs use that." That count was a fraction of one specific run; on a short run it is most of the training, and on a longer one it is nothing.

## Taught in

The [learning rate schedules lesson](../../../phases/03-deep-learning-core/09-learning-rate-schedules/) explains warmup and gives the published configurations, and the [cosine warmup capstone](../../../phases/19-capstone-projects/44-cosine-lr-warmup/) argues for a fractional warmup and logs the gradient norm beside the rate.
