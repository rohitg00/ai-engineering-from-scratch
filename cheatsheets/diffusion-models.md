---
id: diffusion-models
title: Diffusion and Generative Models
code: DG
subtitle: Train and sample a VAE, a GAN, DDPM, latent diffusion and flow matching, then measure them. Toy Python from the lessons.
hue: 300
sources: phases/08-generative-ai/02-autoencoders-vae, phases/08-generative-ai/03-gans-generator-discriminator, phases/08-generative-ai/06-diffusion-ddpm-from-scratch, phases/08-generative-ai/07-latent-diffusion-stable-diffusion, phases/08-generative-ai/08-controlnet-lora-conditioning, phases/08-generative-ai/13-flow-matching-rectified-flows, phases/08-generative-ai/14-evaluation-fid-clip-score
source_hash: fa31bd8433c7b343
---

## Latent diffusion with CFG
type: architecture
from: phases/08-generative-ai/07-latent-diffusion-stable-diffusion/docs/en.md, phases/08-generative-ai/02-autoencoders-vae/docs/en.md

```arch
node | text | 1,1 | Text encoder | frozen, CLIP or T5
node | noise | 2,1 | Noisy latent | starts as N(0, I)
node | den | 3,1 | Denoiser | U-Net or DiT
node | cfg | 4,1 | CFG mix | cond and uncond
node | lat | 4,2 | Clean latent | 64 x 64 x 4
node | dec | 3,2 | VAE decoder | latent to pixels
node | img | 2,2 | Image | 512 x 512 x 3
node | enc | 1,2 | VAE encoder | training and img2img
edge | text | den | cross attn
edge | noise | den |
edge | den | cfg | two eps
edge | cfg | lat | T steps
edge | lat | dec |
edge | dec | img |
edge | img | enc | train
edge | enc | noise | add noise
```

## DDPM train and sample
type: flow
from: phases/08-generative-ai/06-diffusion-ddpm-from-scratch/docs/en.md, phases/08-generative-ai/06-diffusion-ddpm-from-scratch/code/main.py

1. **Schedule**: linear $\beta_t$ from 1e-4 to 0.02 over $T$ steps, then $\bar\alpha_t$.
2. **Draw**: $x_0$ from data, $t$ at random, $\epsilon \sim \mathcal{N}(0, I)$.
3. **Noise**: compute $x_t$ in one shot from the closed form.
4. **Predict**: the net takes $x_t$ and a sinusoidal embedding of $t$ and outputs $\hat\epsilon$.
5. **Loss**: squared error between $\epsilon$ and $\hat\epsilon$, then a gradient step.
6. **Start sampling**: draw $x_T \sim \mathcal{N}(0, I)$.
7. **Reverse**: apply the reverse step from $t = T$ to 1. Add noise on every step except the last.

## Key formulas
type: concepts
from: phases/08-generative-ai/06-diffusion-ddpm-from-scratch/docs/en.md, phases/08-generative-ai/02-autoencoders-vae/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md, phases/08-generative-ai/07-latent-diffusion-stable-diffusion/docs/en.md, phases/08-generative-ai/13-flow-matching-rectified-flows/docs/en.md

- **Forward**: $q(x_t \mid x_0) = \mathcal{N}\left( \sqrt{\bar\alpha_t} \, x_0, (1 - \bar\alpha_t) I \right)$
- **Alpha bar**: $\bar\alpha_t = \prod_{s=1}^{t} (1 - \beta_s)$
- **Simple loss**: $L_{\text{simple}} = \lVert \epsilon - \epsilon_\theta(x_t, t) \rVert^2$
- **Reverse step**: $x_{t-1} = \frac{1}{\sqrt{\alpha_t}} \left( x_t - \frac{\beta_t}{\sqrt{1 - \bar\alpha_t}} \epsilon_\theta(x_t, t) \right) + \sigma_t z$
- **VAE loss**: $\lVert x - \hat{x} \rVert^2 + \beta \sum_i \frac{\sigma_i^2 + \mu_i^2 - \log \sigma_i^2 - 1}{2}$
- **GAN game**: $\min_G \max_D \, \mathbb{E}[\log D(x)] + \mathbb{E}[\log(1 - D(G(z)))]$
- **CFG**: $\epsilon_{\text{cfg}} = (1 + w) \epsilon_{\text{cond}} - w \epsilon_{\text{uncond}}$
- **Flow matching**: $x_t = t x_1 + (1 - t) x_0$, $L = \lVert v_\theta(x_t, t) - (x_1 - x_0) \rVert^2$

