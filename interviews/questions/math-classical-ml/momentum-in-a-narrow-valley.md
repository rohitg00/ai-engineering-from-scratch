---
id: momentum-in-a-narrow-valley
title: Why plain gradient descent zigzags and momentum does not
card: math-classical-ml
kind: concept
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [ml-depth, screen]
tags: [optimization, gradient-descent, momentum, learning-rate]
minutes: 8
lessons: [phases/01-math-foundations/08-optimization]
manuals: []
practice: [sgd-momentum]
cheatsheet: [calculus-optimization]
related: [math-classical-ml/reverse-mode-one-pass]
updated: 2026-11-03
---

You minimize the Rosenbrock function from the point (-1, 1). Plain gradient descent creeps along the curved valley and needs thousands of steps. The same run with momentum arrives much sooner. Explain what the valley does to plain descent and what momentum changes.

## Short answer

In a narrow valley the gradient points across the valley, not along it, so each plain step jumps from one wall to the other and makes little progress toward the minimum. Momentum keeps a velocity that sums past gradients. The across components flip sign and cancel, the along component keeps its sign and builds up, so the path is smooth and fast.

## Full answer

### The function

The function is (1 - x)^2 + 100 (y - x^2)^2. Its minimum is at (1, 1), at the bottom of a curved valley. The factor 100 makes the valley walls steep and the floor almost flat, so the gradient is large across the valley and small along it.

### Plain descent

The update is w = w - lr times gradient. The step size is set by the learning rate alone. A learning rate large enough to move along the floor overshoots across the walls, and a learning rate small enough to stay inside the walls crawls along the floor. The lesson runs this with a learning rate of 0.0005 for 5000 steps and still sees slow progress.

### Momentum

```text
v = beta * v + gradient
w = w - lr * v
```

The velocity is an exponential sum of past gradients. Components that flip sign at each step cancel inside the sum. Components with a stable sign add up and the ball rolls faster along the floor. The lesson uses beta equal to 0.9, which keeps about the last ten gradients in play. A larger beta gives more smoothing and a slower response when the valley turns.

### Where this leads

Adam goes one step further and also divides each weight's step by the running size of its gradients, so each weight gets its own step size. On the Rosenbrock run in the lesson, Adam with a learning rate of 0.01 converges fastest, momentum follows a smoother path, and plain descent trails.

## Follow-ups

- **Level 2:** What does beta control? Expected: how much of the past velocity survives each step; 0.9 keeps roughly the last ten gradients.
- **Level 3:** Momentum overshoots the minimum and comes back. Why? Expected: the velocity carries the point past the bottom when the gradient has already changed sign; a smaller beta or a decaying learning rate damps it.
- **Level 3:** How does this zigzag show up in a real training run? Expected: the loss drops fast and then plateaus while the weights oscillate; a smaller learning rate or momentum smooths it.
- **Level 4:** Why does Adam help on the same valley beyond what momentum does? Expected: it scales each weight's step by the inverse of its running gradient size, so the steep direction takes small steps and the flat direction takes large ones.

## Wrong answers

- "Raise the learning rate until plain descent moves faster." A larger step jumps further across the valley and diverges before it speeds up the along direction.
- "Momentum is a bigger learning rate." The velocity grows only where gradients keep their sign and cancels where they flip, which a scalar learning rate cannot do.
- "The valley is a local minimum, so the optimizer is stuck." The gradient is not zero on the valley floor. The point moves at every step, slowly.

## Taught in

The [optimization lesson](../../../phases/01-math-foundations/08-optimization/) builds plain descent, momentum and Adam and runs them on the Rosenbrock function.
