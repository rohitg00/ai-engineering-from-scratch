---
id: gans
title: GANs from DCGAN to StyleGAN
code: GA
subtitle: Losses, DCGAN code, Pix2Pix, CycleGAN and StyleGAN. Defaults, failure signatures and fixes.
hue: 12
sources: phases/08-generative-ai/01-generative-models-taxonomy-history, phases/08-generative-ai/03-gans-generator-discriminator, phases/08-generative-ai/04-conditional-gans-pix2pix, phases/08-generative-ai/05-stylegan, phases/04-computer-vision/09-image-generation-gans
source_hash: bcbf16df3147b7bf
---

## StyleGAN generator
type: architecture
from: phases/08-generative-ai/05-stylegan/docs/en.md

```arch
node | z | 1,1 | z | N(0, I), 512 dims | store
node | map | 2,1 | Mapping network | 8-layer MLP | model
node | w | 3,1 | w in W | roughly disentangled | store
node | const | 1,2 | Learned constant | 4×4×512 | store
node | synth | 2,2 | Synthesis block | upsample, conv, AdaIN, noise | gpu
node | img | 3,2 | Image | 4 up to 1024 | client
node | noise | 1,3 | Per-layer noise | learned per-channel scale | process
edge | z | map |
edge | map | w |
edge | w | synth | AdaIN at every block
edge | const | synth |
edge | noise | synth |
edge | synth | img | resolution doubles
```

## One training step
type: flow
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/code/main.py

1. **Sample**: draw a real batch and noise `z` from N(0, I).
2. **D step**: score real images against 1 and `G(z).detach()` against 0.
3. **G step**: make fresh fakes. Score `D(G(z))` against 1.
4. **Repeat**: one step of D, then one step of G, every batch.
5. **Probe**: every 100 steps, count samples per mode. Warn below 50.
6. **Inspect**: look at 64 samples at the end of every epoch.
7. **Equilibrium**: `p_G = p_data` and D outputs 0.5 everywhere.

## Losses and formulas
type: concepts
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md, phases/08-generative-ai/04-conditional-gans-pix2pix/docs/en.md, phases/08-generative-ai/05-stylegan/docs/en.md

- **Minimax**: $\min_G \max_D \; \mathbb{E}_x[\log D(x)] + \mathbb{E}_z[\log(1 - D(G(z)))]$
- **D loss**: binary cross-entropy with real = 1 and fake = 0.
- **G loss**: $-\log D(G(z))$. This is the non-saturating form.
- **WGAN**: $\text{loss}_D = \mathbb{E}[D(\text{fake})] - \mathbb{E}[D(\text{real})]$, $\text{loss}_G = -\mathbb{E}[D(\text{fake})]$
- **Pix2Pix G**: $-\log D(x, G(x)) + \lambda \cdot \lVert y - G(x) \rVert_1$
- **Cycle**: $F(G(x)) \approx x$ and $G(F(y)) \approx y$.
- **AdaIN**: $y_{\text{scale}} \cdot \frac{x - \mathrm{mean}(x)}{\mathrm{std}(x)} + y_{\text{bias}}$
- **Truncation**: $w' = \hat{w} + \psi \cdot (w - \hat{w})$. $\psi < 1$ trades diversity for quality.

## DCGAN train_step
type: annotated-code
lang: python
from: phases/04-computer-vision/09-image-generation-gans/code/main.py, phases/04-computer-vision/09-image-generation-gans/docs/en.md

```python
opt_d.zero_grad()
d_real = D(real)                    # logits, sigmoid only in the loss
d_fake = D(G(z).detach())           # no gradient flows into G
loss_d = (F.binary_cross_entropy_with_logits(d_real, torch.ones_like(d_real))
          + F.binary_cross_entropy_with_logits(d_fake, torch.zeros_like(d_fake)))
loss_d.backward()
opt_d.step()
opt_g.zero_grad()
d_fake = D(G(z))                    # second pass keeps the graph
loss_g = F.binary_cross_entropy_with_logits(d_fake, torch.ones_like(d_fake))
loss_g.backward()                   # non-saturating G loss
opt_g.step()
```

## Tasks in code
type: task-table
from: phases/04-computer-vision/09-image-generation-gans/code/main.py, phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/08-generative-ai/04-conditional-gans-pix2pix/code/main.py, phases/08-generative-ai/05-stylegan/code/main.py

| Task | Code |
|---|---|
| Build the generator | `Generator(z_dim=64, img_channels=3, feat=32)` |
| Wrap a D conv in SN | `spectral_norm(c)` |
| Make the optimizers | `Adam(lr=2e-4, betas=(0.5, 0.999))` |
| Sample in eval mode | `sample(G, n=8, z_dim=z_dim, device=device)` |
| Count parameters | `sum(p.numel() for p in G.parameters())` |
| Condition G or D | `inp = z + one_hot(c, num_classes)` |
| Map z to w | `w = mapping(z, mapping_net)` |
| Truncate w | `w_bar[i] + psi * (w_test[i] - w_bar[i])` |

## Four GANs side by side
type: comparison
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/08-generative-ai/04-conditional-gans-pix2pix/docs/en.md, phases/08-generative-ai/05-stylegan/docs/en.md
span: 2

