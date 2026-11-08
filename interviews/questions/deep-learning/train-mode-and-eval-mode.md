---
id: train-mode-and-eval-mode
title: Test accuracy that changes with the same weights
card: deep-learning
kind: concept
level: 1
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, inference-engineer]
rounds: [screen, debugging]
tags: [dropout, batch-norm, eval-mode, inference]
minutes: 5
lessons: [phases/03-deep-learning-core/07-regularization, phases/03-deep-learning-core/10-mini-framework]
manuals: []
practice: [inverted-dropout, batch-norm]
cheatsheet: [deep-learning-training]
related: [deep-learning/inverted-dropout-scale, deep-learning/layernorm-not-batchnorm]
updated: 2026-11-03
---

A saved model gives a different test accuracy each time you evaluate it on the same test set with the same weights. The data loader does not shuffle. What is the most likely cause, and which two layer types are involved?

## Short answer

The model is still in training mode at test time. Dropout keeps zeroing random units, so each forward pass runs a different subnetwork, and batch normalization keeps using the mean and variance of the current batch instead of its running averages. Switch to evaluation mode before inference and turn gradient tracking off.

## Full answer

### Two layers that behave differently by mode

| Layer | Training mode | Evaluation mode |
|---|---|---|
| Dropout | zero each unit with probability p, scale the rest by 1 over (1 - p) | pass everything through unchanged |
| Batch normalization | normalize with the batch mean and variance, update the running averages | normalize with the running averages |

Both layers read one flag, the training flag of the module. In the mini framework, a Sequential container's train and eval methods set the flag on the container and on every module inside it. A framework does the same with model.train() and model.eval().

### Why the accuracy moves

With dropout active, each forward pass draws a new mask, so the same input gives a different output and some predictions flip across the threshold. With batch statistics active, each prediction depends on which other rows sit in its batch, and a batch of one has a variance of zero, which makes the normalization meaningless. The lesson calls a forgotten eval call one of the most common bugs in deep learning, and this symptom is its signature.

### The fix and its mirror image

Call eval before inference and wrap the pass in no_grad, which also saves memory. Then call train again before the next epoch. The mirror bug is as common: a model left in evaluation mode after validation trains with dropout off and with batch norm's running averages frozen, so it loses its regularization and its inference statistics go stale.

## Follow-ups

- **Level 1:** What does dropout do in evaluation mode? Expected: nothing; it passes every value through unchanged, because the scaling was applied during training.
- **Level 2:** Why can batch normalization not use batch statistics for a batch of one at test time? Expected: the variance of one sample is zero, so the statistics are meaningless; the running averages must be used.
- **Level 2:** How does a container pass the mode to its children? Expected: its train and eval methods set the flag on the container and on every module inside it.
- **Level 3:** You forget to switch back to training mode after validation. What happens in the next epoch? Expected: dropout stays off and batch norm stops updating its running statistics, so the model trains without regularization and its inference statistics go stale.

## Wrong answers

- "Set a random seed before each evaluation." That hides the symptom; the model still evaluates with dropout and batch statistics active, so the accuracy is wrong, just repeatably wrong.
- "GPU arithmetic is nondeterministic, this is normal." That gives differences far below one changed prediction, not a moving accuracy.
- "Remove dropout from the architecture." Dropout is a training time regularizer; the fix is to switch modes, not to delete the layer.

## Taught in

The [regularization lesson](../../../phases/03-deep-learning-core/07-regularization/) builds both layers in both modes, and the [mini framework lesson](../../../phases/03-deep-learning-core/10-mini-framework/) adds the training flag to every module.
