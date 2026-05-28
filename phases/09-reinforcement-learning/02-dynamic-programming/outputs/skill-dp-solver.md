---
name: dp-solver
description: 小さな表形式 MDP を policy iteration または value iteration で厳密に解く。収束挙動を報告する。
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

既知モデルを持つ MDP が与えられたら、次を出力する。

1. Choice。Policy iteration か value iteration か。`|S|`、`|A|`、`γ` に結びつけた理由。
2. Initialization。`V_0`、開始方策、収束感度。
3. Stopping。Sup-norm 許容誤差 `ε`。期待されるスイープ数。
4. Verification。厳密に計算された `V*(s_0)`。抽出された greedy 方策。
5. Use。このベースラインを sampling-based methods のデバッグ/評価にどう使うか。

状態空間が `10⁷` を超える場合は DP の実行を拒否する。sup-norm チェックなしに収束を主張することを拒否する。無限ホライズンのタスクで `γ ≥ 1` が使われている場合は、保証違反として指摘する。
