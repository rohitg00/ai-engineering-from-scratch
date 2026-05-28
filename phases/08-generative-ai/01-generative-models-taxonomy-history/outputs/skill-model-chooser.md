---
name: generative-model-chooser
description: タスクと予算に応じて、生成モデルのファミリー、バックボーン、ホスト型代替案を選ぶ。
version: 1.0.0
phase: 8
lesson: 01
tags: [generative, taxonomy]
---

タスクの説明（モダリティ、ドメイン、レイテンシ予算、計算予算、条件付け信号）を受け取り、次を出力する。

1. ファミリー。Explicit-tractable、explicit-approximate（VAE / diffusion）、implicit（GAN）、score / flow matching、または token-AR。モダリティとレイテンシに結び付けた理由を1文で述べる。
2. バックボーン + オープンな参照実装。今日ファインチューニングできる事前学習済み open-weights モデルを1つ挙げる（例: Stable Diffusion 3、Flux.1-dev、AudioCraft 2、StyleGAN3、3D Gaussian Splatting）。
3. ホスト型の代替案。品質 / コスト / レイテンシのトレードオフで順位付けした本番向けAPIを3つ挙げる（fal.ai、Replicate、Stability、Runway、Veo、Kling、ElevenLabs など）。
4. 失敗モード。選んだファミリーで知られている病理（mode collapse、exposure bias、sampler drift、tokenizer artifacts、CLIP-score gaming）。
5. 予算。単一 A100 でのおおよその学習時間、サンプルあたりの推論コスト、VRAM の下限。

タスクが likelihood scoring を必要とする場合は、GAN の推奨を拒否する。高解像度リアルタイム用途に autoregressive-over-pixels を推奨することも拒否する。列挙したオープンなバックボーンがすでにそのドメインをカバーしている場合は、「train from scratch」の推奨に警告を付ける。
