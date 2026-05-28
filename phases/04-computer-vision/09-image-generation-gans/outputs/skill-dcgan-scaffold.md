---
name: skill-dcgan-scaffold
description: z_dim、image_size、num_channels から、training loop と sample saver を含む完全な DCGAN scaffold を書く
version: 1.0.0
phase: 4
lesson: 9
tags: [computer-vision, gan, dcgan, scaffolding]
---

# DCGAN Scaffold

3 つのパラメータを受け取り、対象の画像解像度に合わせて正しくサイズ調整されたアーキテクチャを持つ、実行可能な DCGAN プロジェクトのひな形を出力します。

## 使う場面

- 小さなデータセットで新しい生成実験を始める。
- 動く最小例で DCGAN の基礎を教える。
- conditional GAN をプロトタイプする（label injection は同じ scaffold 内で行う）。

## 入力

- `image_size`: 32、64、128 のいずれか（2 のべき乗でなければならない）。
- `num_channels`: 1（grayscale）または 3（RGB）。
- `z_dim`: 通常は 64 または 128。
- `with_spectral_norm`: yes | no。デフォルトは yes。

## アーキテクチャのサイズ決定

G の transposed conv blocks と D の strided conv blocks の数は `image_size` に依存します。

| image_size | G blocks | D blocks |
|------------|----------|----------|
| 32         | 4        | 4        |
| 64         | 5        | 5        |
| 128        | 6        | 6        |

ブロックが 1 つ増えるごとに、空間次元は G では 2 倍、D では 1/2 になります。特徴数は 32 から始まり、`feat_base * 2^block_index` でスケールします。

## 出力ファイル

- `model.py` — Generator + Discriminator classes
- `train.py` — training loop、loss、optimiser setup
- `sample.py` — sample grid saver
- `config.json` — hyperparameters
- `README.md` — 10 行の quickstart

## レポート

```
[scaffold]
  image_size:       <int>
  num_channels:     <int>
  z_dim:            <int>
  spectral_norm:    yes | no

[arch]
  G blocks:         <N>, channels: [list]
  D blocks:         <N>, channels: [list]
  G params (est):   <N>
  D params (est):   <N>

[training defaults]
  optimizer:   Adam(lr=2e-4, betas=(0.5, 0.999))
  batch_size:  64
  epochs:      50
  sample_every: 1 epoch

[files written]
  - model.py
  - train.py
  - sample.py
  - config.json
  - README.md
```

## ルール

- G の出力には必ず `nn.Tanh()` を使い、学習中のデータを [-1, 1] にスケールする。
- D では必ず `LeakyReLU(0.2)` を使う。
- `with_spectral_norm == yes` の場合、D のすべての conv を `spectral_norm()` でラップし、D から BatchNorm を削除する。G の BatchNorm は残す。
- image_size > 128 の scaffold は絶対に出力しない。DCGAN はそれ以上では不安定になるため、StyleGAN または diffusion model を案内する。
