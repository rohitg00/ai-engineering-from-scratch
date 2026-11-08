# Evidence: cheatsheets/gans.md

Abbreviations: T = phases/08-generative-ai/01-generative-models-taxonomy-history, G3 = phases/08-generative-ai/03-gans-generator-discriminator, P2P = phases/08-generative-ai/04-conditional-gans-pix2pix, SG = phases/08-generative-ai/05-stylegan, CV9 = phases/04-computer-vision/09-image-generation-gans. d = docs/en.md, c = code/main.py.

## StyleGAN generator (architecture, 7 nodes, 6 edges)
- z, N(0, I) with 512 dims: SG/d:22
- Mapping network, 8-layer MLP: SG/d:14, 22
- w in W, roughly disentangled: SG/d:124
- Learned constant 4×4×512: SG/d:14, 24
- Synthesis block upsample, conv, AdaIN, noise: SG/d:24
- Image, resolutions 4 up to 1024, doubling: SG/d:24
- Per-layer noise with a learned per-channel factor: SG/d:34
- AdaIN at every resolution: SG/d:3, 14

## One training step (flow, 7 steps)
1. Real batch and z ~ N(0, I): CV9/d:31, G3/d:28
2. D scores real against 1 and G(z).detach() against 0: CV9/c:58-61, CV9/d:186-188
3. Fresh fakes, D(G(z)) against 1: CV9/c:66-67, G3/d:88
4. One D step, one G step: G3/d:37, CV9/d:174
5. Probe every 100 steps, warn below 50 per mode: G3/c:174-180
6. Look at 64 samples every epoch: CV9/d:102
7. p_G = p_data, D outputs 0.5 everywhere: CV9/d:54

## Losses and formulas (concepts, 8)
- Minimax: CV9/d:49
- D loss is BCE on real=1, fake=0: G3/d:34
- Non-saturating G loss -log D(G(z)): G3/d:35, CV9/d:63
- WGAN loss_D and loss_G: G3/d:133
- Pix2Pix loss_G with lambda L1: P2P/d:32
- Cycle consistency F(G(x)) ≈ x, G(F(y)) ≈ y: P2P/d:41
- AdaIN formula: SG/d:29
- Truncation w' = ŵ + ψ(w − ŵ), ψ < 1 trades diversity for quality: SG/d:36

## DCGAN train_step (annotated-code, 12 lines)
- opt_d.zero_grad, d_real, d_fake with detach: CV9/c:57-59
- loss_d as two BCE-with-logits terms: CV9/c:60-61
- backward and step for D: CV9/c:62-63
- G step with D(G(z)) and ones_like: CV9/c:65-69
- Sigmoid only in the loss: CV9/d:170
- detach stops gradients into G: CV9/d:202

## Tasks in code (task-table, 8)
- Generator(z_dim=64, img_channels=3, feat=32): CV9/c:105
- spectral_norm(c): CV9/c:37
- Adam(lr=2e-4, betas=(0.5, 0.999)): CV9/d:239
- sample(G, n=8, z_dim=z_dim, device=device): CV9/c:123
- sum(p.numel() for p in G.parameters()): CV9/c:110
- inp = z + one_hot(c, num_classes): P2P/c:49
- w = mapping(z, mapping_net): SG/c:90
- w_bar[i] + psi * (w_test[i] - w_bar[i]): SG/c:110

## Four GANs side by side (comparison, 5 rows)
- Input: noise z (CV9/d:42), image x with dropout as z (P2P/d:20), domain X (P2P/d:41), z mapped to w (SG/d:14)
- Generator: transposed convs and tanh (CV9/d:31, 76), U-Net with skips (P2P/d:24), G: X to Y and F: Y to X (P2P/d:41), constant plus AdaIN (SG/d:24)
- Extra loss: lambda L1 (P2P/d:32, 37), cycle consistency (P2P/d:41), path-length regularization in StyleGAN2 (SG/d:43)
- Data: paired (P2P/d:14), unpaired (P2P/d:41), narrow domain faces (SG/d:48, 100)
- Use for: 32x32 images (CV9/d:13), sketch to photo (P2P/d:100), horses to zebras, summer to winter (P2P/d:41), faces and editing (SG/d:48, 101)

## One pass against many steps (comparison, 2 rows)
- Steps 1, 20, 1-4, 20-30: P2P/d:139-142
- Latency at 512² on a single L4: ~30 ms, ~1.2 s, ~0.15-0.35 s, ~3-5 s: P2P/d:137-142

## Defaults (defaults, 8)
- lr 2e-4: CV9/c:107-108, CV9/d:239
- betas (0.5, 0.999), low beta1: CV9/d:239
- z_dim 64: CV9/c:100, CV9/d:117
- LeakyReLU 0.2 on all D layers: CV9/d:77
- lambda 100, anneal down: P2P/d:37, 89-90
- ~70×70 receptive field per cell: P2P/d:26
- psi 0.7, use 1.0 for diversity: SG/d:36, 93
- TTUR factor 2-4: CV9/d:96, 307

## Troubleshooting (troubleshooting, 8)
- Mode collapse signature and fix: CV9/d:85, 94
- D wins signature and fix: CV9/d:86, 95
- Oscillation signature and fix: CV9/d:87, 96
- D above 95% accuracy, cut D learning rate by 2-5x: G3/d:105
- G memorizes a mode, noise on D inputs or WGAN-GP: G3/d:106
- Condition ignored, condition D early, projection D: P2P/d:88
- L1 weight too high gives blur, anneal: P2P/d:90
- Droplet artifacts, weight demodulation: SG/d:91

## Terms (glossary, 8)
- DCGAN rules: CV9/d:73-77, G3/d:47
- WGAN-GP: G3/d:48
- Spectral norm bounds Lipschitz constant: CV9/d:308
- TTUR two learning rates: CV9/d:307
- cGAN G(z, c), D(x, c): P2P/d:125
- PatchGAN N × N grid: P2P/d:26
- AdaIN: SG/d:125
- FID, lower is better: CV9/d:103

## Use X when (tips, 6)
- GAN for real-time under 10 ms, style transfer, image-to-image: CV9/d:283
- StyleGAN3 for faces with a fixed pose: G3/d:117
- Pix2Pix with thousands of pairs, narrow task, fast inference: P2P/d:109
- CycleGAN without pairs: P2P/d:41
- Freeze mapping network for domain adaptation: SG/d:104
- Diffusion or flow matching for multi-modal, open-ended: G3/d:122

## Questions (qa, 6)
- detach stops gradients into G: CV9/d:202
- D(G(z)) near zero gives vanishing gradients: CV9/d:58
- eval mode uses batch norm running stats: CV9/d:253
- D needs the pair to check consistency: P2P/d:22, 91
- StyleGAN3 under 10 ms at 1024² on a 4090: SG/d:107, 134
- GAN is implicit density, no p(x): T/d:26, 114
