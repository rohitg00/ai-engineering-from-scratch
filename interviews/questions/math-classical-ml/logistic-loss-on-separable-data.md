---
id: logistic-loss-on-separable-data
title: A logistic regression whose weights never stop growing
card: math-classical-ml
kind: concept
level: 3
roles: [applied-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [ml-depth, debugging]
tags: [logistic-regression, cross-entropy, convexity, regularization]
minutes: 12
lessons: [phases/02-ml-fundamentals/03-logistic-regression, phases/02-ml-fundamentals/02-linear-regression]
manuals: []
practice: [logistic-regression]
cheatsheet: [classical-ml]
related: [math-classical-ml/threshold-precision-or-recall, math-classical-ml/cross-entropy-is-kl-plus-entropy]
updated: 2026-11-03
---

You fit a logistic regression with gradient descent on a small dataset where one line separates the two classes with no errors. The loss falls at every epoch, the weights grow at every epoch, and the run never settles. A colleague proposes a squared error loss instead, because it has a clear bottom. What is happening, and what do you do?

## Short answer

On separable data the log loss has no finite minimum: scaling the weights up pushes every probability closer to its label and the loss closer to zero, so descent walks forever. Squared error through a sigmoid is a worse trade, because that cost surface is not convex and has flat regions where the gradient dies. Keep the log loss and add an L2 penalty, which gives one finite, unique minimum.

## Full answer

### Why the log loss is the right loss

The model is a linear score z = w x + b passed through a sigmoid, and the binary cross-entropy is minus the mean of y log p plus (1 - y) log (1 - p). For this model the loss is convex, so every local minimum is the global one and gradient descent cannot stop in a bad valley. The gradient has the same clean form as in linear regression, the mean of (p - y) times x, with p the sigmoid output instead of the raw score.

### What separable data does to it

When a line classifies every point correctly, multiplying w and b by a constant above 1 leaves the line in place and moves every probability toward 0 or 1. Each such step lowers the loss, so no finite w is the minimizer. In the run you see the loss fall, the weights grow, the probabilities saturate, and the sigmoid clamp in the code start to matter. The decision boundary itself has stopped changing.

### Why squared error does not help

Squared error on a sigmoid output is not convex. It has local minima, and where the sigmoid saturates its gradient is near zero, so a confident wrong prediction gets almost no correction. The lesson's reason to avoid it for classification is exactly this shape.

### The fix

Add an L2 penalty, lambda times the sum of squared weights, to the loss. Its gradient, two lambda times w, pulls every weight back toward zero at each step. The pull grows with the weights and the pull of the data loss shrinks as the probabilities saturate, so they balance at a finite point, and the minimum is unique. The library implementation in the lesson applies regularization by default for this reason.

## Follow-ups

- **Level 3:** Why is the cross-entropy convex for this model while squared error is not? Expected: the log of the sigmoid combines with the linear score into a convex function; squaring the gap between a sigmoid and a label creates flat regions and several local minima.
- **Level 3:** What does the decision boundary do while the weights grow? Expected: the line w x + b = 0 barely moves; only the steepness of the sigmoid across it grows, so predictions become overconfident.
- **Level 4:** How does the L2 penalty change each gradient step? Expected: it adds a term proportional to w to the gradient, so each step also shrinks the weights, and the shrinking balances the pull toward larger weights at a finite point.
- **Level 4:** The data is nearly separable instead. Does the problem go away? Expected: a finite minimum exists, but the weights are large and the probabilities overconfident; the penalty still helps calibration, and a validation loss shows it.

## Wrong answers

- "The falling loss means the model is still improving, let it run." The boundary stopped improving; only the confidence grows, until the weights overflow or every probability saturates.
- "Switch to squared error for a well-defined minimum." That surface is not convex with a sigmoid output, so descent can stop in a poor local minimum, and the gradient vanishes where the sigmoid saturates.
- "Add early stopping and call it solved." Stopping fixes the run time but leaves the weights wherever the clock ran out; a penalty gives a defined answer that does not depend on the epoch count.

## Taught in

The [logistic regression lesson](../../../phases/02-ml-fundamentals/03-logistic-regression/) explains why the log loss is convex and why separable data has no finite minimizer, and the [linear regression lesson](../../../phases/02-ml-fundamentals/02-linear-regression/) introduces the L2 penalty.
