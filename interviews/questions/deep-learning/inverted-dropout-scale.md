---
id: inverted-dropout-scale
title: Why the dropout mask holds 1 over (1 minus p)
card: deep-learning
kind: code-reading
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, ml-depth]
tags: [dropout, regularization, backward-pass, eval-mode]
minutes: 8
lessons: [phases/03-deep-learning-core/07-regularization, phases/03-deep-learning-core/10-mini-framework]
manuals: []
practice: [inverted-dropout]
cheatsheet: [deep-learning-training]
related: [deep-learning/train-mode-and-eval-mode, deep-learning/layernorm-not-batchnorm]
updated: 2026-11-03
---

This dropout module comes from a mini framework.

```python
class Dropout(Module):
    def __init__(self, p=0.5):
        super().__init__()
        self.p = p
        self.mask = None

    def forward(self, x):
        if not self.training:
            return x
        self.mask = [0.0 if random.random() < self.p else 1.0 / (1 - self.p) for _ in x]
        return [v * m for v, m in zip(x, self.mask)]

    def backward(self, grad):
        if self.mask is None:
            return grad
        return [g * m for g, m in zip(grad, self.mask)]
```

Why do the kept entries of the mask hold 1 over (1 minus p) rather than 1, and why does backward reuse the same mask? What would change if the forward kept 1 and the scaling moved to evaluation time?

## Short answer

Each unit is zeroed with probability p, so the expected value of a unit falls to (1 - p) times its original. Dividing the kept units by (1 - p) restores that expectation during training, so evaluation runs the plain network with no change. Backward multiplies by the same mask because the forward pass was a per-unit scale, and the derivative of a scale is the scale. Moving the factor to evaluation time also works, but then every inference path must know the dropout rate.

## Full answer

### The expectation argument

A mask entry is 0 with probability p and 1 over (1 - p) otherwise. Its expected value is (1 - p) times 1 over (1 - p), which is 1. So the expected output of each unit in training equals its output with dropout off. The network sees the same scale in both modes, and the evaluation path has no dropout code at all. The lesson calls this inverted dropout. The original form kept the mask at 1 and multiplied by (1 - p) at test time, which forces inference code to know p.

### The backward pass

Dropout is an element-wise scale by the mask. The gradient of the input is the gradient of the output times the same mask: dropped units get 0, kept units get the gradient scaled by 1 over (1 - p). The mask must be the one from the matching forward pass, because the backward pass differentiates the function that ran forward. A fresh mask would pass gradient to units that were off and scale units that were on. The guard on a missing mask covers only a backward call before any training forward. The evaluation branch returns before it changes the mask, so a backward call after an evaluation forward reuses the mask of the last training forward.

### What dropout buys

Zeroing random units stops neurons from relying on specific other neurons being present, which the lesson calls co-adaptation. Each mask selects a subnetwork, so training samples from about 2 to the N subnetworks of N units, and evaluation averages them in one pass by running the full network at the scaled expectation. Default rates: 0.1 for transformers, 0.5 for MLPs, 0.2 to 0.3 for CNNs. Higher p is stronger regularization and more risk of underfitting.

## Follow-ups

- **Level 2:** What gradient does a dropped unit receive? Expected: zero, because its mask entry is 0.
- **Level 2:** Why must backward use the mask from the same forward pass? Expected: the backward pass differentiates the function that ran forward; a new mask would scale active units wrongly and pass gradient to inactive ones.
- **Level 3:** What is the ensemble reading of dropout? Expected: each mask defines a subnetwork, so training samples from about 2 to the N subnetworks, and evaluation averages them by running the full network at the scaled expectation.
- **Level 3:** Which rate does the lesson give for a transformer, and why is it lower than for an MLP? Expected: 0.1 against 0.5; a higher rate is stronger regularization with more underfitting risk, and the transformer default is the lighter one.

## Wrong answers

- "The scale makes the outputs sum to one." It restores the expected value of each unit, not a sum.
- "Backward should draw a fresh mask for exploration." The backward pass differentiates the function that ran forward; a different mask gives the gradient of a different function.
- "In evaluation mode multiply by (1 - p) as well." With inverted dropout the scaling already happened in training; scaling again at evaluation shrinks every activation.

## Taught in

The [regularization lesson](../../../phases/03-deep-learning-core/07-regularization/) derives inverted dropout, and the [mini framework lesson](../../../phases/03-deep-learning-core/10-mini-framework/) turns it into this module.
