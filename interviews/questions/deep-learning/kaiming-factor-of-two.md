---
id: kaiming-factor-of-two
title: Where the 2 in Kaiming initialization comes from
card: deep-learning
kind: concept
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [ml-depth, screen]
tags: [weight-initialization, kaiming, xavier, variance]
minutes: 8
lessons: [phases/03-deep-learning-core/08-weight-initialization]
manuals: []
practice: []
cheatsheet: [deep-learning-training]
related: [deep-learning/zero-init-symmetry, deep-learning/residual-scaling-deep-transformer]
updated: 2026-11-03
---

Xavier initialization sets the weight variance to 2 over the sum of fan in and fan out. Kaiming initialization sets it to 2 over fan in. Both are called variance preserving. Explain what each one preserves, where the 2 in Kaiming comes from, and what happens to a 50 layer ReLU network that starts from a plain standard normal.

## Short answer

A layer's pre-activation variance is fan in times the weight variance times the input variance, so a weight variance of 1 over fan in keeps the signal size constant through a linear layer. Xavier balances that condition between the forward and the backward pass, which gives 2 divided by the total of the two fan counts, and it suits sigmoid and tanh, which are near linear around zero. ReLU zeroes half of its inputs and halves the variance at each layer, so Kaiming doubles the variance of each weight to 2 over fan in to compensate. A standard normal with a fan in of 512 multiplies the variance by 512 at every layer, and the signal explodes within a few layers.

## Full answer

### Variance through one layer

For z equal to the sum of w_i x_i over fan in terms with independent weights and inputs:

```text
Var(z) = fan_in * Var(w) * Var(x)
```

The lesson's two failures follow at once. With Var(w) equal to 1 and a fan in of 512, each layer multiplies the variance by 512, and after 10 layers the factor is 512 to the tenth, about 1.2 times 10 to the 27. With Var(w) equal to 0.001 the factor per layer is 0.512, and after 10 layers the signal is at 0.00013 of its size. The goal is Var(z) equal to Var(x).

### Xavier

Glorot and Bengio asked for constant variance in both directions: forward through fan in, backward through fan out. The compromise is Var(w) equal to 2 over (fan in plus fan out), drawn as a normal with that variance or as a uniform with limit the square root of 6 over the same sum. It holds for sigmoid and tanh because, at a well scaled initialization, their inputs sit in the near linear region around zero.

### Kaiming

ReLU sets every negative pre-activation to zero. On average half the units are off, so the variance that reaches the next layer is half of what the linear analysis predicts. He and colleagues doubled the weight variance to cancel that: Var(w) equal to 2 over fan in. Without the 2 the signal shrinks by about 0.5 per layer, and over 50 layers that is 0.5 to the 50, about 8.8 times 10 to the minus 16. GELU and Swish use the same rule. A framework's linear layer defaults to a Kaiming uniform draw, which is why shallow networks train with no thought given to it.

### The check

Push random inputs through the untrained network and log the mean activation magnitude at each layer. The lesson's experiment prints it at layers 1, 5, 10, 25 and 50: a standard normal explodes, a normal with standard deviation 0.01 vanishes, and both Xavier with sigmoid and Kaiming with ReLU hold near 1.0 through layer 50.

## Follow-ups

- **Level 2:** Why does zero initialization fail even though its variance stays constant? Expected: every neuron computes the same function and receives the same gradient, so the layer has one effective neuron; random weights break the symmetry.
- **Level 3:** Which initialization goes with GELU? Expected: Kaiming, as for ReLU.
- **Level 3:** How do you verify an initialization without training? Expected: push random data through the network and log the mean activation magnitude per layer; it should stay in a band such as 0.5 to 2.0 at every depth.
- **Level 4:** Why do residual networks need a further scale beyond Kaiming? Expected: each residual addition adds variance, so the stream grows with the layer count; the GPT-2 scheme scales residual weights by 1 over the square root of 2N.

## Wrong answers

- "Random is random, the scale does not matter if it is small." Too small vanishes and too large explodes; the lesson shows both, and the margin is thin at 50 layers.
- "Xavier works for ReLU too, the difference is minor." Xavier under-estimates the variance ReLU needs by a factor of 2, and over 50 layers the signal falls to about 8.8 times 10 to the minus 16.
- "Kaiming's 2 stands for the forward and backward passes." That 2 compensates for ReLU zeroing half the activations; Xavier's 2 is the one that balances the two passes.

## Taught in

The [weight initialization lesson](../../../phases/03-deep-learning-core/08-weight-initialization/) derives both formulas and runs the 50 layer experiment.
