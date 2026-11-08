# Evidence: cheatsheets/diffusion-models.md

Abbreviations: P08 = phases/08-generative-ai. VAE = P08/02-autoencoders-vae, GAN = P08/03-gans-generator-discriminator, DDPM = P08/06-diffusion-ddpm-from-scratch, LDM = P08/07-latent-diffusion-stable-diffusion, CN = P08/08-controlnet-lora-conditioning, FM = P08/13-flow-matching-rectified-flows, EV = P08/14-evaluation-fid-clip-score. doc = docs/en.md, code = code/main.py.

## Architecture: Latent diffusion with CFG (8 nodes)
- text "Text encoder, frozen, CLIP or T5": LDM/doc:28
- noise "Noisy latent, starts as N(0, I)": LDM/doc:26, DDPM/doc:44
- den "Denoiser, U-Net or DiT": LDM/doc:26, 127
- cfg "CFG mix, cond and uncond": LDM/doc:69-72
- lat "Clean latent 64 x 64 x 4": LDM/doc:16, VAE/doc:102
- dec "VAE decoder, latent to pixels": LDM/doc:26, VAE/doc:146
- img "Image 512 x 512 x 3": VAE/doc:102
- enc "VAE encoder, training and img2img": LDM/doc:26, VAE/doc:146
- edge "cross attn": LDM/doc:28, 82. "T steps": DDPM/doc:44. "add noise": LDM/doc:26, 30

## Flow: DDPM train and sample (7)
1. linear beta 1e-4 to 0.02, alpha bar: DDPM/doc:26, code:98-105
2. draw x0, t, eps: DDPM/doc:42, code:114-117
3. closed form x_t: DDPM/doc:42, code:118
4. sinusoidal time embedding, eps_hat: DDPM/code:5-13, 119-120, doc:117
5. squared error, gradient step: DDPM/doc:93, code:121-122
6. x_T ~ N(0, I): DDPM/doc:44, code:129
7. reverse T to 1, noise except last: DDPM/doc:44, code:130-138

## Key formulas (8)
- Forward q(x_t | x_0): DDPM/doc:23
- Alpha bar: DDPM/doc:26
- Simple loss: DDPM/doc:39, 160
- Reverse step: DDPM/doc:31
- VAE loss: VAE/doc:33-36
- GAN minimax: GAN/doc:19
- CFG: LDM/doc:72, 124
- Flow matching x_t and L: FM/doc:27, 39

## Tasks in code (8)
- x_t closed form: DDPM/code:118
- reparameterize: VAE/doc:69
- non-saturating G loss: GAN/doc:69-71
- label dropout 0.1, NULL_CLASS: LDM/code:143
- eps_cfg: LDM/doc:72
- target = x1 - x0: FM/doc:94
- Euler step x -= dt * net_forward(x, t): FM/doc:108
- pipe.vae.enable_tiling(): VAE/doc:148

## Annotated code: DDPM schedule, noise and reverse loop (13 lines)
- betas, alphas, alpha_bars: DDPM/code:99-104
- eps, x_t: DDPM/code:117-118
- x = rng.gauss(0, 1), loop: DDPM/code:129-130
- eps_hat forward: DDPM/code:132
- mean: DDPM/code:134
- noise only when t > 0: DDPM/code:135-138 (if/else folded into a comment)

## Samplers and steps (8)
- DDPM 1000: DDPM/doc:163, 169
- DDIM 20-50, same objective: DDPM/doc:164, 171
- DPM-Solver++ 10-20: DDPM/doc:171
- UniPC 8-16: DDPM/doc:171
- Flow Euler 4-8: FM/doc:71, code:143
- 2 reflows, 2-4 steps: FM/doc:63
- distillation 1-4, retraining: DDPM/doc:128, 172
- VAE or GAN one pass: VAE/doc:41, GAN/doc:153

## Defaults and numbers (8)
- beta start 1e-4: DDPM/doc:26
- beta end 0.02, x_T approx N(0, I): DDPM/doc:26
- T 1000, toy 40: DDPM/doc:26, code:160
- CFG w 3, sweet spot 3-7: LDM/doc:75, 92
- label dropout 10%: LDM/doc:69, DDPM/doc:150
- scaling_factor 0.18215 after encoding: LDM/doc:89
- LoRA rank 4-16, 64-128 heavy: CN/doc:48
- FID 10k: EV/doc:35, 140

## Troubleshooting (8)
- posterior collapse, beta 0 to 1, free bits: VAE/doc:99
- mode collapse fixes: GAN/doc:41, 106
- D too strong, >95%, cut lr 2-5x: GAN/doc:105
- CFG too high, oily, 3-7: LDM/doc:92
- VAE scaling mismatch: LDM/doc:89
- NaN fp16 SD 1.x VAE at 1024², fp16-fix or bf16: VAE/doc:149
- LoRA on wrong base no-op: CN/doc:103
- FID low N, 3 seeds: EV/doc:35, 127, 129

## Abbreviations (8)
- VAE: VAE/doc:136
- ELBO: VAE/doc:137
- GAN G and D: GAN/doc:28-30, 142
- DDPM: DDPM/doc:163
- DDIM: DDPM/doc:164
- CFG: DDPM/doc:165
- DiT: LDM/doc:127
- FID: EV/doc:161

## Questions (5)
- log sigma2 unconstrained, softplus trap: VAE/doc:61
- blurry samples, mean: VAE/doc:100
- latent diffusion ~64x fewer FLOPs: LDM/doc:14
- FM and DDPM equivalent for Gaussian paths: FM/doc:75
- FID formula, Inception-v3, lower is better: EV/doc:28-32

## Tips (6)
- closed form KL, Monte Carlo 3x slower: VAE/doc:85
- fresh fakes for G: GAN/doc:84, 88
- proper time embedding, raw t fails: DDPM/doc:125
- cosine schedule when quality plateaus: DDPM/doc:124
- ControlNet weights sum near 1.0, LoRA alpha <= 1.5: CN/doc:101-102
- report several metrics together: EV/doc:73-80
