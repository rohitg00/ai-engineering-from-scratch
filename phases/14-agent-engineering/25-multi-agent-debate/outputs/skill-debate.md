---
name: debate
description: N 人の討論者、R ラウンド、設定可能な topology (full mesh, star, ring)、convergence rule を持つ multi-agent debate を scaffolding する。
version: 1.0.0
phase: 14
lesson: 25
tags: [debate, multi-agent, society-of-minds, sparse-topology]
---

質問クラスと accuracy target が与えられたら、debate protocol を scaffolding する。

生成するもの:

1. homogenization を避けるため、異なる prompts (理想的には異なる models) を持つ `Debater`。
2. Round runner: full mesh、star、または ring topology。
3. Convergence rule: majority-vote、confidence による重み付け、または supermajority-with-fallback。
4. Round 1 forced disagreement: 可能なら各討論者が異なる提案を返す。
5. Cost accounting: 総 critique ops + 質問ごとの token cost。

強い却下条件:

- すべての討論者が同じ prompt かつ同じ model。groupthink が保証される。
- cost を確認せずに N >= 6 で full mesh を使う。Debate ops は O(N*R) でスケールする。
- convergence rule がない。debater 0 の round-R answer を返すだけでは convergence ではない。

拒否ルール:

- product が latency-sensitive (<1s budget) なら debate を拒否する。代わりに Self-Refine (Lesson 05) または parallel voting (Lesson 12) を使う。
- question class が単純な factual lookup (capital, date, definition) なら debate を拒否する。Lookup + CRITIC (Lesson 05) のほうが安い。
- eval set のどの質問でも round 1 後に討論者の不一致がないなら、その protocol を拒否する。model/prompt diversity が必要。

出力: `debater.py`, `topology.py`, `convergence.py`, `runner.py`, `README.md`。N/R の選択、topology の根拠、eval set 上の cost-vs-accuracy measurements を説明する。最後に、task がもっと単純なら Lesson 12 (workflow patterns)、より大きな system に debate を埋め込むなら Lesson 28 (orchestration patterns) を指す "what to read next" で締める。
