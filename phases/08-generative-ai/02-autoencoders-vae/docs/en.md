# Autoencoders & Variational Autoencoders (VAE)

> A plain autoencoder compresses then reconstructs. It memorizes. It does not generate. Add one trick — force the code to look Gaussian — and you get a sampler. That single trick, the reparameterization of $z = \mu + \sigma \cdot \epsilon$, is why every latent-diffusion and flow-matching image model you use in 2026 has a VAE at the input.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 07 (CNNs), Phase 8 · 01 (Taxonomy)
**Time:** ~75 minutes

## The Problem

Compress a 784-pixel MNIST digit to a 16-number code, then reconstruct. A plain autoencoder will ace reconstruction MSE but the code space is a lumpy mess. Pick a random point in the code space, decode it, and you get noise. It has no sampler. It is a compression model dressed up.

What you actually want is: (a) the code space is a clean, smooth distribution you can sample from — say an isotropic Gaussian $N(0, I)$, (b) decoding any sample produces a plausible digit, and (c) the encoder and decoder still compress well. Three goals, one architecture, one loss.

Kingma's 2013 VAE solves this by training the encoder to output a *distribution* $q(z \mid x) = N(\mu(x), \sigma(x)^2)$, pulling that distribution toward the prior $N(0, I)$ via a KL penalty, and then sampling $z$ from $q(z \mid x)$ before decoding. At inference time, drop the encoder, sample $z \sim N(0, I)$, decode. The KL penalty is what forces the code space to be structured.

In 2026 VAEs rarely ship standalone — they have been outclassed by diffusion for raw image quality — but they are the encoder of choice for every latent-diffusion model (SD 1/2/XL/3, Flux, AudioCraft). Learn the VAE and you learn the invisible first layer of every image pipeline you use.

## The Concept

![Autoencoder vs VAE: the reparameterization trick](../assets/vae.svg)

**Autoencoder.** $z = \text{encoder}(x)$, $\hat{x} = \text{decoder}(z)$, loss = $\|x - \hat{x}\|^2$. Code space unstructured.

**VAE encoder.** Outputs two vectors: $\mu(x)$ and $\log \sigma^2(x)$. These define $q(z \mid x) = N(\mu, \mathrm{diag}(\sigma^2))$.

**Reparameterization trick.** Sampling from $q(z \mid x)$ is not differentiable. Rewrite the sample as $z = \mu + \sigma \cdot \epsilon$ where $\epsilon \sim N(0, I)$. Now $z$ is a deterministic function of $(\mu, \sigma)$ plus a non-parameter noise — gradients flow through $\mu$ and $\sigma$.

**Loss.** Evidence Lower BOund (ELBO), two terms:

$$
\begin{aligned}
\text{loss} &= \text{reconstruction} + \beta \cdot \mathrm{KL}[q(z \mid x) \,\|\, N(0, I)] \\
&= \|x - \hat{x}\|^2 + \beta \cdot \sum_i ( \sigma_i^2 + \mu_i^2 - \log \sigma_i^2 - 1 ) / 2
\end{aligned}
$$

Reconstruction pushes $\hat{x}$ toward $x$. KL pushes $q(z \mid x)$ toward the prior. They trade off. Small $\beta < 1$ = sharper samples, code space less Gaussian. Large $\beta > 1$ = cleaner code space, blurrier samples. β-VAE (Higgins 2017) made this knob famous and kicked off disentanglement research.

**Sampling.** At inference: draw $z \sim N(0, I)$, forward through decoder. One forward pass — no iterative sampling like diffusion.

```figure
vae-latent-grid
```

## Build It

`code/main.py` implements a tiny VAE without numpy or torch. Input is 8-dimensional synthetic data drawn from a 2-component Gaussian mixture in 8-D. Encoder and decoder are single hidden-layer MLPs. We implement tanh activation, forward pass, loss, and a hand-written backward pass. Not production — pedagogy.

