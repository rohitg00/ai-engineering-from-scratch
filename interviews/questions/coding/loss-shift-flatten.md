---
id: loss-shift-flatten
title: A training loss that reaches zero and learns nothing
card: coding
kind: code-reading
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer, ai-evaluation-reliability-engineer]
rounds: [coding, debugging]
tags: [cross-entropy, loss-alignment, training-loop]
minutes: 8
lessons: [phases/19-capstone-projects/36-training-loop-eval]
manuals: []
practice: [softmax-cross-entropy]
cheatsheet: [gpt-from-scratch-training]
related: [coding/softmax-shift-max, coding/bigram-beats-unigram]
updated: 2026-11-03
---

A colleague reports that their language model reaches a loss near zero very early in training, and the generated samples are garbage. The batch code is:

```python
def calc_loss_batch(model, tokens):
    logits = model(tokens)
    return cross_entropy(logits.reshape(-1, logits.shape[-1]), tokens.reshape(-1))
```

What went wrong, and what does the correct version look like?

## Short answer

The targets are the inputs, so the model learns to predict the token it was just given, which is trivial and converges to zero loss while learning nothing. The target at position `t` must be the input at position `t + 1`. Slice the inputs to drop the last token and the targets to drop the first, then flatten both to batch times time by vocabulary and batch times time.

## Full answer

### The alignment

For input tokens `t0, t1, t2, t3` the targets are `t1, t2, t3, t4`. Every position predicts the next token, which is why one training example covers the context length plus one raw id. The batch maker produces the two tensors already shifted, or the loss function shifts them:

```python
def calc_loss_batch(model, inputs, targets):
    logits = model(inputs)
    V = logits.shape[-1]
    return cross_entropy(logits.reshape(-1, V), targets.reshape(-1))
```

with `inputs = window[:-1]` and `targets = window[1:]`.

### Why the flatten

Cross-entropy takes a matrix of rows by classes and a vector of class ids. Flattening batch and time into one axis turns the three-dimensional logits into that matrix and the two-dimensional targets into that vector, and the mean over rows is the mean over every predicted position. Flattening is not the bug; the missing shift is.

### Why the symptom is a near-zero loss

Predicting the current token from the current token needs only an identity through the embedding and the output head, which a tied head gives for free. The loss collapses, the eval loss collapses too, and only the qualitative sample shows that nothing was learned. That is why the training loop prints a generated continuation at every probe step and not only the two losses.

### The numeric side

The practice task also checks that the cross-entropy is computed from a shifted softmax, so that large logits do not overflow, and that the loss is the mean over examples rather than the sum.

## Follow-ups

- **Level 2:** Which signal in the training loop catches this bug first? Expected: the generated sample at the probe step; both losses look excellent.
- **Level 2:** The validation loss is also near zero. Why does held-out data not catch it? Expected: the target leak is in the loss definition, which is the same on both splits.
- **Level 3:** How does the sliding-window dataset avoid this at the source? Expected: it returns a window of context length plus one and splits it into input and target in the dataset itself, so the loop never sees unshifted pairs.
- **Level 3:** Your supervised fine-tuning data masks the instruction tokens. Where does the mask go relative to the shift? Expected: after the shift, so the ignored positions line up with the shifted targets.

## Wrong answers

- "The learning rate is too high." A high learning rate diverges or oscillates; a collapse to zero loss points at a leak in the objective.
- "Flattening mixes the batch and time axes." The flatten is required; the rows are independent predictions and their order does not matter to the mean.
- "The model overfits the training set." Overfitting shows a gap between training and validation loss; here both collapse.

## Taught in

The [training loop lesson](../../../phases/19-capstone-projects/36-training-loop-eval/) explains the loss alignment and the qualitative probe, and the [softmax and cross-entropy practice](../../../practice/softmax-cross-entropy/) checks the batched loss.
