---
name: ppo-trainer
description: 与えられた環境向けに PPO training config と diagnostic plan を作成する。
version: 1.0.0
phase: 9
lesson: 8
tags: [rl, ppo, policy-gradient]
---

環境と training budget が与えられたら、次を出力する。

1. Rollout size。`N` envs × `T` steps。
2. Update schedule。`K` epochs、minibatch size、LR schedule。
3. Surrogate params。`ε`（clip）、`c_v`、`c_e`、advantage normalization on。
4. Advantage。明示的な `γ` と `λ` を伴う GAE(`λ`)。
5. Diagnostics plan。KL、clip fraction、explained variance thresholds と alerts。

`K > 30` または `ε > 0.3` は拒否する（unsafe trust region）。Advantage normalization または KL/clip monitoring のない PPO run は拒否する。Clip fraction が継続的に 0.4 を超える場合は drift として指摘する。
