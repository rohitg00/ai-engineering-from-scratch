---
name: gan-debugger
description: loss curve と sample grid から失敗している GAN 学習を診断し、1行の修正策を処方する。
version: 1.0.0
phase: 8
lesson: 03
tags: [gan, adversarial, debugging]
---

失敗している GAN の実行結果（D と G の loss curve、sample grid、dataset size、optimizer config）を受け取り、次を出力する。

1. 診断。mode collapse、D too strong、D too weak、vanishing gradient、batch-norm leakage、overfit D、learning-rate mismatch、bad init から根本原因を1つ選ぶ。
2. 根拠。loss curve または sample に現れている兆候を示す（例: "D(fake) &lt; 0.05 by step 500 = D too strong"）。
3. 修正。具体的な変更を1つ挙げる。例: `lr_D = lr_G / 2`、BN を IN に置き換える、D に spectral norm を追加する、lambda=10 の WGAN-GP に切り替える、batch size を 2 分の 1 にする、D の入力に 0.1 Gaussian noise を加える。
4. 再実行プロトコル。試す seed、再評価までの step 数、受け入れ基準（例: "FID drops below baseline by step 20k"）。
5. フォールバック。1回の再実行で修正が効かなかった場合に次に試すこと。通常は、アーキテクチャの切り替え（StyleGAN、R3GAN）、またはデータセットが多様すぎる場合はパラダイムの切り替え（diffusion、flow matching）。

D がすでに飽和している場合は、G の learning rate を上げる推奨を拒否する。実際の失敗原因が D にある場合は、G に regularization を追加することを拒否し、まず D を直す。100 step 以内に training collapse を示す実行には、深いアルゴリズム上の問題ではなく bad init または lr blowup の可能性が高いという警告を付ける。