### Step 1: encoder forward

```python
def encode(x, enc):
    h = tanh(add(matmul(enc["W1"], x), enc["b1"]))
    mu = add(matmul(enc["W_mu"], h), enc["b_mu"])
    log_sigma2 = add(matmul(enc["W_sig"], h), enc["b_sig"])
    return mu, log_sigma2
```

$\log \sigma^2$ instead of $\sigma$ so the network output is unconstrained (softplus of $\sigma$ is a trap — gradients die at $\sigma \approx 0$).

### Step 2: reparameterize and decode

```python
def reparameterize(mu, log_sigma2, rng):
    eps = [rng.gauss(0, 1) for _ in mu]
    sigma = [math.exp(0.5 * lv) for lv in log_sigma2]
    return [m + s * e for m, s, e in zip(mu, sigma, eps)]

def decode(z, dec):
    h = tanh(add(matmul(dec["W1"], z), dec["b1"]))
    return add(matmul(dec["W_out"], h), dec["b_out"])
```

### Step 3: the ELBO

```python
def elbo(x, x_hat, mu, log_sigma2, beta=1.0):
    recon = sum((a - b) ** 2 for a, b in zip(x, x_hat))
    kl = 0.5 * sum(math.exp(lv) + m * m - lv - 1 for m, lv in zip(mu, log_sigma2))
    return recon + beta * kl, recon, kl
```

Exact closed-form KL because both distributions are Gaussian. Do not integrate numerically. People still ship code with monte-carlo KL estimates in 2026 — it is 3x slower for no reason.

### Step 4: generate

```python
def sample(dec, z_dim, rng):
    z = [rng.gauss(0, 1) for _ in range(z_dim)]
    return decode(z, dec)
```

That is the generative model. Five lines.

## Pitfalls

- **Posterior collapse.** KL term drives $q(z \mid x) \to N(0, I)$ so aggressively that $z$ carries no info about $x$. Fix: β-annealing (start β=0, ramp to 1), free bits, or skip the KL on inactive dimensions.
- **Blurry samples.** The Gaussian decoder likelihood implies MSE reconstruction, which is Bayes-optimal for L2 (the mean) — the mean of a set of plausible digits is a fuzzy digit. Fix: discrete decoder (VQ-VAE, NVAE), or use the VAE only as an encoder and stack diffusion on the latents (this is what Stable Diffusion does).
- **β too large, too early.** See posterior collapse. Start at β≈0.01 and ramp.
- **Latent dim too small.** 16-D works for MNIST, 256-D for ImageNet $256^2$, 2048-D for ImageNet $1024^2$. Stable Diffusion's VAE compresses $512 \times 512 \times 3 \to 64 \times 64 \times 4$ (32x downsample factor in spatial area, 32x in channels).

## Use It

The 2026 VAE stack:

| Situation | Pick |
|-----------|------|
| Image-latent encoder for diffusion | Stable Diffusion VAE (`sd-vae-ft-ema`) or Flux VAE |
| Audio-latent encoder | Encodec (Meta), SoundStream, or DAC (Descript) |
| Video latents | Sora's spatiotemporal patches, Latte VAE, WAN VAE |
| Disentangled representation learning | β-VAE, FactorVAE, TCVAE |
| Discrete latents (for transformer modelling) | VQ-VAE, RVQ (ResidualVQ) |
| Continuous latents for generation | Plain VAE, then condition a flow/diffusion model in that latent space |

A latent-diffusion model is a VAE with a diffusion model living between encoder and decoder. The VAE does coarse compression, the diffusion model does the heavy lifting. Same pattern for video (VAE + video-diffusion DiT) and audio (Encodec + MusicGen transformer).

## Ship It

Save `outputs/skill-vae-trainer.md`.

