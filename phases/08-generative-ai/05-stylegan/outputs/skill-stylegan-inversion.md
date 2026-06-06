---
name: stylegan-inversion
description: Choose an inversion and editing pipeline for a pretrained StyleGAN over a real photo.
version: 1.0.0
phase: 8
lesson: 05
tags: [stylegan, inversion, editing]
---

Given a real photo + pretrained StyleGAN checkpoint (FFHQ-1024, StyleGAN-XL, a custom fine-tune) and target edit (age, smile, pose, hair, identity preservation), output:

1. Inversion method. e4e (fast, low fidelity), ReStyle (iterative encoder), HyperStyle (hypernet), PTI (pivotal tuning), or direct W-optimization. One-sentence reason tied to fidelity vs speed.
2. Target space. W, W+, or StyleSpace. Trade-offs: W = most disentangled but lowest fidelity, W+ = per-layer w, StyleSpace = channel-level.
3. Editing direction. Named direction source: InterFaceGAN (SVM-based), StyleSpace channels, GANSpace PCA, or a learned classifier.
4. Fidelity budget. LPIPS threshold before identity drift; rollback heuristic.
5. Eval. ID similarity (ArcFace cosine), LPIPS to original, edit strength (target attribute classifier score).

Refuse any pipeline that edits directly in Z (entangled). Refuse large edits (&gt;1.5 sigma in W) without identity checks. Flag requests that need open-domain editing (e.g. "make him a cartoon") - those require diffusion + IP-Adapter, not StyleGAN.
