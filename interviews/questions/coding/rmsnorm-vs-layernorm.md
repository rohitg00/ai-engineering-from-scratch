---
id: rmsnorm-vs-layernorm
title: Swap the final LayerNorm for RMSNorm without breaking it
card: coding
kind: code-reading
level: 3
roles: [inference-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [coding, ml-depth]
tags: [layernorm, rmsnorm, normalization]
minutes: 10
lessons: [phases/19-capstone-projects/35-gpt-model-assembly]
manuals: []
practice: [layer-norm-rms-norm]
cheatsheet: [transformers-attention, gpt-from-scratch-training]
related: [coding/decay-split-param-groups]
updated: 2026-11-03
---

The assembly lesson says that swapping the activation and replacing LayerNorm with RMSNorm turns its model into the next open model family. A candidate submits this RMSNorm:

```python
def rms_norm(x, weight, eps):
    mean = x.mean(axis=-1, keepdims=True)
    var = ((x - mean) ** 2).mean(axis=-1, keepdims=True)
    return weight * (x - mean) / np.sqrt(var) + eps
```

What is wrong, and what does the correct function compute?

## Short answer

This is a LayerNorm without a shift, not an RMSNorm, and it adds epsilon after the square root instead of inside it. RMSNorm does not subtract the mean. It divides the input by the root of the mean of the squares over the last axis, with epsilon inside the root, and multiplies by a learned weight.

## Full answer

### The two normalizations

```python
def layer_norm(x, gamma, beta, eps):
    mean = x.mean(axis=-1, keepdims=True)
    var = ((x - mean) ** 2).mean(axis=-1, keepdims=True)
    return gamma * (x - mean) / np.sqrt(var + eps) + beta


def rms_norm(x, weight, eps):
    ms = (x ** 2).mean(axis=-1, keepdims=True)
    return weight * x / np.sqrt(ms + eps)
```

LayerNorm centers and scales each token vector, then applies a learned scale and shift. RMSNorm keeps the direction of the vector and only fixes its magnitude. It has no mean subtraction and no shift, which saves one reduction per token and one parameter vector per layer.

### The epsilon

Epsilon exists to keep the division defined when the variance or the mean square is near zero. Inside the root it bounds the denominator from below. Outside the root it does nothing for a zero variance and shifts every output by a constant, which is wrong in both cases. The practice task has one mutant for each of these placements.

### Over which axis

Both normalizations reduce over the last axis, the feature axis, independently for every token in every batch element. Reducing over the batch axis turns the layer into a batch statistic, which changes with batch composition and breaks single-example inference.

### Biased variance

LayerNorm uses the biased variance, the mean of the squared deviations over the feature count. The unbiased estimate with one fewer in the denominator is a statistics convention that does not belong here and makes the output disagree with every standard library version by a factor that depends on the width.

### Why the swap is safe in the assembly

The final normalization sits between the last block and the tied head, and both functions take and return the same shape. Swap the class, drop the shift parameter, and the head, the embedding and the generation loop are untouched.

## Follow-ups

- **Level 3:** What does the caller's epsilon argument control, and what happens if the function ignores it? Expected: the floor on the denominator; ignoring it and using a fixed constant makes a reference comparison fail when the caller passes a different value.
- **Level 3:** Why does RMSNorm have no shift parameter? Expected: it does not center the input, so there is no mean to restore; the next linear layer's bias can absorb a shift if one is needed.
- **Level 4:** A pretrained checkpoint has LayerNorm scales and shifts and you swap in RMSNorm. What breaks? Expected: the shift has nowhere to load and the scale was learned on centered inputs, so the loaded model no longer matches the trained function.

## Wrong answers

- "RMSNorm is LayerNorm with the shift removed." It also removes the mean subtraction; without that difference it would not be a different layer.
- "Epsilon placement does not matter for normal inputs." It matters exactly for the inputs it exists for, the ones with near-zero variance.
- "Use the unbiased variance, it is more correct." Standard library versions use the biased form; the choice is a contract, not a statistics question.

## Taught in

The [GPT assembly lesson](../../../phases/19-capstone-projects/35-gpt-model-assembly/) places the final LayerNorm and names the RMSNorm swap, and the [normalization practice](../../../practice/layer-norm-rms-norm/) checks both functions.
