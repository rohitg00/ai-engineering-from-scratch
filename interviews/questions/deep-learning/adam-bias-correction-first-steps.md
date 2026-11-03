---
id: adam-bias-correction-first-steps
title: What Adam's bias correction does in the first steps
card: deep-learning
kind: concept
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [ml-depth, screen]
tags: [optimizers, adam, bias-correction, learning-rate]
minutes: 8
lessons: [phases/03-deep-learning-core/06-optimizers]
manuals: []
practice: [adam-step]
cheatsheet: [optimizers-schedules]
related: [deep-learning/adamw-not-adam-plus-l2, deep-learning/warmup-before-the-peak-rate]
updated: 2026-11-03
---

Adam keeps a running average of the gradient and a running average of its square, and divides each by one minus beta to the power t before the update. A teammate deletes those two divisions to simplify the code. What changes in the first steps of training, and when does the change stop mattering?

## Short answer

Both averages start at zero, so at step one the first moment is only (1 - beta1) times the gradient, a tenth of it with beta1 at 0.9, and the second moment is a thousandth of the squared gradient with beta2 at 0.999. The divisions rescale both to unbiased estimates. Without them the square root of the second moment is shrunk more than the first moment, so the ratio and the step come out too large while the averages warm up. The first moment's factor is close to 1 after about 50 steps, but the second moment's factor, 1 - 0.999 to the t, stays well below 1 for thousands of steps, so without the division the step stays too large for that long.

## Full answer

### The two averages

```text
m = beta1 * m + (1 - beta1) * g        first moment, the mean gradient
v = beta2 * v + (1 - beta2) * g^2      second moment, the mean squared gradient
m_hat = m / (1 - beta1^t)
v_hat = v / (1 - beta2^t)
w = w - lr * m_hat / (sqrt(v_hat) + eps)
```

The first moment is momentum: with beta1 at 0.9 it averages about the last ten gradients, from 1 over (1 - 0.9). The second moment sets a per-parameter step size: a weight with large gradients is divided by a large number and moves less, a weight with small gradients moves more.

### Why the averages start wrong

At step one, m is 0.1 times the gradient. The average has not warmed up, and the lesson calls that ten times too small. The same holds for v with a factor of 0.001. Dividing m by (1 - 0.9) at step one gives back the gradient. At step 100 the factor (1 - 0.9 to the 100) is about 1.0, so the correction is gone. The lesson's rule for the first moment: it matters for the first 10 steps or so and is irrelevant after 50. The second moment is slower. With beta2 at 0.999 its factor approaches 1 only after thousands of steps, so its correction lasts much longer.

### What the deletion does

The two moments are shrunk by different factors, and the update takes their ratio after a square root. The first moment is shrunk by 0.1. The second moment is shrunk by 0.001, and its square root by less than 0.1, so the denominator is too small and the step is too large. The early updates take oversized steps on statistics built from one or two gradients. The symptom is a loss that jumps in the first steps and a run that sometimes diverges before it settles.

### What else guards the first steps

Warmup, a small learning rate that ramps up over the first steps, protects the same period for a different reason: the correction fixes the scale of the averages, not their noise. The lesson's advice on tuning: change the learning rate first, then beta2, almost never beta1 or epsilon.

## Follow-ups

- **Level 2:** What does the first moment estimate and what does the second? Expected: the running mean of the gradient, which is momentum, and the running mean of the squared gradient, which sets a per-parameter step size.
- **Level 2:** With beta1 at 0.9, how many past gradients does the first moment roughly average? Expected: about ten, from 1 over (1 - 0.9).
- **Level 3:** Why does Adam still want a warmup if bias correction exists? Expected: the correction fixes the scale of the averages, not their noise; a few steps of statistics are a poor estimate, so a small early learning rate limits the damage.
- **Level 3:** Which Adam hyperparameter do you change first when training is unstable? Expected: the learning rate, then beta2; almost never beta1 or epsilon.

## Wrong answers

- "The division is a numerical safety term like epsilon." Epsilon guards a zero denominator; the division by one minus beta to the t corrects the zero initialization of the averages.
- "Without it the first steps are too small, so training is only slower." The second moment's square root is shrunk more than the first moment, so the ratio and the step come out too large.
- "Both corrections stop mattering after about 50 steps." That holds for the first moment only. With beta2 at 0.999 the second moment's factor stays well below 1 for thousands of steps.

## Taught in

The [optimizers lesson](../../../phases/03-deep-learning-core/06-optimizers/) builds Adam from scratch and works the step one example.
