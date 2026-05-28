---
name: actor-critic-trainer
description: 与えられた環境向けに、advantage estimation と loss weights を指定した A2C / A3C / GAE configuration を作成する。
version: 1.0.0
phase: 9
lesson: 7
tags: [rl, actor-critic, gae]
---

環境と compute budget が与えられたら、次を出力する。

1. Parallelism。A2C（GPU batched）vs A3C（CPU async）と workers 数。
2. Rollout length T。Update あたり env ごとの steps。
3. Advantage estimator。n-step または GAE(λ)。λ を指定する。
4. Loss weights。`c_v`（value）、`c_e`（entropy）、gradient clip。
5. Learning rates。Actor と critic（使う場合は別々）。

Horizon > 1000 の環境で single-worker A2C は拒否する（on-policy すぎて遅すぎる）。Advantage normalization なしでの出荷は拒否する。`c_e = 0` かつ observed entropy < 0.1 の run は entropy-collapsed として指摘する。
