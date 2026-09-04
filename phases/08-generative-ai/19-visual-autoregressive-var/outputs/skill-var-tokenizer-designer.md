---
name: var-tokenizer-designer
description: Design a multi-scale residual VQ tokenizer for next-scale visual autoregressive image generation.
version: 1.0.0
phase: 8
lesson: 19
tags: [var, next-scale-prediction, vq-vae, residual-vq, image-generation, tokenizer]
---

Given the image target (resolution, channels, color vs grayscale, dataset size, downstream LM compute budget, target FID), output:

1. Scale schedule. List the K resolution levels from 1x1 up to (H/p) x (W/p). Default 10 scales for 256x256, 14 for 512x512. Justify K against the LM's effective sequence length (sum of scale areas) and the per-pass parallel-within-scale budget.
2. Codebook. Single shared codebook size V across all scales (typical 4096 / 8192 / 16384). Pick V from dataset size and decoder capacity. Confirm codebook usage stays above 50 percent on a calibration batch or shrink V.
3. Residual sharing. Confirm scales 1..K together reconstruct the latent via summed upsampled embeddings (residual VQ). State the patch size p and the VAE backbone (VQGAN-style discriminator on / off, perceptual loss weight).
4. Decoder. VAE decoder mapping summed latent back to pixels. Pick from VQGAN decoder, VAR-paper decoder, or a lighter MAGVIT-style decoder. Justify against FID target and decoder VRAM.
5. Position embedding. Confirm (scale_index, row, col) triple with a learned embedding per scale and a 2D sin-cos within scale. Reject flat 1D positions; the LM needs the scale label to apply the right conditional.

Refuse a non-residual multi-scale tokenizer for VAR. Without summed residuals the next-scale conditional becomes ill-defined and the LM optimizes a different objective than the paper proves. Refuse separate per-scale codebooks unless V is calibrated to the smaller scale's pixel count and codebook collapse is mitigated. Refuse next-scale prediction at all when K x average-scale-area exceeds the LM's max sequence length minus headroom for text conditioning.

Example input: "ImageNet class-conditional 256x256, dataset 1.2M, LM budget 1.5B params, target FID under 5.0."

Example output:
- Scale schedule: K=10, sizes 1, 2, 3, 4, 5, 6, 8, 10, 13, 16. Total tokens 671.
- Codebook: shared, V=4096. Expect 70-80 percent usage on ImageNet at 256.
- Residual sharing: confirmed; p=16, VQGAN backbone with perceptual + adversarial losses, residual sum reconstructs f.
- Decoder: VQGAN decoder, 4 upsampling blocks, no extra refiner.
- Position embedding: (scale, row, col) triple, learned scale token + 2D sin-cos within scale.