| Factor | DCGAN | Pix2Pix | CycleGAN | StyleGAN |
|---|---|---|---|---|
| Input | noise z | image x, dropout as noise | image from domain X | z mapped to w |
| Generator | transposed convs, tanh out | U-Net with skips | G: X to Y and F: Y to X | constant plus AdaIN per block |
| Extra loss | none | λ times L1 | cycle consistency | path-length reg in StyleGAN2 |
| Data | images only | paired (x, y) | unpaired | narrow domain, faces |
| Use for | 32x32 baseline | sketch to photo | horses to zebras, seasons | photoreal faces, editing |

## One pass against many steps
type: comparison
from: phases/08-generative-ai/04-conditional-gans-pix2pix/docs/en.md, phases/08-generative-ai/05-stylegan/docs/en.md

| Factor | Pix2Pix | SD-Img2Img | SDXL-Turbo | ControlNet + SDXL |
|---|---|---|---|---|
| Steps | 1 | 20 | 1-4 | 20-30 |
| 512² on one L4 | ~30 ms | ~1.2 s | ~0.15-0.35 s | ~3-5 s |

## Defaults
type: defaults
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/04-computer-vision/09-image-generation-gans/code/main.py, phases/08-generative-ai/04-conditional-gans-pix2pix/docs/en.md, phases/08-generative-ai/05-stylegan/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Adam `lr` | 2e-4 | DCGAN default for G and D |
| Adam `betas` | (0.5, 0.999) | Low beta1 |
| `z_dim` | 64 | Noise for the 32x32 DCGAN |
| D LeakyReLU slope | 0.2 | All D layers |
| Pix2Pix λ on L1 | 100 | Start here, anneal down |
| PatchGAN field | ~70×70 | Pixels per output cell |
| Truncation ψ | 0.7 | Use 1.0 for diversity |
| TTUR ratio | 2-4 | D learns faster than G |

## Troubleshooting
type: troubleshooting
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md, phases/08-generative-ai/04-conditional-gans-pix2pix/docs/en.md, phases/08-generative-ai/05-stylegan/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| D loss low, G loss oscillates, variety drops | Mode collapse | Minibatch discrimination, spectral norm, labels |
| D accuracy ~100%, G loss huge and static | D wins | Smaller D, lower D learning rate, label smoothing |
| Both losses swing with no trend | Oscillation | TTUR or Wasserstein loss |
| D above 95% accuracy | D too strong | Cut D learning rate by 2-5x |
| One real mode never appears | G memorizes a mode | Noise on D inputs, or WGAN-GP |
| Output ignores the condition | Weak condition signal in D | Condition D early, projection D |
| Blurry Pix2Pix output | L1 weight too high | Anneal λ down once stable |
| Droplet artifacts | AdaIN zeroes the mean | Weight demodulation of StyleGAN2 |

## Terms
type: glossary
from: phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md, phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/08-generative-ai/04-conditional-gans-pix2pix/docs/en.md, phases/08-generative-ai/05-stylegan/docs/en.md

- **DCGAN**: strided convs, batch norm, ReLU in G, LeakyReLU in D.
- **WGAN-GP**: Wasserstein distance plus gradient penalty.
- **SN**: spectral norm. Bounds the Lipschitz constant of each D layer.
- **TTUR**: two-timescale update rule. Two learning rates.
- **cGAN**: conditional GAN. G(z, c) and D(x, c) both see the condition.
- **PatchGAN**: D outputs an N × N grid of per-patch scores.
- **AdaIN**: adaptive instance norm. Normalize, then scale and shift by w.
- **FID**: Fréchet Inception Distance. Lower is better.

## Use X when
type: tips
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/08-generative-ai/03-gans-generator-discriminator/docs/en.md, phases/08-generative-ai/04-conditional-gans-pix2pix/docs/en.md, phases/08-generative-ai/05-stylegan/docs/en.md, phases/08-generative-ai/01-generative-models-taxonomy-history/docs/en.md

- **GAN**: real-time generation under 10 ms, style transfer, image-to-image translation.
- **StyleGAN3**: photoreal human faces with a fixed pose.
- **Pix2Pix**: thousands of paired examples, a narrow task and fast inference.
- **CycleGAN**: image translation with no paired data.
- **Frozen mapping network**: domain adaptation from a few images.
- **Diffusion or flow matching**: anything multi-modal or open-ended.

## Questions
type: qa
from: phases/04-computer-vision/09-image-generation-gans/docs/en.md, phases/08-generative-ai/04-conditional-gans-pix2pix/docs/en.md, phases/08-generative-ai/05-stylegan/docs/en.md, phases/08-generative-ai/01-generative-models-taxonomy-history/docs/en.md

- **Why `G(z).detach()` in the D step?** It stops gradients into G during the D update.
- **Why the non-saturating loss?** Early on `D(G(z))` is near zero. The original G loss then has vanishing gradients.
- **Why switch to eval mode before sampling?** Batch norm then uses running stats.
- **Why does D see the pair (x, y)?** Without x, D cannot check consistency.
- **Why does StyleGAN still ship?** One forward pass. Under 10 ms for a 1024² face on a 4090.
- **Can a GAN give p(x)?** No. It is an implicit density model. It only samples.
