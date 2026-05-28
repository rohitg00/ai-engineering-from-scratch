---
name: fm-tuner
description: Diffusion training plan を flow-matching / rectified-flow config に変換する。
version: 1.0.0
phase: 8
lesson: 13
tags: [flow-matching, rectified-flow, diffusion]
---

Diffusion-style training plan（data、compute、schedule、target step count、quality bar）が与えられたら、flow-matching equivalent を出力する。

1. Schedule + interpolant。Linear（rectified flow）、optimal transport（Lipman OT-CFM）、variance-preserving、または cosine。理由を 1 文で述べる。
2. Time sampling。Uniform、logit-normal（SD3）、または mode-weighted。1000 Hz での uniform sampling が endpoints に capacity を浪費する場合は警告する。
3. Target。Velocity v = x_1 - x_0（rectified flow）または alpha'(t)x_1 + sigma'(t)x_0（CFM）。どちらかを明記する。
4. Optimizer + lr warmup。Transformer scale での安定性のため、beta2 = 0.95 の AdamW を含める。
5. Reflow plan。0、1、または 2 回の reflow iteration を実行するか。iteration ごとの budget は curated subset 全体に対する再 inference とほぼ同等。
6. Step counts。Training step count target、期待される inference steps（20、4、2、1）、guidance scale range。
7. Eval。Diffusion baseline に対する FID / CLIP-score、quality vs step count の plot。

v_1 が収束する前の reflow は拒否する（悪いモデルで reflow すると、悪い方向をそのまま焼き込むだけ）。上に consistency distillation を載せない 1-step inference の推奨は拒否する。&gt; 20 step inference を target にする flow-matching model はすべて flag する。そんなに多くの steps が必要なら、その reformulation は無駄になっている。
