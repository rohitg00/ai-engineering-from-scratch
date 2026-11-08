---
id: chameleon-diverged
title: An early-fusion run that diverges at scale
card: multimodal
kind: debug
level: 3
roles: [applied-ai-engineer, inference-engineer]
rounds: [debugging, ml-depth]
tags: [early-fusion, training-stability, qk-norm, divergence]
minutes: 12
lessons: [phases/12-multimodal-ai/11-chameleon-early-fusion-tokens, phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion]
manuals: []
practice: []
cheatsheet: [unified-multimodal]
related: [multimodal/vq-tokenizer-ceiling]
updated: 2026-11-03
---

You pretrain an early-fusion model on interleaved text and image codes. The small runs are fine, but the large run's loss spikes and diverges after a while, and the attention scores climb from layer to layer. What is happening, and what did the published recipe change to make such a run converge?

## Short answer

Early-fusion training at scale is unstable because image codes and text tokens share one softmax and one residual stream, and their gradients and norms differ; the attention logits grow with depth until the softmax saturates and the loss blows up. The published recipe at 34B parameters diverged at several checkpoints without three changes: normalization of the query and key projections before the dot product, dropout after every residual addition rather than only after attention and the MLP, and pre-normalization on the residual branch plus an extra normalization on the skip connection of the last block. The training recipe is as much of the contribution as the architecture.

## Full answer

### The signature

Norm growth. The query and key vectors grow in magnitude through the layers, the attention logits grow with them, the softmax turns into a near one-hot, and the gradients become spiky. Small runs do not reach the depth or the step count where this compounds; the large run does.

### Why early fusion makes it worse

A shared vocabulary of 65,536 entries holds the text tokens and 8192 image codes, and one image is 1024 codes in a row. Long runs of image codes carry gradients on a different scale from text, and they can dominate an update. The two modalities also occupy different regions of the hidden space, which pushes the norms apart.

### The three changes

1. QK-Norm. Apply layer normalization to the query and key projections inside attention, before the dot product. It bounds the logit magnitude at every depth, and several large models after this adopted it.
2. Dropout placement. Dropout after every residual addition, not only after attention and after the MLP. More regularization where image-code gradients can dominate.
3. Normalization ordering. Pre-normalization on the residual branch, which is standard, plus an extra normalization on the skip connection of the last block, which stabilizes the gradient flow at the final layer.

### How you would confirm it on your run

- Log the norm of the queries and keys and the maximum attention logit per layer over training; the divergence should follow growth in the deep layers.
- Log the gradient norm split by the modality of the token; a dominance of image-code gradients points at the second change.
- Restart from a checkpoint before the spike with QK-Norm on, and compare the logit curves.

### The alternative family

A continuous design that trains a diffusion loss on image patches next to the text loss avoids the shared softmax over image codes, but it has a balance problem of its own: the two losses live on different scales, and the weights between them are a search of their own.

## Follow-ups

- **Level 3:** Why does normalizing the queries and keys bound the logits? Expected: the dot product of two normalized vectors is bounded by their scale, so the logits cannot grow without limit as the residual stream grows.
- **Level 3:** Why not lower the learning rate instead? Expected: a lower rate slows the growth but does not remove the mechanism; the norms still drift with depth, and the run pays in steps for a problem that normalization removes.
- **Level 4:** What did the paper report at 34B without the changes? Expected: repeated divergence at several checkpoints, driven by growth of the attention logits, a norm explosion, which the three changes removed.
- **Level 4:** How does the two-loss continuous design trade this problem for another? Expected: it removes the shared softmax over image codes but introduces two losses of different magnitude, where one head can dominate without careful loss weights and schedules.

## Wrong answers

- "Early fusion is unstable by nature; use smaller models." The published recipe converged at 34B with the three changes; the instability is a recipe problem.
- "Clip the gradients harder." Clipping bounds the update, not the logit growth that causes the saturation; the norms keep drifting under a clip.
- "Use post-normalization everywhere; it is more stable." The recipe kept pre-normalization on the residual branch and added normalization where the norms grew: the queries, the keys, and the skip of the last block.

## Taught in

The [Chameleon lesson](../../../phases/12-multimodal-ai/11-chameleon-early-fusion-tokens/) documents the three stability changes and the divergence at scale, and the [Transfusion lesson](../../../phases/12-multimodal-ai/13-transfusion-autoregressive-diffusion/) gives the continuous alternative and its own balance problem.
