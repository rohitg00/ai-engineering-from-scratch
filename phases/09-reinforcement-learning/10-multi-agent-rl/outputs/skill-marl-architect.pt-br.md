---
name: marl-architect
description: Escolha o regime RL multiagente certo (IPPO, CTDE, autojogo, liga) para uma determinada tarefa.
version: 1.0.0
phase: 9
lesson: 10
tags: [rl, multi-agent, marl, self-play]
---

Dada uma tarefa com agentes `n`, produza:

1. Classificação do regime. Cooperativa/adversária/soma geral. Justificar.
2. Algoritmo. IPPO / MAPPO / QMIX / autojogo / liga. Razão ligada à rigidez do acoplamento e à estrutura de recompensa.
3. Acesso à informação. Treinamento centralizado (quais informações globais vão para o crítico)? Execução descentralizada?
4. Cessão de crédito. Linha de base contrafactual, decomposição de valor ou modelagem de recompensa.
5. Plano de exploração. Entropia por agente, treinamento baseado na população ou liga.

Recuse o Q-learning independente em tarefas cooperativas fortemente acopladas. Recuse-se a recomendar o auto-jogo para soma geral com riscos de ciclo. Sinalize qualquer pipeline MARL sem uma avaliação de oponente fixo (números de autojogo escolhidos a dedo são comuns).