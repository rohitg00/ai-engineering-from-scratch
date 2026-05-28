---
name: var-tokenizer-designer
description: Next-scale visual autoregressive image generation 用の multi-scale residual VQ tokenizer を設計する。
version: 1.0.0
phase: 8
lesson: 19
tags: [var, next-scale-prediction, vq-vae, residual-vq, image-generation, tokenizer]
---

Image target（resolution、channels、color vs grayscale、dataset size、downstream LM compute budget、target FID）が与えられたら、次を出力する。

1. Scale schedule。1x1 から (H/p) x (W/p) までの K resolution levels を列挙する。Default は 256x256 で 10 scales、512x512 で 14。LM の effective sequence length（scale areas の合計）と per-pass parallel-within-scale budget に対して K を正当化する。
2. Codebook。すべての scales で共有する単一 codebook size V（典型値 4096 / 8192 / 16384）。Dataset size と decoder capacity から V を選ぶ。Calibration batch で codebook usage が 50 percent を超えることを確認し、下回るなら V を縮小する。
3. Residual sharing。Scales 1..K が summed upsampled embeddings（residual VQ）によって latent を一緒に再構成することを確認する。Patch size p と VAE backbone（VQGAN-style discriminator on / off、perceptual loss weight）を述べる。
4. Decoder。Summed latent を pixels に戻す VAE decoder。VQGAN decoder、VAR-paper decoder、または軽量な MAGVIT-style decoder から選ぶ。FID target と decoder VRAM に照らして正当化する。
5. Position embedding。(scale_index, row, col) triple を確認し、scale ごとの learned embedding と scale 内の 2D sin-cos を使う。Flat 1D positions は拒否する。LM が適切な conditional を適用するには scale label が必要。

VAR 用の non-residual multi-scale tokenizer は拒否する。Summed residuals がなければ next-scale conditional は ill-defined になり、LM は論文が証明する objective とは別のものを最適化する。Separate per-scale codebooks は、V がより小さい scale の pixel count に合わせて calibration され、codebook collapse が緩和されていない限り拒否する。K x average-scale-area が LM の max sequence length から text conditioning 用の headroom を引いた値を超える場合、next-scale prediction 自体を拒否する。

Example input: "ImageNet class-conditional 256x256, dataset 1.2M, LM budget 1.5B params, target FID under 5.0."

Example output:
- Scale schedule: K=10, sizes 1, 2, 3, 4, 5, 6, 8, 10, 13, 16. Total tokens 671.
- Codebook: shared, V=4096. ImageNet at 256 では 70-80 percent usage を期待。
- Residual sharing: confirmed; p=16, VQGAN backbone with perceptual + adversarial losses, residual sum reconstructs f.
- Decoder: VQGAN decoder, 4 upsampling blocks, no extra refiner.
- Position embedding: (scale, row, col) triple, learned scale token + 2D sin-cos within scale.
