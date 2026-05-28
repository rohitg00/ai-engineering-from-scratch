---
name: mc-evaluator
description: Monte Carlo rollouts で方策を評価し、可能なら DP 比較付きの収束レポートを作成する。
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

環境（episodic で reset+step API を持つ）と方策が与えられたら、次を出力する。

1. Method。First-visit MC か every-visit MC か。理由。
2. Episode budget。目標本数、分散診断、期待される標準誤差。
3. Exploration plan。必要なら `ε` schedule、または exploring starts。
4. Gold-standard comparison。表形式なら DP-optimal V*、そうでなければ Q-learning / PPO baseline からの bound。
5. Termination check。Max-step cap、timeouts、非終端軌跡の扱い。

有限ホライズン上限なしに、非 episodic タスクで MC を実行することを拒否する。表形式タスクで、状態あたり100エピソード未満から `V^π` 推定を報告することを拒否する。ゼロ分散の行動を持つ方策は探索リスクとして指摘する。
