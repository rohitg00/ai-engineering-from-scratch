---
id: missing-zero-grad
title: A training loop whose loss swings after a few steps
card: deep-learning
kind: code-reading
level: 3
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, debugging]
tags: [training-loop, zero-grad, gradient-accumulation, debugging]
minutes: 10
lessons: [phases/03-deep-learning-core/13-debugging-neural-networks, phases/03-deep-learning-core/10-mini-framework]
manuals: []
practice: []
cheatsheet: [nn-debugging]
related: [deep-learning/overfit-one-batch-first, deep-learning/weight-matrix-rows-and-columns]
updated: 2026-11-03
---

This loop trains a small network with plain SGD at a small learning rate on a fixed batch.

```python
for step in range(50):
    out = model(x)
    loss = criterion(out, y)
    loss.backward()
    optimizer.step()
```

The loss falls for a few steps and then swings up and down. Read the loop, name the bug, explain the mechanism, and say where the fix goes.

## Short answer

The loop never zeroes the gradients, so each backward call adds the new gradient on top of all the earlier ones. The step applies a growing sum, which acts like a learning rate that rises at every step, and the loss oscillates. Add the optimizer's zero_grad call before backward, which is where the lesson's correct loop puts it.

## Full answer

### Why the gradient grows

Gradient storage is an accumulator by design. A parameter used in several places sums its contributions, and a backward call adds into the stored gradient rather than replacing it. In the mini framework the Linear layer's backward does exactly that, with a plus-equals into the weight gradients, and the optimizer's zero_grad sets every gradient container back to 0.0. A framework does the same. Without the reset, step one applies g1, step two applies g1 plus g2, step three applies the sum of three, and so on. The direction stays roughly right for a while and the magnitude climbs until the updates overshoot.

### The lesson's order

```text
zero_grad, forward, loss, backward, (clip), step, (schedule)
```

The debugging lesson lists a forgotten zero_grad first among the bugs that waste the most hours, with this symptom: gradients accumulate across batches and the loss oscillates. Its demo reproduces the exact loop above and reports it. The optimizers lesson adds the ordering rule for the two trailing calls: the scheduler steps after the optimizer, and swapping them is a subtle bug.

### How to see it in logs

On a fixed batch the gradient norm should fall or hold as the loss falls. With this bug it grows step after step while the loss first improves and then swings with increasing amplitude. The overfit one batch test, which this loop resembles, would fail to reach a near zero loss.

### When accumulation is on purpose

Gradient accumulation across several small batches emulates one large batch: run backward on each micro batch without zeroing, then take one step and one zero_grad for the group, with the loss scaled by the group size. That is an exercise in the framework lesson. The difference from the bug is the single step per group and the division.

## Follow-ups

- **Level 3:** Why do frameworks accumulate gradients instead of overwriting them? Expected: a parameter used in several places sums its contributions, and accumulation across micro batches emulates a larger batch; the reset is left to the caller.
- **Level 3:** Where do clipping and the schedule go in the order? Expected: zero_grad, forward, loss, backward, clip, step, schedule; the scheduler steps after the optimizer.
- **Level 4:** How would you detect this bug from logs without reading the code? Expected: the gradient norm grows step after step on a fixed batch where it should shrink or hold, and the loss oscillates with growing amplitude.
- **Level 4:** When is skipping zero_grad on some steps correct? Expected: deliberate accumulation over several micro batches, with one step and one zero_grad after the group and the loss scaled by the group size.

## Wrong answers

- "The learning rate is too high." The rate is small; the accumulated gradient is what grows.
- "Reset the gradients only every few steps to smooth them." That is accumulation without the division; the step size scales with the group size and the loss swings.
- "Detach the loss each step to stop the buildup." Detaching stops the graph, not the stored gradients; the gradient buffers still hold the sum.

## Taught in

The [debugging lesson](../../../phases/03-deep-learning-core/13-debugging-neural-networks/) reproduces this bug and lists it first among common training loop mistakes, and the [mini framework lesson](../../../phases/03-deep-learning-core/10-mini-framework/) shows why gradients accumulate and what zero_grad resets.
