---
name: dqn-trainer
description: 離散行動 RL タスク向けに DQN training config（buffer、target sync、ε schedule、reward clipping）を作成する。
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

離散行動環境（observation shape、action count、horizon、reward scale）が与えられたら、次を出力する。

1. Network。Architecture（MLP / CNN / Transformer）、feature dim、depth。
2. Replay buffer。Capacity、minibatch size、warmup size。
3. Target network。Sync strategy（hard every C steps または soft τ）。
4. Exploration。ε start / end / schedule length。
5. Loss。Huber vs MSE、gradient clip value、reward clipping rule。
6. Double DQN。無効にする明示的理由がない限りデフォルトで有効。

Target network がない、replay buffer がない、または ε が 1 のまま固定された DQN は出荷を拒否する。連続行動タスクは拒否する（SAC / TD3 へルーティングする）。Reward range が per-step mean の 10× を超える場合は、clipping または scale normalization が必要だと指摘する。
