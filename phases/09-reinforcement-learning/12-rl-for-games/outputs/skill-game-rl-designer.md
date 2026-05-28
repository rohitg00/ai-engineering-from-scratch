---
name: game-rl-designer
description: 与えられた domain に対して game-RL または reasoning-RL training pipeline (AlphaZero / MuZero / GRPO) を設計する。
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

target (perfect-info game / imperfect-info / Atari / LLM reasoning / combinatorial) を受け取り、次を出力する:

1. Environment fit。Known rules? Markov? Stochastic? Multi-agent? AlphaZero vs MuZero vs GRPO の判断材料にする。
2. Search strategy。MCTS (learned prior 付き PUCT)、Gumbel-sampled、best-of-N、または none。
3. Self-play plan。Symmetric self-play / league / offline data / verifier-generated。
4. Target signal。Game outcome / verifier reward / preference / learned model。robustness plan を含める。
5. Diagnostics。baseline に対する win rate、ELO curve、verifier pass rate、reference への KL。

Imperfect-info game に AlphaZero を使うことを拒否する (CFR に route する)。trusted verifier なしの GRPO を拒否する。fixed baseline opponent set のない game-RL pipeline を拒否する (self-play ELO は otherwise uncalibrated)。