## Tasks in code
type: task-table
from: phases/08-generative-ai/06-diffusion-ddpm-from-scratch/code/main.py, phases/08-generative-ai/02-autoencoders-vae/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md, phases/08-generative-ai/07-latent-diffusion-stable-diffusion/docs/en.md, phases/08-generative-ai/07-latent-diffusion-stable-diffusion/code/main.py, phases/08-generative-ai/13-flow-matching-rectified-flows/docs/en.md

| Task | Code |
|---|---|
| Noise $x_0$ to step $t$ | `x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps` |
| VAE reparameterize | `[m + s * e for m, s, e in zip(mu, sigma, eps)]` |
| Non-saturating G loss | `-sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)` |
| Drop the label for CFG | `use_c = NULL_CLASS if rng.random() < 0.1 else c` |
| Mix with CFG | `eps_cfg = (1 + w) * eps_cond - w * eps_uncond` |
| Flow matching target | `target = x1 - x0` |
| Euler step, flow | `x -= dt * net_forward(x, t)` |
| Tile the VAE decode | `pipe.vae.enable_tiling()` |

## DDPM schedule, noise and reverse loop
type: annotated-code
lang: python
from: phases/08-generative-ai/06-diffusion-ddpm-from-scratch/code/main.py

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]  # linear
alphas = [1 - b for b in betas]
alpha_bars, cum = [], 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)                      # cumulative product
eps = rng.gauss(0, 1)                           # training noise
x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps  # one shot
x = rng.gauss(0, 1)                             # sampling starts at noise
for t in range(T - 1, -1, -1):                  # T-1 down to 0
    eps_hat, _ = forward([x], t_emb, net)       # predicted noise
    mean = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat[0]) / math.sqrt(alphas[t])
    x = mean + math.sqrt(beta_t) * rng.gauss(0, 1)  # only when t > 0
