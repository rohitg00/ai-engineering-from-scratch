---
name: policy-gradient-trainer
description: 与えられたタスク向けに REINFORCE / actor-critic / PPO training config を作成し、variance の問題を診断する。
version: 1.0.0
phase: 9
lesson: 6
tags: [rl, policy-gradient, reinforce]
---

環境（discrete / continuous actions、horizon、reward stats）が与えられたら、次を出力する。

1. Policy head。Softmax（discrete）または Gaussian（continuous）と parameter counts。
2. Baseline。None（vanilla）、running mean、学習された `V̂(s)`、または A2C critic。
3. Variance controls。Reward-to-go はデフォルトで有効、return normalization、gradient clip value。
4. Entropy bonus。Coefficient β と decay schedule。
5. Batch size。Update あたりの episodes、on-policy data freshness contract。

Horizon が 500 steps を超える REINFORCE-no-baseline は拒否する。Softmax head を使う continuous-action control は拒否する。`β = 0` かつ observed policy entropy < 0.1 の run は entropy-collapsed として指摘する。
