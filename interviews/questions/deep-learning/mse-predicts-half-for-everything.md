---
id: mse-predicts-half-for-everything
title: A classifier that predicts 0.5 and has a low loss
card: deep-learning
kind: concept
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [ml-depth, screen]
tags: [loss-functions, cross-entropy, mse, classification]
minutes: 8
lessons: [phases/03-deep-learning-core/05-loss-functions]
manuals: []
practice: [softmax-cross-entropy]
cheatsheet: [deep-learning-training]
related: [deep-learning/softmax-cross-entropy-gradient, deep-learning/loss-stuck-at-log-classes]
updated: 2026-11-03
---

A binary classifier trained with mean squared error on a balanced dataset settles on an output near 0.5 for every input. The loss is low and stable, and the optimizer reports no problem. Explain why the optimizer is content and which loss you switch to.

## Short answer

With two classes split evenly, a constant output of 0.5 gives a squared error of 0.25 on every row, which the lesson calls the minimum MSE a model can reach without learning anything, and the sigmoid's flat regions give MSE almost no gradient near a confident wrong answer. Cross-entropy charges minus the log of the predicted probability of the true class: 0.693 for 0.5, 0.01 for 0.99 and 4.6 for 0.01, so it pushes each prediction toward its label. Switch to binary cross-entropy.

## Full answer

### Why MSE is content

MSE averages the squared gap between the prediction and the label. Its gradient with respect to a prediction is linear in the gap. The prediction passes through a sigmoid, whose derivative is p(1 - p) and is near zero when p is near 0 or 1. A confident wrong answer, p near 0 for a positive row, sits exactly where the sigmoid is flat, so the update is tiny. A model can lower the loss a little by moving everything toward the middle and then stop, because the gradient has little left to say.

### Why cross-entropy is not

Binary cross-entropy is minus y log p minus (1 - y) log (1 - p). Its derivative with respect to p is minus y over p plus (1 - y) over (1 - p). For a positive row with p near 0 that is about minus 1 over p, which grows without bound as p falls. The log undoes the sigmoid: the derivative of the loss with respect to the logit is the prediction minus the target, linear in the error and never flat. The lesson's scale: a right answer at 0.99 costs 0.01, a wrong answer at 0.01 costs 4.6, a ratio of about 460.

### The multi-class version

Categorical cross-entropy on a one-hot target reduces to minus the log of the probability of the true class. A random guess among 10 classes puts probability 0.1 there and costs 2.3; a probability of 0.9 costs 0.105. A loss stuck near 2.3 on a 10 class problem is the multi-class twin of the 0.5 symptom.

### When the switch does not help

The switch helps only when the inputs carry signal about the label. On balanced data with no predictive features, both losses are lowest at a constant 0.5, so cross-entropy settles there too. Check that a simple model beats the constant before you blame the loss.

### Where MSE belongs

Regression on real valued targets, where a linear gradient in the error is what you want. For targets with heavy outliers, MAE or a Huber loss are the lesson's alternatives.

## Follow-ups

- **Level 2:** Write the derivative of binary cross-entropy with respect to p. Expected: minus y over p plus (1 - y) over (1 - p), which grows without bound when p is near 0 for a positive row.
- **Level 2:** Why does a prediction of 0.5 cost 0.693 under cross-entropy? Expected: it is minus the natural log of 0.5.
- **Level 3:** After the sigmoid, differentiate cross-entropy by the logit. What do you get? Expected: the prediction minus the target; the log cancels the sigmoid's derivative.
- **Level 3:** When is MSE the right loss? Expected: regression on real valued targets; for heavy outliers, MAE or a Huber loss.

## Wrong answers

- "Lower the learning rate so MSE converges properly." The 0.5 output is where MSE is content; a smaller step arrives there more slowly.
- "MSE and cross-entropy have the same minimizer, so it does not matter." They agree only at a perfect fit. Away from it, MSE's gradient flattens where cross-entropy's grows.
- "Use accuracy as the loss instead." Accuracy has no useful gradient; the optimizer needs a smooth loss.

## Taught in

The [loss functions lesson](../../../phases/03-deep-learning-core/05-loss-functions/) opens with this failure and derives both gradients.