```

## Samplers and steps
type: command-table
from: phases/08-generative-ai/06-diffusion-ddpm-from-scratch/docs/en.md, phases/08-generative-ai/13-flow-matching-rectified-flows/docs/en.md, phases/08-generative-ai/02-autoencoders-vae/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md

| Sampler | Steps |
|---|---|
| DDPM | 1000 reverse steps in the paper |
| DDIM | 20 to 50, same training objective |
| DPM-Solver++ | 10 to 20 |
| UniPC | 8 to 16 |
| Flow matching, Euler | 4 to 8 on straight paths |
| Rectified flow, 2 reflows | 2 to 4 |
| Distillation, consistency | 1 to 4, needs retraining |
| VAE or GAN | one forward pass |

## Defaults and numbers
type: defaults
from: phases/08-generative-ai/06-diffusion-ddpm-from-scratch/docs/en.md, phases/08-generative-ai/06-diffusion-ddpm-from-scratch/code/main.py, phases/08-generative-ai/07-latent-diffusion-stable-diffusion/docs/en.md, phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md, phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md

| Setting | Default | Note |
|---|---|---|
| $\beta$ start | 1e-4 | linear schedule |
| $\beta$ end | 0.02 | $x_T$ is close to $\mathcal{N}(0, I)$ |
| Steps $T$ | 1000 | the toy code uses 40 |
| CFG scale $w$ | 3 | 3 to 7 is the sweet spot |
| CFG label dropout | 10% | null token in training |
| SD 1.x VAE scaling factor | 0.18215 | applied after encoding |
| LoRA rank $r$ | 4-16 | attention layers, 64 to 128 for heavy fine tunes |
| FID sample count | 10k | low N gives a falsely low FID |

## Troubleshooting
type: troubleshooting
from: phases/08-generative-ai/02-autoencoders-vae/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md, phases/08-generative-ai/07-latent-diffusion-stable-diffusion/docs/en.md, phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md, phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| $z$ carries no information about $x$ | posterior collapse, KL wins | anneal $\beta$ from 0 to 1, or free bits |
| GAN makes one mode only | mode collapse | noise on D inputs, minibatch discrimination or WGAN-GP |
| G stops improving, D over 95% accuracy | D is too strong | cut the D learning rate by 2-5x |
| Saturated, oily images | CFG too high | keep $w$ at 3 to 7 |
| Denoiser trains on wrong latent variance | VAE scaling factor missing | apply the checkpoint scaling factor |
| NaNs from the SD 1.x VAE at 1024² | fp16 cast | use the fp16-fix VAE or bf16 |
| LoRA has no effect | trained on another base | use the matching base model |
| FID looks too good | N under 10k | use 10k samples or more and 3 seeds |

## Abbreviations
type: glossary
from: phases/08-generative-ai/02-autoencoders-vae/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md, phases/08-generative-ai/06-diffusion-ddpm-from-scratch/docs/en.md, phases/08-generative-ai/07-latent-diffusion-stable-diffusion/docs/en.md, phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md, phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md

- **VAE**: Variational autoencoder. The encoder outputs a distribution, a KL term shapes the code space.
- **ELBO**: Evidence lower bound. Reconstruction minus KL, a lower bound on $\log p(x)$.
- **GAN**: Generator $G(z)$ and discriminator $D(x)$ in a minimax game.
- **DDPM**: Ho et al. 2020. Linear $\beta$, 1000 steps, U-Net.
- **DDIM**: Non-Markov sampler. 20 to 50 steps, same training objective.
- **CFG**: Classifier-free guidance. Mixes conditional and unconditional predictions.
- **DiT**: Diffusion Transformer. A transformer over latent patches in place of the U-Net.
- **FID**: Fréchet Inception Distance. Distance of Gaussian fits to real and generated features.

## Questions
type: qa
from: phases/08-generative-ai/02-autoencoders-vae/docs/en.md, phases/08-generative-ai/07-latent-diffusion-stable-diffusion/docs/en.md, phases/08-generative-ai/13-flow-matching-rectified-flows/docs/en.md, phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md

- **Why output log σ² and not σ?** The output stays unconstrained. Gradients die at σ near 0 with softplus.
- **Why are VAE samples blurry?** MSE reconstruction gives the mean of the plausible outputs.
- **Why diffuse in latent space?** The 64×64×4 latent needs about 64x fewer FLOPs for comparable quality.
- **Are flow matching and DDPM different?** For Gaussian paths they are algebraically equivalent.
- **How is FID computed?** $\lVert \mu_r - \mu_g \rVert^2 + \mathop{\mathrm{Tr}}(\Sigma_r + \Sigma_g - 2 (\Sigma_r \Sigma_g)^{0.5})$ on Inception-v3 features. Lower is better.

## Tips
type: tips
from: phases/08-generative-ai/02-autoencoders-vae/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md, phases/08-generative-ai/06-diffusion-ddpm-from-scratch/docs/en.md, phases/08-generative-ai/08-controlnet-lora-conditioning/docs/en.md, phases/08-generative-ai/14-evaluation-fid-clip-score/docs/en.md

- Use the closed form KL. A Monte Carlo KL is 3x slower.
- Give G fresh fakes at each step, or its gradients are stale.
- Use a proper time embedding for images. Raw $t$ fails.
- Try the cosine schedule when quality plateaus.
- Keep the sum of ControlNet weights near 1.0. Keep LoRA $\alpha \le 1.5$.
- Report FID, CLIP score and human preference together.
