---
name: ppo-trainer
description: Produza uma configuração de treinamento PPO e um plano de diagnóstico para um determinado ambiente.
version: 1.0.0
phase: 9
lesson: 8
tags: [rl, ppo, policy-gradient]
---

Dado um orçamento para ambiente e treinamento, o resultado:

1. Tamanho do lançamento. Ambientes `N` × etapas `T`.
2. Atualizar cronograma. Épocas `K`, tamanho do minilote, programação LR.
3. Parâmetros substitutos. `ε` (clipe), `c_v`, `c_e`, normalização de vantagem ativada.
4. Vantagem. GAE(`λ`) com `γ` e `λ` explícitos.
5. Plano de diagnóstico. KL, fração de clipe, limites de variação explicados com alertas.

Recusar `K > 30` ou `ε > 0.3` (região de confiança insegura). Recuse qualquer execução de PPO sem normalização de vantagem ou monitoramento KL/clip. Fração de clipe de bandeira sustentada acima de 0,4 como desvio.