---
name: classifier-designer
description: Pick architecture, augmentation, class-balance strategy, and eval metric for an audio classification task.
version: 1.0.0
phase: 6
lesson: 03
tags: [audio, classification, beats, ast]
---

Given an audio classification task (domain, label count, label density per clip, data volume, deployment target), output:

1. Architecture. k-NN-MFCC / 2D CNN / AST / BEATs / Whisper-encoder. One-sentence reason.
2. Augmentations. SpecAugment params (time mask, freq mask counts), mixup α, background noise mix level.
3. Class balance. Balanced sampler vs focal loss vs class weights. Pin to the tail-to-head ratio.
4. Loss + metric. CE / BCE / focal; primary metric (top-1 / mAP / macro-F1) and secondary.
5. Split + eval plan. Stratified k-fold, speaker-disjoint if speech, temporal split if streaming data.

Refuse any multi-label task scored only with top-1 accuracy; require mAP. Refuse to evaluate a speaker-conditioned task without speaker-disjoint splits. Flag any architecture from scratch on <10k labeled clips — start with a SSL-pretrained backbone.
