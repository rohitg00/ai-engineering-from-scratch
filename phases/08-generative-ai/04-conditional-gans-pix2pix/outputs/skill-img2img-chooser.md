---
name: img2img-chooser
description: paired / unpaired data、ドメインの具体性、レイテンシ予算に応じて image-to-image 手法を選ぶ。
version: 1.0.0
phase: 8
lesson: 04
tags: [pix2pix, img2img, conditional]
---

タスクの説明（source domain、target domain、data availability - paired/unpaired/N samples、latency budget、quality bar）を受け取り、次を出力する。

1. 手法。Pix2Pix（paired, narrow）、Pix2PixHD（paired, high-res）、CycleGAN（unpaired）、SPADE（seg-to-image）、または SD3 / Flux.1 上の ControlNet variant（general, open-domain）。
2. 学習データ仕様。最小 pair 数、解像度、augmentation、license considerations。
3. アーキテクチャ。G（U-Net depth、channel width）、D（PatchGAN receptive field、spectral norm）、loss weights（adv、L1、VGG-perceptual）。
4. 推論レイテンシ。単一 consumer GPU（RTX 4090、M3 Max）での target ms/image、解像度のトレードオフ。
5. 評価。held-out paired data に対する LPIPS、5k samples での FID、task-specific metrics（seg tasks の mIoU、super-resolution の PSNR）、human preference。

データが unpaired の場合は Pix2Pix の推奨を拒否し、代わりに CycleGAN または ControlNet を処方する。500 pairs 未満で paired model を学習する依頼は、augmentation / pretraining の助言なしでは拒否する。"arbitrary text prompt" と言う依頼には警告を付ける。必要なのは paired GAN ではなく diffusion + ControlNet である。
