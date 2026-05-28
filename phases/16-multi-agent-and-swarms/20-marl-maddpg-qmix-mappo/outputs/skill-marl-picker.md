---
name: marl-picker
description: 指定された multi-agent task に対し、MARL algorithm（MADDPG、QMIX、MAPPO、IQL、または extensions）を選ぶ。cooperative vs competitive、action-space type、heterogeneity、reward structure、scale を考慮する。
version: 1.0.0
phase: 16
lesson: 20
tags: [multi-agent, MARL, MADDPG, QMIX, MAPPO, CTDE]
---

multi-agent task description が与えられたら、MARL algorithm を選ぶ。

作成するもの:

1. **Task taxonomy。** Fully cooperative（shared reward）、fully competitive（zero-sum）、mixed、general-sum。agent 数。homogeneous vs heterogeneous。
2. **Observability。** Full（全 agent が global state を見る）、partial（各 agent は own observation だけを見る）、または communication-enabled。
3. **Action space。** Discrete（Atari-like、SMAC）または continuous（particle world、MuJoCo）。algorithm choice に影響する。
4. **Reward structure。** Dense（per-step shaped）vs sparse（terminal only）。Dense は MAPPO を実用的にし、sparse は credit assignment の支援（QMIX の value decomposition）を必要とする。
5. **Algorithm recommendation。** Yu et al. 2022 に従い MAPPO を baseline として始める。切り替え条件:
   - cooperative + homogeneous + sparse-reward credit assignment が強く必要 → QMIX
   - mixed（cooperative + competitive）+ continuous actions → MADDPG
   - monotonicity constraint が制約的すぎる → extensions（QTRAN、QPLEX、FACMAC）
6. **Training infrastructure。** 十分な interaction data、compute budget、reward shaping expertise、stability budget（experiment ごとに 5-10 seeds）があるか。なければ LLM agents には prompt-level policies を推奨する。
7. **Deployment contract。** CTDE: deploy time には各 agent は local observation だけを見る。この contract を明示し、runtime code がそれを守るようにする。

Hard rejects:

- 初回 run で MAPPO 以外の baseline を選ぶこと。MAPPO は 2026 baseline なので、そこから始める。
- mixed cooperative-competitive tasks に QMIX を使うこと。value decomposition は monotone aggregation を仮定する。
- interaction data や reward signal がない LLM-agent system に MARL training を推奨すること。data が揃うまでは prompt-level policies のほうが良い。
- per-agent observations and actions を logging せずに training すること。debugging が不可能になる。

Refusal rules:

- task に interaction data が約 1000 episodes 未満しかない場合は、prompt-level policies または supervised fine-tuning を推奨する。
- task が non-Markovian（memory が必要）なのに recommendation に recurrent critics が含まれない場合、その gap を flag する。
- task が general-sum competitive（multiple equilibria）なら、MARL だけでは equilibrium を選べない。mechanism design または equilibrium selection を推奨する。

Output: 1 ページの brief。1 文の recommendation（「MAPPO baseline with centralized value function; per-agent discrete actor; CTDE at deploy; 5 seeds per experiment.」）から始め、その後に上記 7 sections を続ける。最後に training-to-deployment pipeline（data collection、training、evaluation、rollout）を書く。
