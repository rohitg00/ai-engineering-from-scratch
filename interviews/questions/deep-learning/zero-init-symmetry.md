---
id: zero-init-symmetry
title: A wide layer that behaves like one neuron
card: deep-learning
kind: concept
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [screen, debugging]
tags: [weight-initialization, symmetry, zero-init, debugging]
minutes: 6
lessons: [phases/03-deep-learning-core/08-weight-initialization]
manuals: []
practice: []
cheatsheet: [deep-learning-training]
related: [deep-learning/kaiming-factor-of-two, deep-learning/half-the-relus-are-dead]
updated: 2026-11-03
---

A network with a hidden layer of 512 units is initialized with every weight and every bias at zero. Training runs for thousands of epochs and the loss barely moves. Learning rate and data both check out. What is wrong, and why does a small random perturbation of each weight fix it?

## Short answer

Every neuron in the layer starts identical, so each computes the same output, receives the same gradient and takes the same update. They stay identical for the whole run: the layer holds the parameters of 512 neurons and the function of one. Random initialization gives each neuron its own starting point, so the gradients differ and the neurons learn different features. The scale of that randomness then decides whether the signal survives the depth.

## Full answer

### The symmetry

All neurons in a layer have the same structure: a weighted sum of the same inputs, a bias, an activation. Whatever makes them different must come from the weights. If the weights are equal, the outputs are equal. Backpropagation then hands each neuron the same gradient, because each contributed the same amount to the loss. The update is the same, and the weights are equal again. Nothing in gradient descent can split them. The lesson's demo builds four zero-initialized neurons, feeds one input, prints four identical outputs, and counts one effective parameter instead of the eight that were allocated.

### Why zero is only the extreme case

Any constant initialization has the same flaw. Setting every weight to 0.5 produces 512 copies of one neuron just as zero does. Random values are the brute force way to break the tie, and they are also why two runs with different seeds learn different features.

### Biases can stay at zero

The lesson's layers draw random weights and set the biases to 0.0. That is fine: the weights already differ across neurons, so the biases do not need to.

### After the symmetry is gone

Random is not enough on its own. The variance of the draw must match the activation: Xavier for sigmoid and tanh, Kaiming for ReLU and GELU. Too small a scale and the signal vanishes through the layers; too large and it explodes. A quick check is to push random inputs through the untrained network and log the activation magnitude at each layer.

## Follow-ups

- **Level 2:** Is it fine to set the biases to zero? Expected: yes, when the weights are random; the lesson's layers do so.
- **Level 2:** Would a nonzero constant for every weight fix it? Expected: no; the neurons are still identical and move in lockstep.
- **Level 3:** After the fix, the loss moves but a deeper version trains badly. What do you check next? Expected: the scale of the random draw against the activation; Xavier for sigmoid and tanh, Kaiming for ReLU, verified by activation magnitudes per layer.
- **Level 3:** How does the lesson show the symmetry in a few lines? Expected: four zero-initialized neurons on one input give four identical outputs, and it counts one effective parameter instead of eight.

## Wrong answers

- "The learning rate is too low." Each neuron moves, but all move together; no learning rate separates identical gradients.
- "Add more neurons." They are all the same neuron; width adds nothing without symmetry breaking.
- "Zero init is fine for the first layer because the inputs differ." The neurons in one layer share the same inputs; what differs across neurons has to be the weights.

## Taught in

The [weight initialization lesson](../../../phases/03-deep-learning-core/08-weight-initialization/) opens with the symmetry problem and demonstrates it with a tiny layer.
