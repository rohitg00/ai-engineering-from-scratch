---
name: skill-perceptron
description: Understand the perceptron pattern and when to use single-layer vs multi-layer architectures
version: 1.0.0
phase: 3
lesson: 1
tags: [perceptron, neural-networks, classification, deep-learning]
---

# The Perceptron Pattern

A perceptron computes a weighted sum of inputs plus a bias, then applies a step function to produce a binary output. It is the fundamental unit of neural networks.

```
output = step(w1*x1 + w2*x2 + ... + wn*xn + bias)
```

## When a single perceptron is enough

- The problem is linearly separable: a straight line (or hyperplane) can divide the two classes
- Logic gates: AND, OR, NOT, NAND
- Simple threshold decisions: "is the score above X?"
- Binary classifiers on data that clusters into two non-overlapping regions

## When you need multiple layers

- The problem is not linearly separable: no single line can separate the classes
- XOR and parity problems
- Any task requiring "this but not that" reasoning (combinations of conditions)
- Real-world classification: images, text, audio - almost always non-linear

## Decision checklist

1. Plot or inspect your data. Can you draw a single straight boundary between classes?
   - Yes: single perceptron works
   - No: you need at least two layers
2. Can the problem be decomposed into AND/OR of simpler linear decisions?
   - This decomposition tells you the minimum network structure
   - XOR = (A OR B) AND (NOT (A AND B)) = 3 perceptrons in 2 layers
3. For problems with more than two classes, you need one output node per class

## The training rule

```
error = expected - predicted
weight_new = weight_old + learning_rate * error * input
bias_new = bias_old + learning_rate * error
```

If the prediction is correct, nothing changes. If wrong, weights shift to reduce the error. This only works for single-layer perceptrons. Multi-layer networks require backpropagation.

## Common mistakes

- Trying to learn non-linear patterns with a single perceptron (it will never converge)
- Setting the learning rate too high (weights oscillate) or too low (training takes forever)
- Forgetting the bias term (without it, the decision boundary must pass through the origin)
- Confusing perceptron convergence (guaranteed for linearly separable data) with general neural network convergence (not guaranteed)
