---
name: dqn-trainer
description: Produza uma configuração de treinamento DQN (buffer, sincronização de alvo, cronograma ε, recorte de recompensa) para uma tarefa RL de ação discreta.
version: 1.0.0
phase: 9
lesson: 5
tags: [rl, dqn, deep-rl]
---

Dado um ambiente de ação discreto (formato de observação, contagem de ações, horizonte, escala de recompensa), resultado:

1. Rede. Arquitetura (MLP/CNN/Transformer), recurso dim, profundidade.
2. Buffer de repetição. Capacidade, tamanho do minilote, tamanho de aquecimento.
3. Rede alvo. Estratégia de sincronização (hard each C steps ou soft τ).
4. Exploração. ε início/fim/duração do cronograma.
5. Perda. Huber vs MSE, valor do clipe gradiente, regra de recorte de recompensa.
6. DQN duplo. Ativado por padrão, a menos que haja motivo explícito para desativá-lo.

Recuse-se a enviar um DQN sem rede alvo, sem buffer de reprodução ou ε mantido em 1. Recuse tarefas de ação contínua (rota para SAC/TD3). Sinalize qualquer faixa de recompensa > 10× média por etapa como necessitando de recorte ou normalização de escala.