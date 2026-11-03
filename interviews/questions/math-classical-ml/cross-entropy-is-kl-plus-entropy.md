---
id: cross-entropy-is-kl-plus-entropy
title: Why minimizing cross-entropy also minimizes KL
card: math-classical-ml
kind: concept
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [ml-depth, screen]
tags: [information-theory, cross-entropy, kl-divergence, entropy]
minutes: 8
lessons: [phases/01-math-foundations/09-information-theory]
manuals: []
practice: [softmax-cross-entropy]
cheatsheet: [information-numerics]
related: [math-classical-ml/perplexity-from-cross-entropy, math-classical-ml/softmax-inf-at-large-logits]
updated: 2026-11-03
---

Your classifier trains on a cross-entropy loss. A reviewer asks why you do not train on the KL divergence between the labels and the predictions instead. Explain how the two quantities relate and what would change, if anything, in training.

## Short answer

Cross-entropy of P and Q equals the entropy of P plus the KL divergence from P to Q. The labels fix P, so their entropy is a constant during training, and the two objectives have the same gradient. With one-hot labels the entropy is zero and the two numbers are equal: minus the log of the predicted probability of the true class.

## Full answer

### The three quantities

```text
H(P)     = - sum_x p(x) log p(x)             entropy of the true distribution
H(P, Q)  = - sum_x p(x) log q(x)             cross-entropy, P true, Q predicted
KL(P||Q) =   sum_x p(x) log (p(x) / q(x))    = H(P, Q) - H(P)
```

Entropy is the average surprise of P under its own code. Cross-entropy is the average surprise when events from P are coded with Q. KL is the extra surprise, the bits wasted by coding with Q instead of P.

### Why the optimizer cannot tell them apart

The model controls Q. The labels fix P, so H(P) is a constant for each sample. The gradient of a constant is zero, so the gradient of H(P, Q) and the gradient of KL(P||Q) with respect to the model are the same. With a one-hot label the sum has one nonzero term, H(P) is 0, and the loss is minus the log of the predicted probability of the true class.

### When the two numbers differ

The values differ when the target has positive entropy. Label smoothing turns a hard target into a soft one, and a teacher's softmax in distillation is soft from the start. Then cross-entropy cannot go below H(P), while KL reaches 0 at a perfect match. The gradients are still equal, so the choice changes the number you log, not the model you get.

### Two facts to say out loud

- KL is not symmetric. KL(P||Q) and KL(Q||P) weight the log ratio by different distributions, so it is not a distance.
- The gradient of cross-entropy with respect to the logits is the predicted probability minus the target. That clean form is why it pairs with softmax.

## Follow-ups

- **Level 2:** Why is KL not a distance? Expected: it is not symmetric; each direction weights the log ratio by a different distribution.
- **Level 3:** With label smoothing the loss never reaches zero. Why? Expected: the soft target has positive entropy, and cross-entropy is at least the entropy of the target; KL would reach zero at a perfect match.
- **Level 3:** Differentiate the loss by each logit. What form do you get? Expected: the predicted probability minus the target, for each class.
- **Level 4:** In distillation the target is a teacher's softmax. Which of the two numbers do you log? Expected: KL, because the teacher's entropy is a constant offset per sample that hides how close the student is; the gradient is the same either way.

## Wrong answers

- "They are different objectives and give different models." They differ by the entropy of the labels, which does not depend on the model, so the gradients are equal.
- "Cross-entropy is a distance between two distributions." It is not symmetric, and it is not zero when the distributions match; it equals the entropy of P at a match.
- "KL is smaller, so it is the better loss." KL is cross-entropy minus a constant. The optimizer sees the same slope.

## Taught in

The [information theory lesson](../../../phases/01-math-foundations/09-information-theory/) derives entropy, cross-entropy and KL from scratch and shows the three views of the classification loss.
