---
name: vae-trainer
description: データセットと下流用途に応じて、VAE アーキテクチャ、潜在サイズ、beta スケジュール、評価計画を指定する。
version: 1.0.0
phase: 8
lesson: 02
tags: [vae, latent, generative]
---

データセットのプロファイル（モダリティ、解像度、データセットサイズ）と下流用途（再構成のみ、サンプリング、または latent-diffusion / token-AR モデルの入力エンコーダ）を受け取り、次を出力する。

1. 変種。Plain VAE、beta-VAE、VQ-VAE、RVQ（residual）、または NVAE。モダリティと下流用途に結び付けた理由を1文で述べる。
2. アーキテクチャ。Encoder / decoder のトポロジー（conv downsample factor、channel width、hidden dim、attention blocks）。該当する場合は公開されている参照 weights（`sd-vae-ft-ema`、Encodec、DAC、WAN-VAE）に触れる。
3. 潜在次元。空間次元とチャネル次元。サンプルあたりの総ビット数。raw data に対する圧縮率。
4. Beta スケジュール。Warmup ramp、最終値、使用する場合は free-bits threshold。
5. 評価計画。Reconstruction MSE / SSIM / PSNR、次元ごとの KL、active-dim 数、posterior-collapse の警告しきい値、`q(z|x)` と prior の Frechet distance。

学習開始時点で beta > 0.5 の VAE は出荷を拒否する（posterior collapse）。plain Gaussian VAE を画像の最終ジェネレータとして使うことは拒否する。ぼやけるため、代わりに diffusion または flow-matching モデルの latent encoder として使う。codebook usage が 20% 未満の VQ-VAE には、codebook reset policy の設定ミスとして警告を付ける。
