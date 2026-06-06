---
name: skill-dcgan-scaffold
description: Write a complete DCGAN scaffold from z_dim, image_size, and num_channels, including training loop and sample saver
version: 1.0.0
phase: 4
lesson: 9
tags: [computer-vision, gan, dcgan, scaffolding]
---

# DCGAN Scaffold

Given three parameters, emit a runnable DCGAN project skeleton with the architecture sized correctly for the target image resolution.

## When to use

- Starting a new generative experiment on a small dataset.
- Teaching DCGAN fundamentals with a working minimal example.
- Prototyping conditional GANs (label injection happens in the same scaffold).

## Inputs

- `image_size`: one of 32, 64, 128 (must be a power of two).
- `num_channels`: 1 (grayscale) or 3 (RGB).
- `z_dim`: typically 64 or 128.
- `with_spectral_norm`: yes | no; default yes.

## Architecture sizing

Number of transposed conv blocks in G and strided conv blocks in D depends on `image_size`:

| image_size | G blocks | D blocks |
|------------|----------|----------|
| 32         | 4        | 4        |
| 64         | 5        | 5        |
| 128        | 6        | 6        |

Each additional block doubles (G) or halves (D) the spatial dimension. Feature count starts at 32 and scales with `feat_base * 2^block_index`.

## Output files

- `model.py` — Generator + Discriminator classes
- `train.py` — training loop, loss, optimiser setup
- `sample.py` — sample grid saver
- `config.json` — hyperparameters
- `README.md` — 10-line quickstart

## Report

```
[scaffold]
  image_size:       <int>
  num_channels:     <int>
  z_dim:            <int>
  spectral_norm:    yes | no

[arch]
  G blocks:         <N>, channels: [list]
  D blocks:         <N>, channels: [list]
  G params (est):   <N>
  D params (est):   <N>

[training defaults]
  optimizer:   Adam(lr=2e-4, betas=(0.5, 0.999))
  batch_size:  64
  epochs:      50
  sample_every: 1 epoch

[files written]
  - model.py
  - train.py
  - sample.py
  - config.json
  - README.md
```

## Rules

- Always use `nn.Tanh()` on G's output and scale data to [-1, 1] during training.
- Always use `LeakyReLU(0.2)` in D.
- When `with_spectral_norm == yes`, wrap every conv in D with `spectral_norm()` and remove BatchNorm from D. Keep BatchNorm in G.
- Never emit a scaffold for image_size > 128 — DCGAN becomes unstable above that; point the user to StyleGAN or a diffusion model.