Skill takes: dataset profile + latent-dim target + downstream use (reconstruction, sampling, or latent-diffusion input) and outputs: architecture choice (plain/β/VQ/RVQ), β schedule, latent dim, decoder likelihood (Gaussian vs categorical), and evaluation plan (recon MSE, KL per dim, Fréchet distance between $q(z \mid x)$ and $N(0, I)$).

## Exercises

1. **Easy.** Change `β` in `code/main.py` to `0.01`, `0.1`, `1.0`, `5.0`. Record the final reconstruction MSE and KL. Which β is Pareto-best for your synthetic data?
2. **Medium.** Replace the Gaussian decoder likelihood with a Bernoulli likelihood (cross-entropy loss). Compare sample quality on a binarized version of the same synthetic data.
3. **Hard.** Extend `code/main.py` into a mini VQ-VAE: replace the continuous `z` with a nearest-neighbour lookup in a codebook of K=32 entries. Compare reconstruction MSE and report how many codebook entries get used (codebook collapse is real).

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Autoencoder | Encode-decode network | $x \to z \to \hat{x}$, learn MSE. Not generative. |
| VAE | AE with a sampler | Encoder outputs a distribution, KL penalty shapes code space. |
| ELBO | Evidence lower bound | $\log p(x) \geq \text{recon} - \mathrm{KL}[q(z \mid x) \,\vert\vert\, p(z)]$; tight when $q = p(z \mid x)$. |
| Reparameterization | $z = \mu + \sigma \cdot \epsilon$ | Rewrites stochastic node as deterministic + pure noise. Enables backprop through sampling. |
| Prior | $p(z)$ | Target distribution for the latent, typically $N(0, I)$. |
| Posterior collapse | "KL term wins" | Encoder ignores $x$, outputs the prior; decoder must hallucinate. |
| β-VAE | Tunable KL weight | $\text{loss} = \text{recon} + \beta \cdot \mathrm{KL}$. Higher β = more disentangled but blurrier. |
| VQ-VAE | Discrete latent | Replace continuous $z$ with nearest codebook vector; enables transformer modelling. |

## Production note: the VAE is the hottest path in a diffusion server

In a Stable Diffusion / Flux / SD3 pipeline the VAE is called twice per request — once to encode (if doing img2img / inpainting) and once to decode. At $1024^2$ the decoder pass is often the single largest activation-memory peak in the whole pipeline because it upsamples $128 \times 128 \times 16$ latents back to $1024 \times 1024 \times 3$. Two practical consequences:

- **Slice or tile the decode.** `diffusers` exposes `pipe.vae.enable_slicing()` and `pipe.vae.enable_tiling()`. Tiling trades a small seam artifact for $O(\text{tile}^2)$ memory instead of $O(H \cdot W)$. Essential for $1024^2$+ on consumer GPUs.
- **bf16 decoder, fp32 numerics for the final resize.** The SD 1.x VAE was released in fp32 and *silently produces NaNs* when cast to fp16 at $1024^2$+. SDXL ships `madebyollin/sdxl-vae-fp16-fix` — always prefer the fp16-fix variant or use bf16.

## Further Reading

- [Kingma & Welling (2013). Auto-Encoding Variational Bayes](https://arxiv.org/abs/1312.6114) — the VAE paper.
- [Higgins et al. (2017). β-VAE: Learning Basic Visual Concepts with a Constrained Variational Framework](https://openreview.net/forum?id=Sy2fzU9gl) — disentangled β-VAE.
- [van den Oord et al. (2017). Neural Discrete Representation Learning](https://arxiv.org/abs/1711.00937) — VQ-VAE.
- [Vahdat & Kautz (2021). NVAE: A Deep Hierarchical Variational Autoencoder](https://arxiv.org/abs/2007.03898) — state-of-the-art image VAE.
- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) — Stable Diffusion; VAE as encoder.
- [Défossez et al. (2022). High Fidelity Neural Audio Compression](https://arxiv.org/abs/2210.13438) — Encodec, the audio VAE standard.
