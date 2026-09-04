---
name: skill-noise-schedule-designer
description: Produce a linear, cosine, or sigmoid beta schedule given T and target corruption level, plus SNR plot
version: 1.0.0
phase: 4
lesson: 10
tags: [computer-vision, diffusion, noise-schedule, training]
---

# Noise Schedule Designer

A beta schedule controls how much signal is retained at each diffusion step. Poor schedules cap training efficiency and sample quality at every downstream decision.

## When to use

- Starting a new diffusion training run and picking T and beta.
- Debugging a diffusion model that produces blurry samples (schedule too aggressive) or fails to learn structure (schedule too mild).
- Comparing designs across papers that report different schedules.

## Inputs

- `T`: number of timesteps, typically 100-1000.
- `type`: linear | cosine | sigmoid.
- `target_alpha_bar_final`: fraction of signal to keep at t=T, default 0.001 (99.9% corrupted).
- Optional `image_resolution` — larger images benefit from schedules that corrupt more slowly (cosine or shifted schedules).

## Schedule formulas

### Linear
```
beta_t = beta_start + (beta_end - beta_start) * (t - 1) / (T - 1)
```
Defaults: beta_start=1e-4, beta_end=0.02 (DDPM paper).

### Cosine (Nichol & Dhariwal, 2021)
```
alpha_bar_t = cos^2((t/T + s) / (1 + s) * pi/2)
beta_t = 1 - alpha_bar_t / alpha_bar_{t-1}
```
s = 0.008. Keeps signal around longer; better at low step counts.

### Sigmoid
```
alpha_bar_t = 1 / (1 + exp(k * (t/T - 0.5)))
```
k = 6 to 12. Good middle ground; used by some SDXL variants.

## Steps

1. Compute betas per formula.
2. Precompute `alphas`, `alphas_cumprod`, `sqrt_alphas_cumprod`, `sqrt_one_minus_alphas_cumprod`.
3. Compute SNR_t = alpha_bar_t / (1 - alpha_bar_t); produce an SNR-over-time summary.
4. Verify `alphas_cumprod[T-1]` is within 10% of `target_alpha_bar_final`; else tune beta_end (linear), s (cosine), or k (sigmoid) and retry.
5. Report three checkpoints:
   - `t=T*0.25` — early corruption
   - `t=T*0.5` — midway
   - `t=T*0.75` — near-final

## Report

```
[schedule]
  type:   <name>
  T:      <int>
  beta_start: <float>   beta_end: <float>

[signal retention]
  t=0.25T:  alpha_bar=<X>  SNR=<X>
  t=0.5T:   alpha_bar=<X>  SNR=<X>
  t=0.75T:  alpha_bar=<X>  SNR=<X>
  t=T:      alpha_bar=<X>  SNR=<X>

[warnings]
  - <if alpha_bar collapses before 0.75T>
  - <if beta_end produces NaN in log-SNR>
```

## Rules

- Never emit a schedule with any `alpha_bar_t <= 0`; clamp values under 1e-5 and warn.
- Cosine is the default recommendation for low-step-count sampling (< 30 steps).
- Linear is the default for `quality_target == research` — DDPM baselines are reported with linear schedules.
- When `image_resolution > 256`, recommend shifting the schedule (Chen, 2023) to retain more signal at high resolutions.
