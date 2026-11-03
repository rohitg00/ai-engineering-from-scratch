---
id: past-the-interpolation-threshold
title: Test error that falls, spikes and falls again
card: math-classical-ml
kind: concept
level: 4
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [ml-depth, system-design]
tags: [bias-variance, double-descent, overparameterization, regularization]
minutes: 15
lessons: [phases/02-ml-fundamentals/10-bias-variance]
manuals: []
practice: [lab-bias-variance]
cheatsheet: [ml-model-comparison]
related: [math-classical-ml/bag-or-boost-the-base-model, math-classical-ml/compare-two-models-with-folds]
updated: 2026-11-03
---

A team keeps growing a model. Test error falls, then spikes as the parameter count approaches the number of training rows, then falls again as they keep going. The classical U-shaped curve predicts the spike but not the second fall. Explain what the curve shows, and give the team a rule about model size.

## Short answer

The spike sits at the interpolation threshold, where the model has just enough capacity to fit every training row and is forced into one specific, noise-sensitive solution, so variance peaks. Past it, many solutions fit the training data and gradient descent's implicit regularization picks a simple one, so error falls again. That is double descent. The rule: stay well below the threshold with explicit regularization, or go well past it; the worst place to sit is on it.

## Full answer

### The classical picture

Expected error is squared bias plus variance plus irreducible noise. As capacity grows, bias falls and variance rises, and the sum has one minimum. The classical rule was that more capacity past that point always hurts.

### The three regimes

| Regime | Parameters against rows | Behavior |
|---|---|---|
| Underparameterized | far fewer | the classical trade-off applies |
| Interpolation threshold | about equal | variance peaks, test error spikes |
| Overparameterized | far more | implicit regularization, test error falls |

At the threshold the model can just barely thread every training point, and a small change in the data moves the fit a lot. Past it, the training data no longer pins down one solution, and the learning algorithm chooses among the many that fit. Gradient descent tends to pick a simple one, and that bias toward simplicity is why heavily overparameterized networks generalize.

### What the lesson adds

- The pattern appears in linear models, decision trees and neural networks.
- More data can hurt near the threshold, because adding rows moves the threshold under a fixed model. That is the sample-wise form. Training longer can produce the same curve over epochs.
- Regularization smooths and lowers the peak but does not remove it.

### The rule for the team

Measure where the threshold is: training error reaches zero and test error peaks at about the same size. Then size the model far from it on one side or the other. Below it, use explicit regularization and the classical diagnostics. Above it, keep going and verify with learning curves rather than with the classical intuition.

## Follow-ups

- **Level 3:** How do you recognize the threshold in a training log? Expected: training error reaches zero and test error is at its worst at about the same model size or epoch.
- **Level 4:** Why can adding data hurt in this regime? Expected: more rows move the threshold; a fixed model that was past it can land on it, which is the sample-wise form.
- **Level 4:** What does regularization do to the peak? Expected: it smooths and lowers the peak but does not remove it.
- **Level 4:** Does this make the bias-variance trade-off wrong? Expected: no; it holds below the threshold and is incomplete above it, where the implicit bias of the optimizer takes over.

## Wrong answers

- "The second fall is a measurement error." It appears in linear models, trees and networks, and in both the sample-wise and epoch-wise forms.
- "Make the model as big as the budget allows and stop thinking about it." Bigger past the threshold works, but sitting on the threshold is the worst outcome; size the model deliberately away from it.
- "Regularization removes the problem." It smooths and lowers the peak; it does not remove it.

## Taught in

The [bias-variance lesson](../../../phases/02-ml-fundamentals/10-bias-variance/) derives the decomposition and describes double descent and its three regimes.
