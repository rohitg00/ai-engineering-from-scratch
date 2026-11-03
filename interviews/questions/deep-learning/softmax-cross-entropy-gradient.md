---
id: softmax-cross-entropy-gradient
title: Three lines that differentiate the cross-entropy loss
card: deep-learning
kind: code-reading
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, ml-depth]
tags: [cross-entropy, softmax, gradient, loss-functions]
minutes: 8
lessons: [phases/03-deep-learning-core/05-loss-functions]
manuals: []
practice: [softmax-cross-entropy]
cheatsheet: [deep-learning-training]
related: [deep-learning/mse-predicts-half-for-everything, deep-learning/loss-stuck-at-log-classes]
updated: 2026-11-03
---

This function claims to return, for each logit, the derivative of the cross-entropy loss.

```python
def cce_gradient(logits, target_index):
    probs = softmax(logits)
    grads = list(probs)
    grads[target_index] -= 1.0
    return grads
```

Explain why three lines are enough. Then describe the gradient vector when the model is sure and right, and when it is sure and wrong.

## Short answer

For softmax followed by cross-entropy on a one-hot target, the derivative of the loss with respect to logit i is the predicted probability of class i minus the target for class i. The function copies the probabilities and subtracts 1 at the true class, which is that vector. When the model is confident and right, every entry is near zero. When it is confident and wrong, the entry at the true class is near minus 1 and the entry at the class it chose is near plus 1.

## Full answer

### Why the form is so simple

The loss is minus the log of the probability of the true class, and that probability is exp of the true logit over the sum of exp of all logits. Differentiate with respect to logit i: the log of the denominator contributes plus p_i for every i, and the log of the numerator contributes minus 1 only for the true class. The softmax derivative on its own is a full matrix; combined with the log it collapses to p minus the one-hot target. The lesson's phrase is that softmax and cross-entropy are paired on purpose.

### Reading the vector

- Confident right: p at the true class is near 1, so that entry is near 0, and every other p is near 0. Almost no update.
- Confident wrong: p at the true class is near 0, so that entry is near minus 1; the chosen class has p near 1 and an entry near plus 1. A large update that lowers the chosen logit and raises the true one.
- The entries sum to zero, because the probabilities sum to 1 and so does the one-hot target. That is a quick check for a hand-written version.

### What the three lines rely on

The softmax call must be the stable one, with the largest logit subtracted before the exponential, or large logits give inf. A framework fuses log-softmax and the negative log-likelihood into one loss that takes logits, for the same reason; the lesson's rule is to call that fused loss rather than a softmax followed by a separate log.

### With label smoothing

Replace the one-hot target by the smoothed vector: with alpha of 0.1 on ten classes the true class gets 0.91 and the others 0.01. The gradient is p minus that vector, so it reaches zero at 0.91, not at 1.0, which keeps the logits from running to infinity.

## Follow-ups

- **Level 2:** What does the gradient vector sum to? Expected: zero; the probabilities sum to 1 and the one-hot target sums to 1.
- **Level 2:** Why pair softmax with cross-entropy rather than with squared error? Expected: the log undoes the exponential, so the gradient is linear in the error and never flattens.
- **Level 3:** How does the gradient change with label smoothing of 0.1 on ten classes? Expected: the target becomes 0.91 at the true class and 0.01 elsewhere, so the gradient is p minus that vector and reaches zero at 0.91, not at 1.0.
- **Level 3:** A framework offers a loss on logits and a loss on log probabilities. Which do you call? Expected: the one on logits, which fuses log-softmax and the negative log-likelihood in one numerically stable step.

## Wrong answers

- "The gradient is minus 1 over p at the true class, like binary cross-entropy." That is the derivative with respect to the probability; through the softmax, the derivative with respect to the logit is p minus the target.
- "Only the true class has a gradient, because only it appears in the loss." Every logit appears in the softmax denominator, so every logit receives its p as gradient.
- "Divide by the number of classes." The gradient per sample is p minus the target; averaging over a batch divides by the batch size, not the class count.

## Taught in

The [loss functions lesson](../../../phases/03-deep-learning-core/05-loss-functions/) writes this function and explains why the pairing simplifies.
