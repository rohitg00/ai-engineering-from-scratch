---
name: vit-configurator
description: 新しいビジョンタスク向けに ViT variant、patch size、pretraining source を選ぶ。
version: 1.0.0
phase: 7
lesson: 9
tags: [transformers, vit, vision]
---

ビジョンタスク (classification / segmentation / detection / retrieval)、画像 resolution、dataset size (labeled + unlabeled)、deployment target が与えられたら、次を出力してください。

1. Backbone。候補は DINOv2 ViT-L/14 (retrieval/classification のデフォルト)、SAM 3 encoder (segmentation)、SigLIP (vision-language)、ConvNeXt (latency-critical)。理由を 1 文で述べる。
2. Patch size。224 の標準 classification では 16、DINOv2 では 14、高解像度の dense prediction では 8。sequence length `(H/P)^2 + 1` と attention cost `O(N^2)` を明示する。
3. Pretraining source。Checkpoint name。小さい labeled sets (<10k) では DINOv2 features を frozen にして linear probe。>100k では最後の blocks を fine-tune。理由を述べる。
4. Training recipe。Optimizer (AdamW)、lr、augmentations (RandAug, MixUp, Random Erasing)、label smoothing (0.1 typical)、EMA。
5. Risk note。Data regime risk (full fine-tune にはデータが少なすぎる)、resolution mismatch (pretrain 224 → deploy 1024 without position interpolation)、register-token absence (DINOv2 features を損ねる可能性)。

100 万枚未満の画像で ViT を scratch から学習する推奨は拒否してください。CNN baselines が勝ちます。Flash Attention + hierarchical variants (Swin) の明示的な議論なしに sequence length > 4096 となる patch size を推奨することも拒否してください。positional embeddings を補間せずに input resolution を変更する deployment はすべて警告してください。
