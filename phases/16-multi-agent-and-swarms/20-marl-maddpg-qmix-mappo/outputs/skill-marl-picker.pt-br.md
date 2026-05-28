---
name: marl-picker
description: Escolha um algoritmo MARL (MADDPG, QMIX, MAPPO, IQL ou extensões) para uma determinada tarefa multiagente. Considere cooperativo versus competitivo, tipo de espaço de ação, heterogeneidade, estrutura de recompensa e escala.
version: 1.0.0
phase: 16
lesson: 20
tags: [multi-agent, MARL, MADDPG, QMIX, MAPPO, CTDE]
---

Dada uma descrição de tarefa multiagente, escolha o algoritmo MARL.

Produzir:

1. **Taxonomia de tarefas.** Totalmente cooperativo (recompensa compartilhada), totalmente competitivo (soma zero), misto, soma geral. Número de agentes. Homogêneo versus heterogêneo.
2. **Observabilidade.** Completa (cada agente vê o estado global), parcial (cada agente vê apenas a própria observação) ou habilitada para comunicação.
3. **Espaço de ação.** Discreto (tipo Atari, SMAC) ou contínuo (mundo de partículas, MuJoCo). Afeta a escolha do algoritmo.
4. **Estrutura de recompensa.** Densa (formato por etapa) vs esparsa (somente terminal). Denso torna o MAPPO prático; esparso precisa de ajuda na atribuição de crédito (decomposição de valor do QMIX).
5. **Recomendação de algoritmo.** Comece com MAPPO como linha de base de acordo com Yu et al. 2022. Mudar para:
   - QMIX quando é necessária atribuição de crédito cooperativo + homogêneo + forte recompensa esparsa
   - MADDPG quando misto (cooperativo + competitivo) + ações contínuas
   - Extensões (QTRAN, QPLEX, FACMAC) quando a restrição de monotonicidade é muito restritiva
6. **Infraestrutura de treinamento.** Você tem: dados de interação suficientes, orçamento de computação, experiência em modelagem de recompensas, orçamento de estabilidade (5 a 10 sementes por experimento)? Caso contrário, recomende políticas de nível de prompt para agentes LLM.
7. **Contrato de implantação.** CTDE: no momento da implantação cada agente vê apenas a observação local. Escreva o contrato explicitamente para que o código de tempo de execução o respeite.

Rejeições difíceis:

- Escolher uma linha de base não MAPPO para uma primeira execução. MAPPO é a linha de base para 2026; comece por aí.
- Utilização do QMIX para tarefas mistas cooperativas-competitivas. A decomposição de valor pressupõe agregação monótona.
- Recomendar treinamento MARL para sistemas de agentes LLM que carecem de dados de interação ou sinal de recompensa. As políticas em nível de prompt terão desempenho superior até que os dados estejam lá.
- Treinamento sem registrar observações e ações por agente. A depuração é impossível.

Regras de recusa:

- Se a tarefa tiver menos de aproximadamente 1.000 episódios de dados de interação, recomende políticas de nível imediato ou ajuste fino supervisionado.
- Se a tarefa for não-Markoviana (requer memória), mas a recomendação não incluir críticas recorrentes, sinalize a lacuna.
- Se a tarefa for competitiva de soma geral (equilíbrios múltiplos), o MARL sozinho não escolhe um; recomendar projeto de mecanismo ou seleção de equilíbrio.

Resultado: um resumo de uma página. Comece com uma recomendação de uma frase ("Linha de base do MAPPO com função de valor centralizada; ator discreto por agente; CTDE na implantação; 5 sementes por experimento") e, em seguida, as sete seções acima. Termine com um pipeline de treinamento até implantação: coleta de dados, treinamento, avaliação, implementação.