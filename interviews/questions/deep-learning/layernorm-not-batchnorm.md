---
id: layernorm-not-batchnorm
title: Why transformers normalize across features, not the batch
card: deep-learning
kind: tradeoff
level: 3
roles: [inference-engineer, applied-ai-engineer, ai-data-engineer]
rounds: [ml-depth, design-review]
tags: [normalization, layer-norm, batch-norm, rmsnorm, transformers]
minutes: 12
lessons: [phases/03-deep-learning-core/07-regularization]
manuals: []
practice: [layer-norm-rms-norm, batch-norm]
cheatsheet: [deep-learning-training]
related: [deep-learning/train-mode-and-eval-mode, deep-learning/inverted-dropout-scale]
updated: 2026-11-03
---

A team ports a vision training recipe to a transformer and keeps batch normalization. Training is unstable, and text generation with one sequence at a time produces garbage. Explain why transformers use layer normalization instead, and when you would go a step further to RMSNorm.

## Short answer

Batch normalization normalizes each feature across the batch, so its statistics depend on the batch size and on which sequences share the batch; with small batches they are noisy, with a batch of one they are meaningless, and training and inference run different code paths. Layer normalization normalizes across the features of one sample, so it does not depend on the batch and is identical in both modes, which is what variable length sequences and single sequence generation need. RMSNorm drops the mean subtraction and the shift parameter, keeps the accuracy, and saves about 10 percent of the normalization cost, which is why most recent large language models use it.

## Full answer

### Batch normalization and its two dependencies

For each feature, batch normalization subtracts the batch mean, divides by the batch standard deviation with an epsilon, and applies a learned scale gamma and shift beta. Two things follow. First, the result for one sample depends on the other samples in its batch. The lesson puts the floor at a batch of about 32; below it the statistics are noisy, and at a batch of one the variance is zero. Second, inference cannot see a batch, so it uses running averages collected in training with a momentum of 0.1, which is a second code path and a second source of bugs. Sequence models hit both problems: lengths vary, memory limits the batch, and generation runs one sequence at a time.

### Layer normalization

Layer normalization computes the mean and variance over the D features of one sample and normalizes that sample alone. No batch dependence, no running averages, the same computation in training and at inference. Transformers apply it around each attention block and each feed-forward block, after them in the Post-LN layout or before them in the Pre-LN layout, which the lesson notes trains more stably.

### RMSNorm

RMSNorm divides by the root mean square of the features and multiplies by gamma. There is no mean subtraction and no beta. The observation behind it is that re-centering adds little to accuracy and costs compute, so removing it gives the same accuracy with about 10 percent less normalization overhead. At the scale of billions of parameters that saving is real, and most modern large language models use it.

### Why batch normalization helps at all

The first published explanation, internal covariate shift, has been shown to be wrong. The gain comes from a smoother loss landscape with more predictive gradients, which lets the optimizer take larger steps. Layer normalization and RMSNorm deliver that effect without the batch dependence.

## Follow-ups

- **Level 3:** What does batch normalization need at inference that layer normalization does not? Expected: running averages of the mean and variance collected in training; layer normalization computes its statistics from the sample itself.
- **Level 3:** Where does a transformer block place the normalization? Expected: after each attention and feed-forward block in Post-LN, or before them in Pre-LN, which trains more stably.
- **Level 4:** What does RMSNorm remove and what does it cost? Expected: the mean subtraction and the shift parameter; the lesson reports the same accuracy with about 10 percent less normalization overhead.
- **Level 4:** Why did the original explanation for batch normalization fall out of favor? Expected: later work showed the gain comes from a smoother loss landscape with smaller Lipschitz constants, which lets the optimizer take larger steps.

## Wrong answers

- "Batch normalization only needs a bigger batch." Generation runs one sequence at a time and sequence lengths vary; the fix is a norm that does not look across the batch.
- "Layer normalization is a weaker regularizer, so it is a compromise." It normalizes across features, which is the right axis for sequences, and it removes the mismatch between training and inference.
- "RMSNorm is an approximation that loses accuracy." The lesson reports the same accuracy; the re-centering adds little and costs compute.

## Taught in

The [regularization lesson](../../../phases/03-deep-learning-core/07-regularization/) builds all three normalizations and explains the choice for transformers.
