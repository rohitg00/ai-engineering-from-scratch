---
id: image-generation-compared
title: GANs, Diffusion and Flow Compared
code: GD
subtitle: GAN, DDPM, latent diffusion, DiT with rectified flow, flow matching and VAR. Targets, steps, code and fixes.
hue: 315
sources: phases/04-computer-vision/09-image-generation-gans, phases/04-computer-vision/10-image-generation-diffusion, phases/04-computer-vision/11-stable-diffusion, phases/04-computer-vision/23-diffusion-transformers-rectified-flow, phases/08-generative-ai/13-flow-matching-rectified-flows, phases/08-generative-ai/19-visual-autoregressive-var
source_hash: 45fc3bd2c684c3f5
---

## Sampling cost side by side
type: comparison
from: phases/04-computer-vision/10-image-generation-diffusion/docs/en.md, phases/04-computer-vision/11-stable-diffusion/docs/en.md, phases/04-computer-vision/23-diffusion-transformers-rectified-flow/docs/en.md, phases/08-generative-ai/19-visual-autoregressive-var/docs/en.md

| Family | Passes | Note |
|---|---|---|
| GAN | one forward pass | Fast. Hard to train |
| DDPM | 1000 | Linear beta schedule |
| DDIM | 50 | Deterministic. Same training as DDPM |
| DPM-Solver++ 2M Karras | 20-30 | SD production default |
| Rectified flow (Euler) | 20-30 | SD3, FLUX, Z-Image |
| Schnell, Turbo, LCM | 1-4 | Distilled from a many-step model |
| VAR, K = 10 scales | 10 passes | DiT needs 28-50 at 256x256 |

## Training target side by side
type: comparison
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/04-computer-vision/10-image-generation-diffusion/docs/en.md, phases/04-computer-vision/23-diffusion-transformers-rectified-flow/docs/en.md, phases/08-generative-ai/13-flow-matching-rectified-flows/docs/en.md, phases/08-generative-ai/19-visual-autoregressive-var/docs/en.md

| Family | Target | Loss |
|---|---|---|
| GAN discriminator | P(real) | Binary cross-entropy on real and fake |
| GAN generator | `D(G(z))` | High is good. Non-saturating form |
| DDPM | `epsilon_theta(x_t, t)` | MSE on the true noise |
| Rectified flow (4.23) | `epsilon - x0` | MSE on the velocity |
| Flow matching (8.13) | `x1 - x0` | Here x1 is noise, x0 is data |
| VAR | Cross-entropy | On the VQ codes of the next scale |

## Use X when
type: tips
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/04-computer-vision/11-stable-diffusion/docs/en.md, phases/04-computer-vision/23-diffusion-transformers-rectified-flow/docs/en.md, phases/08-generative-ai/13-flow-matching-rectified-flows/docs/en.md, phases/08-generative-ai/19-visual-autoregressive-var/docs/en.md

- **GAN**: real-time generation under 10 ms, style transfer, Pix2Pix or CycleGAN translation.
- **SD 1.5 latent diffusion**: open-source community fine-tunes with LoRA.
- **DiT + rectified flow**: state of the art text to image. FLUX.1-schnell is the open-source default.
- **Distilled flow (LCM-LoRA, schnell)**: latency under 1s, 1-4 steps.
- **Flow matching**: audio, video and science as well as images.
- **VAR**: class-conditional ImageNet. Fewer passes, GPT-style scaling.

## Stable Diffusion pipeline
type: architecture
from: phases/04-computer-vision/11-stable-diffusion/docs/en.md

```arch
node | txt | 1,1 | Text prompt | | client
node | te | 2,1 | Text encoder | CLIP-L or T5 | model
node | noise | 1,2 | Noise | 4x64x64 | store
node | unet | 3,1 | UNet | cross-attention to text | gpu
node | sched | 3,2 | Scheduler | DPM-Solver++, Euler | process
node | lat | 2,2 | Clean latent | 4x64x64 | store
node | vae | 2,3 | VAE decoder | | model
node | img | 3,3 | Image | 512x512 RGB | client
edge | txt | te |
edge | te | unet | embedding
edge | noise | unet |
edge | unet | sched |
edge | sched | lat |
edge | lat | vae |
edge | vae | img |
```

## Tasks in code
type: task-table
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/04-computer-vision/10-image-generation-diffusion/code/main.py, phases/04-computer-vision/23-diffusion-transformers-rectified-flow/code/main.py, phases/08-generative-ai/19-visual-autoregressive-var/code/main.py

| Task | Code |
|---|---|
| GAN with spectral norm | `build_sn_discriminator()` |
| Linear beta schedule | `linear_beta_schedule(T=1000)` |
| DDPM sampling | `sample_ddpm(model, schedule, shape)` |
| DDIM sampling | `sample_ddim(..., steps=50, eta=0.0)` |
| Rectified flow step | `rectified_flow_train_step(model, x0, ...)` |
| Euler sampling | `rectified_flow_sample(model, shape, steps=20)` |
| Multi-scale VQ tokens | `tokenize_multiscale(img, codebooks)` |

## diffusers calls
type: task-table
from: phases/04-computer-vision/11-stable-diffusion/docs/en.md, phases/04-computer-vision/23-diffusion-transformers-rectified-flow/docs/en.md

| Task | Code |
|---|---|
| SD text to image | `guidance_scale=7.5, num_inference_steps=25` |
| Swap the scheduler | `DPMSolverMultistepScheduler.from_config(...)` |
| Image to image | `img2img(..., image=init_image, strength=0.6)` |
| Inpaint the white area | `inpaint(..., mask_image=mask)` |
| Fuse a LoRA | `pipe.fuse_lora(lora_scale=0.8)` |
| FLUX.1-schnell | `guidance_scale=0.0, num_inference_steps=4` |
| SD 3.5 Large | `guidance_scale=3.5, num_inference_steps=28` |

