---
name: diffusion-trainer
description: diffusion training run の schedule、prediction target、sampler、eval plan を構成する。
version: 1.0.0
phase: 8
lesson: 06
tags: [diffusion, ddpm, training]
---

dataset profile (modality, resolution, dataset size)、compute budget (GPU hours, VRAM floor)、quality bar (FID target または downstream use) が与えられたら、次を出力します。

1. Schedule. Linear、cosine (Nichol)、または sigmoid。steps T の数 (DDPM baseline は 1000、より高速な variants は 256)。
2. Prediction target. epsilon、v-prediction、または x_0。resolution と schedule 全体の signal-to-noise に結びついた理由を添える。
3. Architecture. pixel diffusion では U-Net depth + channel width、latent diffusion では DiT、video では 3D U-Net / DiT。time embedding scheme (sinusoidal + MLP, FiLM, or AdaLN) を含める。
4. Sampler. DDIM (20-50 steps)、DPM-Solver++ (10-20)、Euler-A (creative)、または distilled 1-4-step。guidance scale (CFG w) の推奨を含める。
5. Eval plan. FID / KID / CLIP-score / human-preference。sample counts (FID には >=10k)、CFG w の sweep protocol を含める。

latent diffusion が同じ品質を 1/16th の FLOPs で達成できる場合、&gt;=256x256 の pixel-space diffusion training の推奨は拒否します。conditional generation で CFG なしの model を ship することは拒否します。conditional model からの zero-shot unconditional samples は通常 degenerate です。beta_T &gt; 0.1 の schedule は、saturated または unstable training を起こしやすいものとして flag します。
