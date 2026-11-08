---
id: decay-split-param-groups
title: Which parameters get weight decay
card: coding
kind: code-reading
level: 3
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [coding, ml-depth]
tags: [adamw, weight-decay, parameter-groups, layernorm]
minutes: 10
lessons: [phases/19-capstone-projects/36-training-loop-eval]
manuals: []
practice: [adam-step]
cheatsheet: [optimizers-schedules, gpt-from-scratch-training]
related: [coding/adamw-decoupled-decay, coding/rmsnorm-vs-layernorm]
updated: 2026-11-03
---

A training run looks healthy for the first few thousand steps, then the loss starts to climb and samples degrade. The optimizer is built with one parameter group:

```python
optimizer = AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
```

Write the function that builds the parameter groups correctly and explain which tensors must be excluded from decay and why.

## Short answer

Decay belongs on matrix-shaped tensors, which are the linear weights and the embedding tables, and not on normalization scales or biases. A decayed LayerNorm scale drifts toward zero over thousands of steps until normalization stops working, which matches the late failure. Split the parameters by shape into a decay group and a no-decay group and pass both to the optimizer.

## Full answer

### The split

```python
def build_param_groups(model, weight_decay):
    decay, no_decay = [], []
    for name, p in model.named_parameters():
        if not p.requires_grad:
            continue
        (decay if p.dim() >= 2 else no_decay).append(p)
    return [
        {"params": decay, "weight_decay": weight_decay},
        {"params": no_decay, "weight_decay": 0},
    ]
```

A two-dimensional or larger tensor is a weight matrix or an embedding table. A one-dimensional tensor is a scale or a shift, which includes LayerNorm parameters and every bias. The rule by dimension is simple and matches the standard recipe.

### Why decay on a scale is harmful

Weight decay pulls every decayed parameter toward zero on every step. A linear weight has gradient pressure in many directions and the pull acts as regularization. A LayerNorm scale has one job, to set the magnitude of the normalized activations, and a steady pull toward zero shrinks the residual stream of every block until the signal is too small for the layers that follow. The effect accumulates slowly, which is why the run looks fine at first.

### Why decay on a bias is waste

Decaying a bias is mathematically harmless but spends update cycles on a parameter that regularization does not need to control. The split excludes it along with the scales.

### How to test the split

A unit test can walk the named parameters and assert that each scale and bias landed in the no-decay group and each linear and embedding weight landed in the decay group. The loop lesson lists exactly this test as its first exercise.

## Follow-ups

- **Level 3:** The language model head is tied to the token embedding. Which group is it in, and how many times? Expected: once, in the decay group, because it is the same tensor as the embedding table.
- **Level 3:** A model uses RMSNorm instead of LayerNorm. Does the rule change? Expected: no; the RMSNorm weight is one-dimensional and stays out of the decay group.
- **Level 4:** Why does the problem appear late rather than at the start of training? Expected: the decay shrinks the scale by a small fraction per step, so the damage compounds over thousands of steps before the activations become too small.

## Wrong answers

- "Weight decay applies to all weights by definition." The standard recipe excludes normalization and bias tensors; applying it everywhere breaks normalization over time.
- "Decide by parameter name, excluding anything called bias." Names vary across implementations; the dimension rule is robust.
- "Lower the weight decay until the run is stable." A smaller value slows the drift but keeps the pull on the scales.

## Taught in

The [training loop lesson](../../../phases/19-capstone-projects/36-training-loop-eval/) defines the two-group AdamW split and the test for it, and the [Adam practice](../../../practice/adam-step/) implements the decoupled decay the groups feed into.
