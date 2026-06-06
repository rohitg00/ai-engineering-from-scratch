---
name: skill-rectified-flow-trainer
description: Write a complete rectified-flow training loop with AdaLN DiT and Euler sampling
version: 1.0.0
phase: 4
lesson: 23
tags: [diffusion, rectified-flow, DiT, training]
---

# Rectified Flow Trainer

Produce a clean, minimal training loop that would successfully train a small DiT with rectified flow on any image tensor dataset.

## When to use

- Reproducing the SD3 / FLUX training objective at small scale.
- Benchmarking rectified flow vs DDPM on the same data.
- Building a custom rectified-flow model for a non-standard domain (medical, satellite).

## Inputs

- `model`: an `nn.Module` taking `(x, t)` and returning a predicted velocity.
- `dataset`: an iterable of clean images in the model's domain.
- `optimizer`: AdamW with `lr=1e-4`, `weight_decay=0.01`, `betas=(0.9, 0.99)`.
- `scheduler`: cosine with warmup, default 1000 warmup steps.

## Training step

```python
def rectified_flow_train_step(model, x0, optimizer, device):
    model.train()
    x0 = x0.to(device)
    n = x0.size(0)
    t = torch.rand(n, device=device)                     # uniform in [0, 1]
    epsilon = torch.randn_like(x0)
    x_t = (1 - t[:, None, None, None]) * x0 + t[:, None, None, None] * epsilon
    target_v = epsilon - x0                              # velocity target
    pred_v = model(x_t, t)
    loss = F.mse_loss(pred_v, target_v)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    return loss.item()
```

## Sampling (Euler)

```python
@torch.no_grad()
def sample(model, shape, steps=20, device="cpu"):
    model.eval()
    x = torch.randn(shape, device=device)
    dt = 1.0 / steps
    t = torch.ones(shape[0], device=device)
    for _ in range(steps):
        v = model(x, t)
        x = x - dt * v
        t = t - dt
    return x
```

## Tips

- Use `torch.rand` uniform `t`; logit-normal or Sd3-style weighted sampling of `t` helps slightly but is not required to get started.
- EMA of model weights is standard practice; maintain `ema_model` with decay 0.9999.
- Classifier-free guidance for conditional models: with 10% probability replace the conditioning with an empty/null embedding during training; at inference mix `v_uncond + w * (v_cond - v_uncond)` with `w` around 3-5.
- For LDM-style training (FLUX, SD3), the whole loop runs in a VAE latent space; the clean `x0` above is actually `VAE.encode(image)`.
- Typical convergence on a 32x32 toy dataset: 2000-5000 steps. On real latent SD3 training: hundreds of thousands.

## Report

```
[rectified flow training]
  steps:        <int>
  final loss:   <float>
  ema decay:    <float>
  vae?:         yes | no
  cfg dropout:  <fraction>

[sampling]
  default steps: 20
  schnell / turbo target: 4
  full quality reference: 50+ (for comparison only)
```

## Rules

- Never train rectified flow with an image-space velocity target on RGB `uint8` data; normalise to zero mean, unit variance first.
- Always log training loss per timestep-bucket; if early timesteps (near 0) have higher loss than late ones (near 1) the velocity parameterisation is probably miswired.
- Do not mix rectified-flow velocity target with DDPM noise target in the same training loop; pick one.
- Use bfloat16 training on Ampere+ GPUs; float16 sometimes produces NaN grads in rectified flow due to the velocity magnitude.
