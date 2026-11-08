---
id: xor-needs-a-hidden-layer
title: Why one perceptron never learns XOR
card: deep-learning
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [screen, ml-breadth]
tags: [perceptron, xor, linear-separability, hidden-layer]
minutes: 5
lessons: [phases/03-deep-learning-core/01-the-perceptron, phases/03-deep-learning-core/02-multi-layer-networks]
manuals: []
practice: [train-xor-mlp]
cheatsheet: [neural-net-basics]
related: [deep-learning/stacked-linear-layers-collapse, deep-learning/weight-matrix-rows-and-columns]
updated: 2026-11-03
---

A single perceptron learns the AND and OR gates in a few epochs. On the XOR gate it never converges, even after 1000 epochs. Why not, and what is the smallest change to the model that makes XOR learnable?

## Short answer

A perceptron takes a weighted sum, adds a bias and applies a threshold, so its decision boundary is one straight line. AND and OR put their ones on one side of a line. XOR puts the ones at (0, 1) and (1, 0) and the zeros at (0, 0) and (1, 1), and no single line separates those two pairs. Add a hidden layer: two neurons that compute OR and NAND, and an output neuron that ANDs them, give XOR exactly.

## Full answer

### What one perceptron can draw

The output is 1 when w1 x1 + w2 x2 + b is at least 0 and 0 otherwise. The set of points where the sum equals 0 is a line, and training moves that line. The learning rule is small: when a prediction is wrong, add the learning rate times the error times the input to each weight, and the error to the bias. When the prediction is right, the error is 0 and nothing moves. On a linearly separable dataset this finds a separating line. On XOR there is none, so the weights keep changing forever. The lesson's run with 1000 epochs reports that it did not converge.

### The fix

XOR equals (x1 OR x2) AND NOT (x1 AND x2). Three perceptrons in two layers compute it:

```text
OR neuron:    weights [1.0, 1.0],   bias -0.5
NAND neuron:  weights [-1.0, -1.0], bias 1.5
AND neuron:   weights [1.0, 1.0],   bias -1.5   on the two hidden outputs
```

The first layer turns the four input points into new features. In that feature space the two classes are separable, and the output neuron draws a line there.

### From hand-wired to learned

The step function has no useful gradient, so the hidden weights cannot be learned by backpropagation. Replace it with a sigmoid, which is smooth, and the same 2-2-1 shape learns XOR from random weights. The multi-layer lesson shows the hand-wired sigmoid version, with weights of 20 and -20 and biases of -10, 30 and -30, where the large weights make the sigmoid act like a step. This is the point where a perceptron becomes a neural network.

## Follow-ups

- **Level 1:** What does the learning rule do when a prediction is right? Expected: the error is 0, so no weight changes.
- **Level 2:** Why does the step function block learning in the two layer version? Expected: it has no useful gradient, so backpropagation cannot assign blame to the hidden weights; the sigmoid is smooth and has a gradient everywhere.
- **Level 2:** Why do weights of 20 and -20 work in the sigmoid version? Expected: large weights make the sigmoid act like a step, so each hidden neuron is a crisp OR or NAND.
- **Level 3:** Is a three input majority function linearly separable? Expected: yes; output 1 when at least two inputs are 1 is a half space, so one perceptron learns it.

## Wrong answers

- "Train longer or raise the learning rate." No line separates the XOR points, so no number of epochs finds one.
- "Add more inputs or more neurons in the same layer." A wider single layer still draws one line through the same plane.
- "A hidden layer with no activation fixes it." Two linear layers compose into one linear map, which is one line again. The hidden layer needs a nonlinearity.

## Taught in

The [perceptron lesson](../../../phases/03-deep-learning-core/01-the-perceptron/) shows the XOR failure and the three gate solution, and the [multi-layer networks lesson](../../../phases/03-deep-learning-core/02-multi-layer-networks/) builds the sigmoid version.
