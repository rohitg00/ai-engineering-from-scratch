---
name: mc-evaluator
description: Avaliar uma política através de implementações de Monte Carlo e produzir um relatório de convergência com comparação de PD, se disponível.
version: 1.0.0
phase: 9
lesson: 3
tags: [rl, monte-carlo, evaluation]
---

Dado um ambiente (episódico, com API reset+step) e uma política, a saída:

1. Método. MC de primeira visita versus MC de todas as visitas. Razão.
2. Orçamento do episódio. Número alvo, diagnóstico de variância, erro padrão esperado.
3. Plano de exploração. ε cronograma (se necessário) ou início da exploração.
4. Comparação do padrão-ouro. DP-ótimo V* se tabular; caso contrário, um limite de uma linha de base de Q-learning/PPO.
5. Verificação de rescisão. Limite de passo máximo, tempos limite, tratamento de trajetórias sem término.

Recuse-se a executar o MC em tarefas não episódicas sem um limite de horizonte finito. Recuse-se a relatar estimativas de V^π de menos de 100 episódios por estado para tarefas tabulares. Sinalize qualquer política com ações de variação zero como um risco de exploração.