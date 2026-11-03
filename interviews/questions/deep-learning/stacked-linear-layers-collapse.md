---
id: stacked-linear-layers-collapse
title: Ten layers with no activation are one layer
card: deep-learning
kind: concept
level: 1
roles: [applied-ai-engineer, ai-data-engineer, inference-engineer]
rounds: [screen, ml-breadth]
tags: [activation-functions, nonlinearity, linear-layers, depth]
minutes: 5
lessons: [phases/03-deep-learning-core/04-activation-functions]
manuals: []
practice: []
cheatsheet: [neural-net-basics]
related: [deep-learning/xor-needs-a-hidden-layer, deep-learning/sigmoid-gradient-after-ten-layers]
updated: 2026-11-03
---

A junior engineer removes every activation function from a 10 layer network to make it faster and reports that training still runs and the loss still falls. What did they build, and why will it fail on XOR or on a spiral dataset?

## Short answer

Two linear layers compose into one: W2 (W1 x + b1) + b2 equals (W2 W1) x + (W2 b1 + b2), which is a single matrix and a single bias. Ten linear layers are one linear layer with extra parameters and the same decision boundary, a hyperplane. XOR and a spiral need a curved boundary, so the network cannot fit them at any width or depth.

## Full answer

### The substitution

```text
h = W1 x + b1
y = W2 h + b2 = W2 W1 x + W2 b1 + b2 = A x + c
```

Matrix products compose, so a stack of linear maps is one linear map. Repeat the substitution and ten layers fold into one matrix A and one vector c. Depth without a nonlinearity is an illusion: the model has the capacity of a single linear layer, it only costs more to run.

### What an activation changes

Insert a nonlinear function g between the layers, so that h = g(W1 x + b1). The substitution fails, because W2 g(W1 x + b1) + b2 does not reduce to A x + c. Each extra layer with an activation adds representational capacity. That is what lets a network bend its boundary around a spiral or separate the XOR points.

### What to add back

The lesson's defaults: ReLU for a plain MLP or a CNN, GELU for a transformer, tanh inside recurrent cells. The output layer is the one place a missing activation is correct: a regression head emits any real number, a binary head uses a sigmoid, and a multi-class head uses a softmax.

### Why the loss still fell

A stack of linear layers only finds the best linear fit to the data. On XOR or a spiral that fit is close to chance, but it is better than random weights, so the loss moves. A falling loss is not evidence that the model can represent the target.

## Follow-ups

- **Level 1:** Which layer is allowed to have no activation? Expected: the output layer of a regression model, which must produce any real number.
- **Level 2:** Does the deep linear network train faster than one layer? Expected: no; it computes the same function with more parameters and more matrix multiplies.
- **Level 2:** Which activation would you add back for a plain MLP and for a transformer? Expected: ReLU for the MLP and GELU for the transformer.
- **Level 3:** Why is the collapse not a proof that depth is useless? Expected: with a nonlinearity between layers the substitution fails and each layer adds capacity; deep networks fit the same functions with fewer parameters than wide shallow ones.

## Wrong answers

- "Ten layers are deeper, so they represent more." Without a nonlinearity the product of the matrices is one matrix; depth adds nothing.
- "The biases make it nonlinear." A bias shifts the hyperplane; it does not bend it.
- "The loss went down, so it is learning fine." It learns the best linear fit, which for XOR or a spiral is near chance.

## Taught in

The [activation functions lesson](../../../phases/03-deep-learning-core/04-activation-functions/) proves the collapse and gives the default activation for each architecture.
