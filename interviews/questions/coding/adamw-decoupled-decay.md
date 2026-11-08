---
id: adamw-decoupled-decay
title: Weight decay that went into the gradient
card: coding
kind: code-reading
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, ml-depth]
tags: [adamw, weight-decay, optimizer]
minutes: 10
lessons: [phases/19-capstone-projects/36-training-loop-eval, phases/19-capstone-projects/44-cosine-lr-warmup]
manuals: []
practice: [adam-step]
cheatsheet: [optimizers-schedules]
related: [coding/decay-split-param-groups, coding/lr-peak-sweep]
updated: 2026-11-03
---

A hand-written optimizer step is labeled AdamW. Review it:

```python
def adam_step(params, grad, m, v, t, lr, beta1, beta2, eps, weight_decay):
    grad = grad + weight_decay * params
    m = beta1 * m + (1 - beta1) * grad
    v = beta2 * v + (1 - beta2) * grad * grad
    m_hat = m / (1 - beta1 ** t)
    v_hat = v / (1 - beta2 ** t)
    return params - lr * m_hat / (np.sqrt(v_hat) + eps), m, v
```

Is this AdamW? What changes, and why does it matter for a language model?

## Short answer

No, this is Adam with an L2 penalty folded into the gradient. AdamW applies the decay directly to the parameters, scaled by the learning rate, outside the adaptive step. When the penalty goes through the gradient it is divided by the second-moment estimate, so parameters with large gradients get almost no decay and the regularization becomes uneven across the model.

## Full answer

### The corrected step

```python
def adam_step(params, grad, m, v, t, lr, beta1, beta2, eps, weight_decay):
    m = beta1 * m + (1 - beta1) * grad
    v = beta2 * v + (1 - beta2) * grad * grad
    m_hat = m / (1 - beta1 ** t)
    v_hat = v / (1 - beta2 ** t)
    new = params - lr * (m_hat / (np.sqrt(v_hat) + eps) + weight_decay * params)
    return new, m, v
```

The decay term is added to the update, not to the gradient. It never passes through the moment estimates.

### What the difference changes

Adam normalizes every coordinate by its running gradient magnitude. A penalty that enters as part of the gradient is normalized too, so a weight with a large, noisy gradient is barely decayed while a weight with a tiny gradient is decayed hard. Decoupled decay shrinks every weight by the same fraction per step, which is what the regularizer was meant to do. Language model recipes use the decoupled form, and the loop in the training lesson builds its parameter groups around it.

### Three more details the practice pins

- The step counter starts at one. With `t = 0` the bias correction divides by zero, and with `t + 1` the first step acts as the second.
- Epsilon sits outside the square root. Inside it, tiny gradients give a much smaller step than intended.
- The function returns new state arrays. Updating `m` and `v` in place changes the caller's state and breaks checkpoint resume.

### Where the decay should not go

Even with the correct form, the decay belongs on matrix-shaped weights only. Normalization scales and biases get no decay, which is the subject of the parameter group split.

## Follow-ups

- **Level 2:** What does the bias correction fix in the first steps? Expected: the moment estimates start at zero and are biased low early; dividing by `1 - beta**t` rescales them.
- **Level 2:** Why return new arrays instead of updating in place? Expected: a pure function keeps the caller's state intact, so a step can be retried or compared and a checkpoint stays consistent.
- **Level 3:** How does the learning rate schedule interact with decoupled decay? Expected: the decay is multiplied by the current learning rate, so warmup and cosine decay also scale the regularization over training.

## Wrong answers

- "L2 and weight decay are the same thing." They coincide for plain gradient descent, not for an adaptive optimizer that normalizes the gradient.
- "Put epsilon inside the square root for stability." It changes the step size for small gradients; the reference form adds it after the root.
- "Start the step counter at zero like an index." The bias correction then divides by zero on the first step.

## Taught in

The [training loop lesson](../../../phases/19-capstone-projects/36-training-loop-eval/) configures AdamW with its decay split, the [cosine schedule lesson](../../../phases/19-capstone-projects/44-cosine-lr-warmup/) pairs it with warmup and decay, and the [Adam practice](../../../practice/adam-step/) checks the decoupled form.
