---
name: game-rl-designer
description: Projete um pipeline de treinamento de RL de jogo ou RL de raciocínio (AlphaZero/MuZero/GRPO) para um determinado domínio.
version: 1.0.0
phase: 9
lesson: 12
tags: [rl, alphazero, muzero, grpo, self-play]
---

Given a target (perfect-info game / imperfect-info / Atari / LLM reasoning / combinatorial), output:

1. Ajuste ao ambiente. Regras conhecidas? Markov? Estocástico? Multiagente? Informa AlphaZero vs MuZero vs GRPO.
2. Estratégia de busca. MCTS (PUCT with learned prior), Gumbel-sampled, best-of-N, or none.
3. Plano de autojogo. Symmetric self-play / league / offline data / verifier-generated.
4. Sinal alvo. Game outcome / verifier reward / preference / learned model. Incluir plano de robustez.
5. Diagnóstico. Win rate vs baseline, ELO curve, verifier pass rate, KL to reference.

Refuse AlphaZero on imperfect-info games (route to CFR). Recuse o GRPO sem um verificador confiável. Refuse any game-RL pipeline without a fixed baseline opponent set (self-play ELO is uncalibrated otherwise).