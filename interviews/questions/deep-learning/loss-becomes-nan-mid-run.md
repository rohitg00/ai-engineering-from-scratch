---
id: loss-becomes-nan-mid-run
title: A smooth loss that turns inf and then NaN hours in
card: deep-learning
kind: debug
level: 4
roles: [applied-ai-engineer, inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [nan-loss, exploding-gradients, gradient-clipping, learning-rate, debugging]
minutes: 15
lessons: [phases/03-deep-learning-core/13-debugging-neural-networks, phases/03-deep-learning-core/06-optimizers, phases/03-deep-learning-core/09-learning-rate-schedules, phases/19-capstone-projects/44-cosine-lr-warmup]
manuals: []
practice: []
cheatsheet: [nn-debugging]
related: [deep-learning/pick-the-peak-rate-and-schedule, deep-learning/half-the-relus-are-dead]
updated: 2026-11-03
---

A run trains for hours with a smooth loss. Then, within three logging intervals, the loss jumps, becomes inf, and every value after that is NaN. The same recipe worked on a smaller model. Give your ranked list of causes, the evidence that separates them, and the changes that keep it from happening again.

## Short answer

A clean run that dies late is almost always an oversized update: the peak learning rate is too high for the larger model, a rare batch produced a huge gradient, or the schedule reached its peak at a point where the model was already sensitive. The logs separate the cases: for an explosion the gradient norm spikes before the loss does, while a forward pass overflow, such as a softmax without the max shift or a normalization over a zero variance, shows a normal norm and a loss that goes to inf in one step. Fix with gradient clipping by norm at 1.0, a lower peak with warmup, and a loss computed from logits, then resume from the last good checkpoint.

## Full answer

### Rank the causes

1. **Update too large for this model.** The debugging lesson's table: a loss that goes NaN after some steps means the learning rate is too high, and the first move is to reduce it by 10 times. The peak that was safe on the smaller model is close to the edge on the larger one. The capstone lesson advises sweeping the peak on a small model as a prior, and says the optimum shifts with size, so confirm rather than copy.
2. **One bad batch.** A single outlier batch produces a gradient large enough to corrupt every weight in one step. Without clipping, nothing stops it.
3. **Schedule position.** Check where the schedule was when the loss jumped. A short warmup or a peak reached at the wrong time puts the largest steps on a model that cannot take them.
4. **Forward pass overflow.** An exp in a hand written softmax without the max shift, a log of zero, or a division by a zero variance in a normalization. These produce inf at once, usually at the first step, so they rank low for a run that was clean for hours, but a rare batch can trigger them late.

### What the logs show

- The gradient L2 norm logged beside the learning rate every step. The capstone lesson's rule: a divergent run shows the norm spike before the loss does. An overflow shows a normal norm and a loss that is inf in a single step.
- Per-layer gradient statistics. The debugging lesson flags a layer whose mean absolute gradient exceeds 100 as exploding and shows which layer went first.
- Replay. Load the last good checkpoint, feed the batch from the failing step, and watch the norm. If that batch alone reproduces the spike, it is the trigger; if it does not, the schedule or the rate is.
- Anomaly detection in the autograd engine, to name the operation that produced the first NaN.

### Changes that prevent a repeat

- Clip the gradient by its global norm at 1.0 before the step. Clipping by norm keeps the direction; clipping each element does not.
- Lower the peak and keep a warmup of 1 to 5 percent of the steps, so the largest steps arrive after the optimizer statistics settle.
- Compute the loss from logits with a fused, stable function, and keep epsilons in logs and divisions.
- Checkpoint often enough that a resume costs minutes, and alert on a NaN loss so the run stops at the first bad step rather than hours later.

## Follow-ups

- **Level 3:** What in the logs separates an oversized update from a forward pass overflow? Expected: the gradient norm rises over several steps before the loss for an explosion; an overflow shows a normal norm and a loss that goes to inf in a single step.
- **Level 4:** Why clip by norm rather than by value? Expected: clipping by norm scales the whole gradient and keeps its direction; clipping each element changes the direction.
- **Level 4:** Why did the recipe work on the smaller model? Expected: the peak that was safe there sits near the edge for the larger one; a sweep on the small model is a prior, and the optimum shifts with size, so verify rather than copy.
- **Level 4:** What do you add so the run never dies silently again? Expected: log the gradient norm beside the learning rate each step, alert on a NaN loss, checkpoint often enough to resume, and restart with clipping and a warmup.

## Wrong answers

- "Add an epsilon to the loss and restart." An epsilon fixes a log of zero at step one; a late explosion comes from the update size, and the run will die again.
- "Halve the learning rate and hope." Halving is a guess; the lesson's move is a 10 times reduction, together with clipping and a check of the schedule position.
- "NaN means the data has a bad row." A bad row shows in the first epoch, not after hours of clean training; replay the failing batch on the checkpoint before you blame it.

## Taught in

The [debugging lesson](../../../phases/03-deep-learning-core/13-debugging-neural-networks/) gives the NaN rows of the master table, the [optimizers lesson](../../../phases/03-deep-learning-core/06-optimizers/) places clipping in the loop, the [learning rate schedules lesson](../../../phases/03-deep-learning-core/09-learning-rate-schedules/) covers warmup and peak, and the [cosine warmup capstone](../../../phases/19-capstone-projects/44-cosine-lr-warmup/) logs the norm of the gradient next to the rate.
