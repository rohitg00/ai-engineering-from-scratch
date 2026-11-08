---
id: softmax-inf-at-large-logits
title: A cross-entropy that returns inf on real batches
card: math-classical-ml
kind: debug
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, ml-depth]
tags: [numerical-stability, softmax, log-sum-exp, overflow]
minutes: 8
lessons: [phases/01-math-foundations/13-numerical-stability, phases/01-math-foundations/06-probability-and-distributions]
manuals: []
practice: [softmax-cross-entropy]
cheatsheet: [information-numerics]
related: [math-classical-ml/log-probs-instead-of-products, math-classical-ml/variance-of-large-numbers]
updated: 2026-11-03
---

A from-scratch cross-entropy passes its unit tests on small logits. On real batches the loss comes back as inf. You print the batch and one logit vector is [100, 101, 102]. Walk me through the cause and the fix, and say why the fix is not an approximation.

## Short answer

The exponential of 100 is about 2.69 times 10 to the 43, far past the float32 maximum of about 3.4 times 10 to the 38, so each term of the softmax denominator overflows and the ratio is inf or nan. Subtract the largest logit from every logit before the exponential. The probabilities are identical in exact arithmetic, and the largest term is now exp(0), which is 1.

## Full answer

### Where the inf comes from

Softmax divides exp of one logit by the sum of exp of all logits. The exp function is the main source of overflow in ML code: exp(88.7) is close to the float32 limit and exp(89.0) is already inf. For the vector in the question every term overflows, so the sum is inf, the ratio is nan, and the log of that is nan or inf.

### The shift

Let c be the largest logit. Multiply numerator and denominator by exp(-c):

```text
softmax(x_i) = exp(x_i - c) / sum_j exp(x_j - c)
```

The factor exp(c) cancels, so the result is the same function. After the shift the largest exponent is exp(0) = 1, so nothing can overflow, and because one term equals 1 the sum is at least 1, so the log of the sum cannot reach minus infinity. For the vector in the question the shifted logits are -2, -1 and 0, the exponentials are 0.135, 0.368 and 1.000, and the probabilities are 0.090, 0.245 and 0.665.

### Compute log probabilities first

Do not compute a probability and then take its log. Compute the log probability straight from the logits:

```text
log_softmax(x_i) = (x_i - c) - log(sum_j exp(x_j - c))
loss = -log_softmax(x_true)
```

This is the log-sum-exp trick. A framework loss that takes logits fuses these two steps for the same reason. The same trick also saves the case where all logits are large negative numbers: without it, every exp underflows to 0 and the log gives minus infinity.

## Follow-ups

- **Level 2:** Why does the shift leave the probabilities unchanged? Expected: the factor exp(c) appears in the numerator and the denominator and cancels.
- **Level 2:** What goes wrong when every logit is very negative? Expected: every exponential underflows to 0 and the log of the sum is minus infinity; the same shift fixes it because the largest term becomes exp(0) = 1.
- **Level 3:** Why compute the loss from log-softmax rather than from the log of a softmax? Expected: a probability that underflowed to 0 has a log of minus infinity; log-softmax subtracts the log-sum-exp and never forms the probability.
- **Level 3:** A framework loss function takes logits, not probabilities. Why? Expected: it fuses log-softmax and the negative log-likelihood in one stable step, so the caller cannot overflow or underflow on the way in.

## Wrong answers

- "Clamp every logit at 80 and move on." A clamp changes the probabilities whenever a logit crosses it. The shift gives the exact same probabilities with no bound on the logits.
- "Switch to float64." A wider exponent only moves the overflow point. Logits grow during training and will pass it.
- "Add a small epsilon inside the log." The inf comes from the exponential, before the log. An epsilon does nothing about an infinite denominator.

## Taught in

The [numerical stability lesson](../../../phases/01-math-foundations/13-numerical-stability/) derives the log-sum-exp trick, and the [probability lesson](../../../phases/01-math-foundations/06-probability-and-distributions/) builds the stable softmax and log-softmax.
