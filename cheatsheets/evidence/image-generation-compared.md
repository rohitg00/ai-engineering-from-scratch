# Evidence: cheatsheets/image-generation-compared.md

Abbreviations: G = phases/04-computer-vision/09-image-generation-gans, D = phases/04-computer-vision/10-image-generation-diffusion, S = phases/04-computer-vision/11-stable-diffusion, R = phases/04-computer-vision/23-diffusion-transformers-rectified-flow, F = phases/08-generative-ai/13-flow-matching-rectified-flows, V = phases/08-generative-ai/19-visual-autoregressive-var. d = docs/en.md, c = code/main.py.

## Sampling cost side by side (defaults, 7 rows)
- GAN one forward pass, fast and hard to train: D/d:19
- DDPM 1000 steps, linear schedule: D/d:35, 103, 318
- DDIM 50 steps, same training, deterministic: D/d:107
- DPM-Solver++ 2M Karras 20-30 steps, production default: S/d:102
- Rectified flow 20-30 Euler steps, SD3, FLUX, Z-Image: R/d:68
- Distilled 1-4 steps: R/d:68, 99
- VAR K = 10 scales, 10 passes vs DiT 28-50 at 256x256: V/d:69

## Training target side by side (defaults, 6 rows)
- D outputs P(real), BCE on real and fake: G/d:35, 42, G/c:60-61
- G wants D(G(z)) high, non-saturating: G/d:52, 63, 67
- DDPM epsilon_theta(x_t, t), MSE: D/d:82-83, 315
- Rectified flow target epsilon - x0, MSE: R/d:234, 237
- Flow matching target x1 - x0, x1 noise, x0 data: F/d:30, 94
- VAR cross-entropy on VQ codes: V/d:55

## Use X when (tips, 6 bullets)
- GAN latency <10 ms, style transfer, Pix2Pix, CycleGAN: G/d:283
- SD 1.5 for community fine-tunes: S/d:236, LoRA distribution: S/d:96
- DiT + rectified flow state of the art, FLUX.1-schnell default: R/d:21, 115
- LCM-LoRA under 1s: S/d:237, 1-4 steps: F/d:128
- Flow matching for audio, video, science: F/d:130-132
- VAR class-conditional ImageNet, fewer passes, scaling: V/d:80, 89

## Stable Diffusion pipeline (architecture, 8 nodes, 7 edges)
- Text prompt: S/d:31
- Text encoder, CLIP-L or T5: S/d:31
- Noise 4x64x64: S/d:34
- UNet with cross-attention to text: S/d:34
- Scheduler DPM-Solver++, Euler: S/d:37
- Clean latent 4x64x64: S/d:38
- VAE decoder: S/d:39
- Image 512x512 RGB: S/d:40
- Text embedding edge from encoder to UNet: S/d:32

## Tasks in code (task-table, 7 rows)
- build_sn_discriminator(): G/d:262, 274
- linear_beta_schedule(T=1000): D/c:9
- sample_ddpm(model, schedule, shape, ...): D/c:83
- sample_ddim(..., steps=50, ..., eta=0.0): D/c:103
- rectified_flow_train_step(model, x0, optimizer, device): R/c:88
- rectified_flow_sample(model, shape, steps=20, ...): R/c:105
- tokenize_multiscale(img, codebooks): V/c:106, 210

## diffusers calls (task-table, 7 rows)
- guidance_scale=7.5, num_inference_steps=25: S/d:128-129
- DPMSolverMultistepScheduler.from_config(pipe.scheduler.config): S/d:142
- img2img with image=init_image, strength=0.6: S/d:160-164
- inpaint with mask_image=mask, white pixels regenerate: S/d:183-186, 191
- pipe.fuse_lora(lora_scale=0.8): S/d:200
- FLUX.1-schnell guidance_scale=0.0, num_inference_steps=4: R/d:302-303
- SD 3.5 Large guidance_scale=3.5, num_inference_steps=28: R/d:315, 318

## DDPM against rectified flow (annotated-code, 13 lines)
- torch.randint(0, T, (bs,), device=device): D/c:71
- q_sample: D/c:73
- F.mse_loss(pred, noise): D/c:74-75
- torch.rand(n, device=device): R/c:92
- x_t straight-line interpolation: R/c:94
- target_v = epsilon - x0, velocity from data to noise: R/c:95, R/d:244
- F.mse_loss(pred_v, target_v): R/c:97
- Euler loop dt = 1.0 / steps, x = x - dt * v, t = t - dt, steps=20: R/c:105-113

## One GAN training step (annotated-code, 13 lines)
- D step with G(z).detach(): G/c:57-63, no gradient into G: G/d:202
- G step with ones_like targets: G/c:65-69, non-saturating: G/d:63
- Adam lr=2e-4, betas=(0.5, 0.999), DCGAN default: G/c:107, G/d:239

## Key formulas (concepts, 6 bullets)
- GAN minimax: G/d:49
- DDPM closed form and alpha bar: D/d:44-46
- CFG: S/d:59
- Rectified flow interpolation: R/d:63
- v-CFG: F/d:121, 157
- 48x latent saving: S/d:21

## VAR next-scale generation (flow, 6 steps)
1. Multi-scale residual VQ, trained once and frozen: V/d:40, 42
2. z_1 is 1 token: V/d:61
3. z_2 4 tokens in parallel: V/d:62
4. z_3 16 tokens in parallel: V/d:63
5. Sum of embed-and-upsample, VAE decoder: V/d:65-66
6. SCALES = (1, 2, 4, 8), CODEBOOK = 16, 4 passes: V/c:36-37, 220

## Troubleshooting (troubleshooting, 5 rows)
- Mode collapse, spectral norm or label conditioning: G/d:85, 94
- D wins, D accuracy ~100%, smaller D, lower D lr: G/d:86, 95
- Oscillation, TTUR 2-4x: G/d:87, 96
- eval before sampling, BN running stats: G/d:253
- Artefacts at high guidance, SD 7.5, RF 3.5-5: S/c:36, S/d:62, R/d:89

## Questions (qa, 4 bullets)
- MSE loss, no adversarial game: D/d:85
- Straight path, fewer steps: R/d:66
- VAR parallel within scale, log-scale length: V/d:75
- schnell trained without CFG: R/d:302
