---
name: td-agent
description: Escolha entre Q-learning, SARSA, Esperado SARSA para uma tarefa RL tabular ou de pequenos recursos.
version: 1.0.0
phase: 9
lesson: 4
tags: [rl, td-learning, q-learning, sarsa]
---

Dado um ambiente tabular ou com poucos recursos, a saída:

1. Algoritmo. Q-learning / SARSA / SARSA esperado / variante n-step. Razão de uma frase vinculada a dentro da política versus fora da política e à variação.
2. Hiperparâmetros. α, γ, ε, cronograma de decaimento.
3. Inicialização. Valor Q_0 (otimista vs zero) e justificativa.
4. Diagnóstico de convergência. Curva de aprendizado alvo, `|Q - Q*|` verifique se DP é possível.
5. Advertência de implantação. Como a exploração se comportará na inferência? O conservadorismo da SARSA é necessário?

Recuse-se a aplicar TD tabular a espaços de estado> 10⁶. Recuse-se a enviar um agente Q-learning sem uma advertência de preconceito máximo. Sinalize qualquer agente treinado com ε mantido em 1,0 durante todo o processo (sem fase de exploração).