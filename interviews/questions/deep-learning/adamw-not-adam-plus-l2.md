---
id: adamw-not-adam-plus-l2
title: Weight decay in the loss or in the optimizer
card: deep-learning
kind: tradeoff
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [ml-depth, design-review]
tags: [optimizers, adamw, weight-decay, regularization]
minutes: 8
lessons: [phases/03-deep-learning-core/06-optimizers, phases/03-deep-learning-core/07-regularization]
manuals: []
practice: [adam-step]
cheatsheet: [optimizers-schedules]
related: [deep-learning/adam-bias-correction-first-steps, deep-learning/train-mode-and-eval-mode]
updated: 2026-11-03
---

You want weight decay on a transformer trained with Adam. One engineer adds an L2 penalty on the weights to the loss. Another uses an AdamW optimizer with a weight decay argument. They say the two are the same thing. Are they, and which do you choose?

## Short answer

They are the same only under plain SGD. In Adam, a penalty inside the loss becomes part of the gradient and is divided by the running gradient size like every other term, so weights with large gradient variance get less decay and weights with small variance get more. AdamW subtracts lr times lambda times w after the adaptive update, so every weight shrinks by the same fraction. Choose AdamW; the lesson makes it the default for transformers for this reason.

## Full answer

### Where they agree

The L2 term lambda over 2 times the sum of w squared has gradient lambda w. Under SGD the update subtracts lr times lambda w from each weight, which is weight decay by definition. Both names describe one operation.

### Where Adam breaks the equivalence

Adam does not apply the gradient. It averages it into the first moment, squares it into the second, and divides by the root of the second moment. A penalty that rides along in the gradient is rescaled per parameter by that division. A weight with noisy, large gradients has a large second moment and receives a small share of the decay. A weight with quiet gradients receives a large share. The regularization is uneven, and the lesson reports that it converges to worse solutions than the decoupled form on almost every task.

### What AdamW does instead

```text
w = w - lr * m_hat / (sqrt(v_hat) + eps) - lr * lambda * w
```

The decay term sits outside the adaptive factor. Every weight loses the same fraction lr times lambda at each step. In the lesson's from-scratch class this is one extra line after the Adam update: subtract lr times weight decay times the parameter.

### Values the lessons give

- 0.01 for AdamW on transformers; the fine-tuning default is also 0.01.
- 1e-4 for SGD on CNNs, where the two forms coincide.
- Up to 0.1 for a model that overfits heavily.

### A test that shows the difference

The lesson's exercise: initialize weights with large magnitudes, train Adam with L2 and AdamW with the same decay, and plot the weight norm over training. AdamW shrinks it faster and more evenly.

## Follow-ups

- **Level 2:** Why is the decay uniform in AdamW? Expected: it is applied to the weights directly, outside the adaptive division, so the fraction removed per step is lr times lambda for every weight.
- **Level 3:** Where exactly does the penalty go wrong inside Adam? Expected: it enters the gradient, so it is averaged into the first moment and squared into the second, and the division by the root of the second moment rescales it per parameter.
- **Level 3:** What decay values does the lesson give? Expected: 0.01 for AdamW on transformers, 1e-4 for SGD on CNNs, up to 0.1 for a heavily overfit model.
- **Level 4:** What experiment shows the difference in a few lines? Expected: start from weights of large magnitude, train both with the same decay, and plot the weight norm; AdamW shrinks it faster and more evenly.

## Wrong answers

- "Weight decay and L2 are the same by definition." They coincide under SGD; under an adaptive optimizer the penalty is rescaled per parameter.
- "Use Adam with L2 and a bigger lambda to compensate." A bigger lambda does not fix the unevenness; some weights still receive almost no decay.
- "Adam adapts, so it does not need weight decay." Adaptation sets step sizes; it does not shrink weights. Overfit transformers still need decay.

## Taught in

The [optimizers lesson](../../../phases/03-deep-learning-core/06-optimizers/) builds Adam and AdamW and explains the decoupling, and the [regularization lesson](../../../phases/03-deep-learning-core/07-regularization/) gives the decay values.
