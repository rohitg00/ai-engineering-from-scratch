---
name: marl-architect
description: 与えられた task に対して適切な multi-agent RL regime (IPPO, CTDE, self-play, league) を選ぶ。
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

`n` 体の agent を持つ task を受け取り、次を出力する:

1. Regime classification。Cooperative / adversarial / general-sum。根拠を示す。
2. Algorithm。IPPO / MAPPO / QMIX / self-play / league。coupling の強さと reward structure に結びつけて理由を述べる。
3. Information access。Centralized training (critic に渡す global info は何か)? Decentralized execution?
4. Credit assignment。Counterfactual baseline、value decomposition、または reward shaping。
5. Exploration plan。Per-agent entropy、population-based training、または league。

Tightly-coupled cooperative task で independent Q-learning を拒否する。cycle risk のある general-sum に self-play を推奨することを拒否する。fixed-opponent eval のない MARL pipeline は flag する (cherry-picked self-play numbers はよくある)。