## DDPM against rectified flow
type: annotated-code
lang: python
from: phases/04-computer-vision/10-image-generation-diffusion/code/main.py, phases/04-computer-vision/23-diffusion-transformers-rectified-flow/code/main.py

```python
t = torch.randint(0, T, (bs,), device=device)   # DDPM: integer step
x_t = q_sample(x0, t, noise, schedule)          # closed-form jump
loss = F.mse_loss(pred, noise)                  # predict the noise
t = torch.rand(n, device=device)                # RF: t in [0, 1]
x_t = (1 - t[:, None, None, None]) * x0 + t[:, None, None, None] * epsilon
target_v = epsilon - x0                         # velocity, data to noise
loss = F.mse_loss(pred_v, target_v)
dt = 1.0 / steps                                # Euler, steps=20
for _ in range(steps):
    v = model(x, t)
    x = x - dt * v                              # walk from noise to data
    t = t - dt
```

## One GAN training step
type: annotated-code
lang: python
from: phases/04-computer-vision/09-image-generation-gans/code/main.py, phases/04-computer-vision/09-image-generation-gans/docs/en.md

```python
opt_d.zero_grad()
d_real = D(real)
d_fake = D(G(z).detach())                    # no gradient into G
loss_d = (F.binary_cross_entropy_with_logits(d_real, torch.ones_like(d_real))
          + F.binary_cross_entropy_with_logits(d_fake, torch.zeros_like(d_fake)))
loss_d.backward()
opt_d.step()
opt_g.zero_grad()
d_fake = D(G(z))
loss_g = F.binary_cross_entropy_with_logits(d_fake, torch.ones_like(d_fake))  # non-saturating
loss_g.backward()
opt_g.step()
opt_g = torch.optim.Adam(G.parameters(), lr=2e-4, betas=(0.5, 0.999))  # DCGAN default
```

## Key formulas
type: concepts
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/04-computer-vision/10-image-generation-diffusion/docs/en.md, phases/04-computer-vision/11-stable-diffusion/docs/en.md, phases/04-computer-vision/23-diffusion-transformers-rectified-flow/docs/en.md, phases/08-generative-ai/13-flow-matching-rectified-flows/docs/en.md

- **GAN game**: $\min_G \max_D \; \mathbb{E}_x[\log D(x)] + \mathbb{E}_z[\log(1 - D(G(z)))]$
- **DDPM jump**: $x_t = \sqrt{\bar{\alpha}_t} \, x_0 + \sqrt{1 - \bar{\alpha}_t} \, \epsilon$, with $\bar{\alpha}_t = \prod_{s=1}^{t} \alpha_s$
- **CFG**: $\epsilon = \epsilon_{\text{uncond}} + w \cdot (\epsilon_{\text{cond}} - \epsilon_{\text{uncond}})$
- **Rectified flow**: $x_t = (1 - t) \, x_0 + t \, \epsilon$ for $t \in [0, 1]$
- **CFG with velocity**: $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$
- **Latent saving**: (3*512*512)/(4*64*64) = 48x less compute.

## VAR next-scale generation
type: flow
from: phases/08-generative-ai/19-visual-autoregressive-var/docs/en.md, phases/08-generative-ai/19-visual-autoregressive-var/code/main.py

1. **Tokenizer**: a multi-scale residual VQ. Train once, then freeze it.
2. **Scale 1**: sample z_1. This is 1 token.
3. **Scale 2**: sample 4 tokens in parallel, given z_1.
4. **Scale 3**: sample 16 tokens in parallel, given z_1 and z_2.
5. **Decode**: sum the upsampled embeddings of all scales. The VAE decoder makes the image.
6. **Toy run**: `SCALES = (1, 2, 4, 8)`, `CODEBOOK = 16`. 4 passes in total.

## Troubleshooting
type: troubleshooting
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/04-computer-vision/11-stable-diffusion/docs/en.md, phases/04-computer-vision/11-stable-diffusion/code/main.py, phases/04-computer-vision/23-diffusion-transformers-rectified-flow/docs/en.md, phases/08-generative-ai/13-flow-matching-rectified-flows/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Sample variety drops | Mode collapse | Spectral norm or label conditioning |
| D accuracy ~100% | D wins, G gradients vanish | Smaller D, lower D learning rate |
| Both losses swing, no trend | G and D trade wins | TTUR: D learns 2-4x faster |
| Samples depend on the batch | BN uses batch stats | Call `G.eval()` before sampling |
| Heavy artefacts | Guidance scale too high | SD 7.5. Rectified flow 3.5-5 |

## Questions
type: qa
from: phases/04-computer-vision/10-image-generation-diffusion/docs/en.md, phases/04-computer-vision/11-stable-diffusion/docs/en.md, phases/04-computer-vision/23-diffusion-transformers-rectified-flow/docs/en.md, phases/08-generative-ai/13-flow-matching-rectified-flows/docs/en.md, phases/08-generative-ai/19-visual-autoregressive-var/docs/en.md

- **Why is diffusion easy to train?** The loss is MSE. There is no adversarial game.
- **Why does rectified flow need fewer steps?** The path is close to a straight line.
- **Why is VAR fast?** One pass makes all tokens of a scale. Length grows with log scale.
- **Why does FLUX.1-schnell use guidance 0.0?** It was trained without CFG.
