---
name: classifier-designer
description: 音声分類タスクに対して architecture、augmentation、class-balance strategy、eval metric を選ぶ。
version: 1.0.0
phase: 6
lesson: 03
tags: [audio, classification, beats, ast]
---

音声分類タスク (domain, label count, label density per clip, data volume, deployment target) が与えられたら、次を出力します。

1. Architecture. k-NN-MFCC / 2D CNN / AST / BEATs / Whisper-encoder。理由を 1 文で示します。
2. Augmentations. SpecAugment params (time mask, freq mask counts)、mixup α、background noise mix level。
3. Class balance. Balanced sampler vs focal loss vs class weights。tail-to-head ratio に合わせます。
4. Loss + metric. CE / BCE / focal。primary metric (top-1 / mAP / macro-F1) と secondary。
5. Split + eval plan. Stratified k-fold。speech なら speaker-disjoint、streaming data なら temporal split。

top-1 accuracy だけで採点される multi-label task は拒否し、mAP を要求します。speaker-disjoint splits なしで speaker-conditioned task を評価することは拒否します。<10k labeled clips でゼロから architecture を作る場合はフラグします。SSL-pretrained backbone から始めます。
