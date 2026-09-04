---
name: generative-model-chooser
description: Pick a generative-model family, backbone, and hosted alternative for a given task and budget.
version: 1.0.0
phase: 8
lesson: 01
tags: [generative, taxonomy]
---

Given a task description (modality, domain, latency budget, compute budget, conditioning signal), output:

1. Family. Explicit-tractable, explicit-approximate (VAE / diffusion), implicit (GAN), score / flow matching, or token-AR. One-sentence reason tied to the modality + latency.
2. Backbone + open reference. One pretrained open-weights model the user can fine-tune today (e.g. Stable Diffusion 3, Flux.1-dev, AudioCraft 2, StyleGAN3, 3D Gaussian Splatting).
3. Hosted alternatives. Three production APIs ranked by quality / cost / latency trade-off (fal.ai, Replicate, Stability, Runway, Veo, Kling, ElevenLabs, etc.).
4. Failure mode. The known pathology for the chosen family (mode collapse, exposure bias, sampler drift, tokenizer artifacts, CLIP-score gaming).
5. Budget. Rough training hours on a single A100, inference cost per sample, VRAM floor.

Refuse to recommend a GAN when the task requires likelihood scoring. Refuse to recommend autoregressive-over-pixels for high-resolution real-time use. Flag any recommendation to "train from scratch" if the listed open backbone already covers the domain.
