---
id: sigmoid-gradient-after-ten-layers
title: How much gradient survives ten sigmoid layers
card: deep-learning
kind: estimate
level: 2
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [ml-depth, screen]
tags: [vanishing-gradient, sigmoid, backpropagation, activation-functions]
minutes: 8
lessons: [phases/03-deep-learning-core/03-backpropagation, phases/03-deep-learning-core/04-activation-functions]
manuals: []
practice: [mlp-backprop]
cheatsheet: [neural-net-basics]
related: [deep-learning/stacked-linear-layers-collapse, deep-learning/half-the-relus-are-dead]
updated: 2026-11-03
---

A network has ten hidden layers, each with a sigmoid activation. Estimate the largest factor that the sigmoid derivatives alone let a gradient keep on the way from the loss to the first layer, and say what that number means for training.

## Short answer

The sigmoid derivative is s times (1 - s), which peaks at 0.25 when the output is 0.5. Backpropagation multiplies by that derivative once per layer, so after ten layers the activation factors multiply to at most 0.25 to the tenth power, about one millionth. Each layer also multiplies by its transposed weight matrix, and weights with a norm above 1 can enlarge the gradient, so the figure bounds only the activation part. With the small initial weights of the lesson, the first layers receive almost no signal and stay near their initialization while the last layers learn, which is the vanishing gradient problem.

## Full answer

### The chain through the layers

At each layer the backward pass computes the gradient of the loss with respect to the pre-activation as the incoming gradient times the activation's derivative at that point. With a sigmoid that derivative is a(1 - a) for an output a. Its maximum is 0.25, at a equal to 0.5. Three layers deep the product is at most 0.25 cubed, which is 0.0156. Ten layers deep it is 0.25 to the tenth, which the lessons write as 0.000001 and as 0.000000953674.

### Why the bound is optimistic

The 0.25 holds only for a unit whose output is exactly 0.5. A unit near 0 or near 1 is saturated and has a derivative near 0. Real networks have many saturated units, so the activation part shrinks more than one millionth. The bound also leaves out the weight matrices. Backpropagation multiplies by each layer's transposed weights, and weights with a norm above 1 can enlarge the gradient, while small weights shrink it more. A second cost: sigmoid outputs are always positive, so the gradients on a layer's weights share a sign and descent zigzags.

### What changes the arithmetic

- Tanh has a derivative that peaks at 1.0, four times the sigmoid's, but it still falls toward 0 for large inputs, so deep tanh stacks vanish too, only more slowly.
- ReLU has a derivative of exactly 1 for positive inputs. The gradient passes through unchanged and the product does not shrink. This is the change that made deep networks trainable.
- GELU keeps a smooth gradient and avoids the dead unit failure of ReLU, which is why transformers use it.
- The lesson's own network scales its initial weights by the square root of 2 over the input count, to keep early sigmoid units out of saturation.

### How to see it in a run

Log the mean absolute gradient per layer. In a healthy network the layers sit within a small factor of each other. In a vanishing network the first layer is orders of magnitude below the last.

## Follow-ups

- **Level 2:** Why is 0.25 an upper bound and not the typical value? Expected: the derivative is 0.25 only at an output of 0.5; saturated units near 0 or 1 have derivatives near 0, so the real shrink is worse.
- **Level 2:** How does tanh compare? Expected: its derivative peaks at 1.0, four times better, but it still falls toward 0 for large inputs, so deep tanh stacks vanish as well.
- **Level 3:** What does ReLU change in the calculation? Expected: the derivative is exactly 1 for positive inputs, so the gradient passes through unchanged and the product does not shrink.
- **Level 3:** How do you observe the problem without the formula? Expected: log the mean absolute gradient per layer; the first layers show values orders of magnitude below the last.

## Wrong answers

- "The gradient vanishes because the learning rate is too small." A larger learning rate scales every layer; the ratio between the first and the last layers stays near one millionth.
- "Sigmoid outputs are between 0 and 1, so the gradient is between 0 and 1 and that is fine." The derivative, not the output, multiplies through the layers, and its maximum is 0.25.
- "Backpropagation is broken for deep networks." Backpropagation computes the exact gradient; the gradient itself is tiny because of what it passes through.

## Taught in

The [backpropagation lesson](../../../phases/03-deep-learning-core/03-backpropagation/) computes the product through the layers, and the [activation functions lesson](../../../phases/03-deep-learning-core/04-activation-functions/) compares the derivatives of sigmoid, tanh, ReLU and GELU.
