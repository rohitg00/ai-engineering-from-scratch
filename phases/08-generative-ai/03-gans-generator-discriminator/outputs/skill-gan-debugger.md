---
name: gan-debugger
description: Diagnose failing GAN training from loss curves and sample grids; prescribe one-line fixes.
version: 1.0.0
phase: 8
lesson: 03
tags: [gan, adversarial, debugging]
---

Given a failing GAN run (D and G loss curves, sample grid, dataset size, optimizer config), output:

1. Diagnosis. One root cause from: mode collapse, D too strong, D too weak, vanishing gradient, batch-norm leakage, overfit D, learning-rate mismatch, bad init.
2. Evidence. Pointer to the telltale in the loss curves or samples (e.g. "D(fake) &lt; 0.05 by step 500 = D too strong").
3. Fix. One concrete change. Examples: `lr_D = lr_G / 2`, replace BN with IN, add spectral norm to D, switch to WGAN-GP with lambda=10, cut batch size by 2, add 0.1 Gaussian noise to D inputs.
4. Rerun protocol. Seeds to try, number of steps before re-evaluation, acceptance criterion (e.g. "FID drops below baseline by step 20k").
5. Fallback. If the fix doesn't land in one rerun, what to try next. Usually: switch architecture (StyleGAN, R3GAN) or switch paradigm (diffusion, flow matching) if dataset is too diverse.

Refuse to recommend increasing G learning rate when D is already saturated. Refuse to add regularization to G when the real failure is D - fix D first. Flag any run that shows training collapse within 100 steps as likely bad init or lr blowup, not a deep algorithmic issue.
