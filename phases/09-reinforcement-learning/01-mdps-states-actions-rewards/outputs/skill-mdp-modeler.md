---
name: mdp-modeler
description: タスク説明を受け取り、Markov Decision Process の仕様を作成し、訓練前に定式化リスクを指摘する。
version: 1.0.0
phase: 9
lesson: 1
tags: [rl, mdp, modeling]
---

タスク（制御 / ゲーム / レコメンデーション / LLM fine-tuning）が与えられたら、次を出力する。

1. State。正確な特徴ベクトルまたはテンソル仕様。Markov 性を正当化する。
2. Action。離散集合または連続範囲。次元数。
3. Transition。決定的、既知モデル付き確率的、または sample-only。
4. Reward。関数とソース。疎か shaped か。終端報酬かステップごとか。
5. Discount。値とホライズンの根拠。

状態が非 Markov 的で、frame-stacking または recurrent state への明示的な言及がない MDP は出荷を拒否する。目標成果に基づいて定義されていない報酬は拒否する。無限ホライズンのタスクで `γ ≥ 1.0` が使われている場合は指摘する。報酬範囲が典型的なステップ報酬の100倍を超える場合は、勾配爆発の可能性が高いソースとして指摘する。
