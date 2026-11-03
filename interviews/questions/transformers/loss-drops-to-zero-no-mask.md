---
id: loss-drops-to-zero-no-mask
title: The loss collapses and the samples are nonsense
card: transformers
kind: debug
level: 2
roles: [applied-ai-engineer, inference-engineer, ai-data-engineer]
rounds: [debugging, coding]
tags: [causal-mask, shift-by-one, training-loss, decoder, testing]
minutes: 8
lessons: [phases/19-capstone-projects/33-multihead-self-attention, phases/19-capstone-projects/34-transformer-block, phases/07-transformers-deep-dive/07-gpt-causal-language-modeling]
manuals: []
practice: [train-char-bigram]
cheatsheet: [gpt-from-scratch-training, nn-debugging]
related: [transformers/causal-mask-minus-infinity]
updated: 2026-11-03
---

A new decoder-only language model on a vocabulary of 64 tokens reaches a training loss near zero after only some hundreds of steps, and the sampled text is nonsense. Name the two most likely causes and the check that tells them apart.

## Short answer

On real text, a loss far below the logarithm of the vocabulary size this early, with nonsense samples, most likely means the model can see its own target. Either the causal mask is missing, so position i reads the token at i plus one through attention, or the targets were never shifted, so the input and the target are the same sequence. Check the attention weights: if any mass sits above the diagonal the mask is gone; if the weights are triangular, print one batch and compare the input and target columns.

## Full answer

### What a healthy run looks like

At the first step the loss should sit near the logarithm of the vocabulary size, about 4.16 for 64 tokens. On the lesson's repeat task it falls to well under 1.0 over three epochs because the next token equals the previous one. A loss that reaches zero on real text is not learning; it is copying.

### Cause one: the mask

The mask replaces every entry above the diagonal of the score matrix with minus infinity before the softmax. Forget it and every position attends to the whole sequence, including the answer. The lesson's phrase: forget the mask and you train a model that cheats. Common ways to lose it: the mask buffer is built for the maximum context and never sliced to the current length, the mask is applied after the softmax, or the attention call takes a flag that defaults to non-causal.

### Cause two: the shift

Given tokens `[t1, t2, t3, t4]`, the input is `[t1, t2, t3]` and the target is `[t2, t3, t4]`. If the data loader returns the same window twice, the model learns the identity. The loss collapses even with a perfect mask.

### The checks

1. **Causality test.** Perturb a token at position j and assert that the outputs at positions before j do not change. The lesson's test suite pins this property.
2. **Triangle test.** Return the attention weights for one head and confirm the upper triangle is exactly zero after the softmax.
3. **Batch inspection.** Print one input and target pair and confirm the target is the input shifted left by one.
4. **Held-out check.** Compute the loss on held-out text with the same pipeline. A model that memorized a small corpus has a high held-out loss and samples that copy the training text; a leak gives nonsense samples.

### Why sampling exposes it

During training the answer leaks through the input, so the loss is low. At sampling time the model has nothing to copy from, so it emits noise. A model that learned the real task is good at both.

## Follow-ups

- **Level 2:** What loss do you expect at step zero, and why? Expected: about the logarithm of the vocabulary size, about 4.16 for 64, because a random model spreads probability evenly.
- **Level 2:** How do you make the shift mistake impossible in the loader? Expected: slice one window of length T plus 1 and return `window[:-1]` and `window[1:]` from the same slice, with a test on one example.
- **Level 3:** Write the causality unit test in one sentence. Expected: change the token at position j, run the block again, and assert that every output before j is unchanged.
- **Level 3:** The mask and the shift are right, and the loss is still suspiciously low. What else leaks? Expected: a validation window that overlaps the training stream, or padding tokens counted as easy targets; check the split and the loss mask.

## Wrong answers

- "The model is just learning fast." A loss near zero on natural text is not possible without seeing the target.
- "Add dropout to regularize it." Dropout does not stop a leak; it only makes the copy slightly noisier.
- "Lower the learning rate." The optimization is fine; the objective is broken.

## Taught in

The [attention capstone](../../../phases/19-capstone-projects/33-multihead-self-attention/) and the [block capstone](../../../phases/19-capstone-projects/34-transformer-block/) build and test the mask, and the [causal language modeling lesson](../../../phases/07-transformers-deep-dive/07-gpt-causal-language-modeling/) defines the shift-by-one loss.
