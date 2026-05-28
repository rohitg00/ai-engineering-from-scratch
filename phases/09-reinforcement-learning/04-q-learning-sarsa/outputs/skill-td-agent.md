---
name: td-agent
description: 表形式または小さな特徴量の RL タスクについて、Q-learning、SARSA、Expected SARSA から選ぶ。
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

表形式または小さな特徴量の環境が与えられたら、次を出力する。

1. Algorithm。Q-learning / SARSA / Expected SARSA / n-step variant。On-policy vs off-policy と分散に結びつけた1文の理由。
2. Hyperparameters。`α`、`γ`、`ε`、decay schedule。
3. Initialization。`Q_0` の値（optimistic か zero か）と根拠。
4. Convergence diagnostic。目標 learning curve、DP が可能なら `|Q - Q*|` チェック。
5. Deployment caveat。推論時に探索はどう振る舞うか。SARSA の保守性は必要か。

状態空間が `10⁶` を超える場合は tabular TD の適用を拒否する。max-bias caveat なしに Q-learning agent を出荷することを拒否する。`ε` をずっと 1.0 に保ったまま訓練した agent（exploitation phase なし）は指摘する。
