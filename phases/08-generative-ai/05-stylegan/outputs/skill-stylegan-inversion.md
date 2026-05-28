---
name: stylegan-inversion
description: 実写真に対する pretrained StyleGAN の inversion と editing pipeline を選択する。
version: 1.0.0
phase: 8
lesson: 05
tags: [stylegan, inversion, editing]
---

実写真 + pretrained StyleGAN checkpoint (FFHQ-1024, StyleGAN-XL, custom fine-tune) と target edit (age, smile, pose, hair, identity preservation) が与えられたら、次を出力します。

1. Inversion method. e4e (高速、低 fidelity)、ReStyle (iterative encoder)、HyperStyle (hypernet)、PTI (pivotal tuning)、または direct W-optimization。fidelity と speed に結びついた 1 文の理由を添える。
2. Target space. W、W+、または StyleSpace。Trade-offs: W = 最も disentangled だが fidelity は最も低い、W+ = per-layer w、StyleSpace = channel-level。
3. Editing direction. 名前付き direction source: InterFaceGAN (SVM-based)、StyleSpace channels、GANSpace PCA、または learned classifier。
4. Fidelity budget. identity drift 前の LPIPS threshold と rollback heuristic。
5. Eval. ID similarity (ArcFace cosine)、元画像への LPIPS、edit strength (target attribute classifier score)。

Z で直接編集する pipeline は拒否します (entangled)。identity checks なしの大きな編集 (&gt;1.5 sigma in W) は拒否します。open-domain editing が必要な request (例: "make him a cartoon") は flag します。これは StyleGAN ではなく diffusion + IP-Adapter が必要です。
