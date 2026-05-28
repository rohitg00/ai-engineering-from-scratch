---
name: skill-rectified-flow-trainer
description: Write a complete rectified-flow training loop with AdaLN DiT and Euler sampling
version: 1.0.0
phase: 4
lesson: 23
tags: [diffusion, rectified-flow, DiT, training]
---

# Rectified Flow Trainer

任意の image tensor dataset 上で small DiT を rectified flow で正しく学習できる、clean で minimal な training loop を生成する。

## 使う場面

- SD3 / FLUX training objective を小規模に再現するとき。
- 同じ data 上で rectified flow と DDPM を benchmark するとき。
- non-standard domain (medical, satellite) 向け custom rectified-flow model を作るとき。

## 入力

- `model`: `(x, t)` を受け取り predicted velocity を返す `nn.Module`。
- `dataset`: model の domain にある clean images の iterable。
- `optimizer`: `lr=1e-4`, `weight_decay=0.01`, `betas=(0.9, 0.99)` の AdamW。
- `scheduler`: warmup 付き cosine。default は 1000 warmup steps。

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

## ヒント

- `torch.rand` による uniform `t` を使う。logit-normal や SD3-style weighted sampling of `t` は少し効くが、始めるには必須ではない。
- model weights の EMA は標準 practice である。decay 0.9999 の `ema_model` を維持する。
- conditional models の Classifier-free guidance: training 中に 10% の確率で conditioning を empty/null embedding に置き換える。inference では `v_uncond + w * (v_cond - v_uncond)` を `w` 3-5 程度で mix する。
- LDM-style training (FLUX, SD3) では、loop 全体が VAE latent space で走る。上の clean `x0` は実際には `VAE.encode(image)` である。
- 32x32 toy dataset の typical convergence は 2000-5000 steps。real latent SD3 training では hundreds of thousands。

## レポート

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

## ルール

- RGB `uint8` data に対して image-space velocity target で rectified flow を学習してはいけない。まず zero mean, unit variance に normalise する。
- timestep-bucket ごとの training loss を必ず log する。early timesteps (near 0) の loss が late timesteps (near 1) より高い場合、velocity parameterisation が miswired の可能性が高い。
- 同じ training loop 内で rectified-flow velocity target と DDPM noise target を混ぜない。どちらかを選ぶ。
- Ampere+ GPUs では bfloat16 training を使う。float16 は velocity magnitude のため rectified flow で NaN grads を出すことがある。
