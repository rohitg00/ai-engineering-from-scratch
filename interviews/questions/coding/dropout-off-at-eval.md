---
id: dropout-off-at-eval
title: Dropout that still acts during evaluation
card: coding
kind: code-reading
level: 2
roles: [applied-ai-engineer, ai-evaluation-reliability-engineer, ai-data-engineer]
rounds: [coding, debugging]
tags: [dropout, evaluation, training-loop]
minutes: 8
lessons: [phases/19-capstone-projects/36-training-loop-eval, phases/19-capstone-projects/35-gpt-model-assembly]
manuals: []
practice: [inverted-dropout]
cheatsheet: [deep-learning-training]
related: [coding/loss-shift-flatten]
updated: 2026-11-03
---

Two evaluation runs on the same checkpoint and the same fixed validation batches report different losses. The dropout layer is:

```python
def dropout_forward(x, p, rng, training):
    mask = rng.random(x.shape) >= p
    if training:
        return x * mask / (1 - p), mask
    return x * (1 - p), mask
```

Find every problem with the inference path and explain what the evaluation function expects.

## Short answer

Inverted dropout scales the kept units during training so that inference is the identity, but this inference path multiplies the input by one minus p, which belongs to the non-inverted form and shrinks every activation. It also draws from the generator in inference mode, which changes every later random number in the run, such as the next training mask and the next probe sample. Inference must return the input unchanged and must not touch the generator.

## Full answer

### The two bugs

1. Scaling at inference. With inverted dropout the division by one minus p happens in training, so the expected activation already matches the no-dropout value. Scaling again at inference halves the signal at a rate of one half and damages every layer that follows.
2. Drawing at inference. The mask is sampled before the branch. Evaluation consumes random numbers, so the generation sample after the probe, and any later training step, sees a different stream than a run without the probe.

### The fix

```python
def dropout_forward(x, p, rng, training):
    if not training:
        return x.copy(), np.ones(x.shape, dtype=bool)
    mask = rng.random(x.shape) >= p
    return x * mask / (1 - p), mask
```

At inference the layer returns a copy of the input and a mask that is true everywhere, and it does not draw. Keep an entry when the random number is at or above p, so the complement rule is right, and divide the kept entries by one minus p. The backward pass multiplies the incoming gradient by the same mask and divides by the same factor.

### What evaluation expects

The training loop's evaluation function runs a fixed number of validation batches with no gradient and no dropout, and the number must be reproducible across runs given the same seed and split. Any randomness inside the model during that pass breaks the comparison between two runs, because the difference measures the random stream rather than the model. The assembly lesson's model has an embedding dropout of 0.1, so this layer sits in the path of every evaluation.

## Follow-ups

- **Level 2:** Why divide by one minus p during training at all? Expected: so the expected value of each activation is the same with and without the mask, which makes inference the identity.
- **Level 2:** Why must the backward pass use the same mask? Expected: the gradient must flow only through the units that were kept, with the same scale, otherwise the gradient does not match the forward computation.
- **Level 3:** The evaluation is reproducible but still differs from a run that skipped the probe. What else draws? Expected: the sampled generation at the probe step consumes draws from the shared generator; give the probe its own generator.

## Wrong answers

- "Scale down at inference as the original dropout paper did." That form skips the scaling in training; mixing the two forms shrinks the activations.
- "Re-seed the generator before every evaluation." It hides the extra draws but still changes the training stream afterwards; the inference path should not draw at all.
- "Keep an entry when the random number is below p." That keeps a fraction p and drops the rest, the complement of the intended mask.

## Taught in

The [training loop lesson](../../../phases/19-capstone-projects/36-training-loop-eval/) requires that evaluation skip gradients and dropout, the [GPT assembly lesson](../../../phases/19-capstone-projects/35-gpt-model-assembly/) places the embedding dropout, and the [inverted dropout practice](../../../practice/inverted-dropout/) checks the identity at inference.
