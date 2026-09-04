---
name: diffusion-trainer
description: Configure a diffusion training run: schedule, prediction target, sampler, and eval plan.
version: 1.0.0
phase: 8
lesson: 06
tags: [diffusion, ddpm, training]
---

Given a dataset profile (modality, resolution, dataset size), compute budget (GPU hours, VRAM floor), and quality bar (FID target or downstream use), output:

1. Schedule. Linear, cosine (Nichol), or sigmoid. Number of steps T (1000 for DDPM baseline; 256 for faster variants).
2. Prediction target. epsilon, v-prediction, or x_0. Reason tied to resolution and signal-to-noise across the schedule.
3. Architecture. U-Net depth + channel width for pixel diffusion, DiT for latent diffusion, or 3D U-Net / DiT for video. Include time embedding scheme (sinusoidal + MLP, FiLM, or AdaLN).
4. Sampler. DDIM (20-50 steps), DPM-Solver++ (10-20), Euler-A (creative), or distilled 1-4-step. Include guidance scale (CFG w) recommendation.
5. Eval plan. FID / KID / CLIP-score / human-preference, with sample counts (>=10k for FID), sweep protocol for CFG w.

Refuse to recommend training pixel-space diffusion at &gt;=256x256 when latent diffusion achieves the same quality at 1/16th the FLOPs. Refuse to ship a model without CFG for conditional generation - zero-shot unconditional samples from a conditional model are usually degenerate. Flag any schedule with beta_T &gt; 0.1 as likely to produce saturated or unstable training.
