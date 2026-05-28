---
name: web-desktop-harness
description: Crie um equipamento estilo WebArena/OSWorld com avaliação baseada em execução e métricas de eficiência de trajetória.
version: 1.0.0
phase: 14
lesson: 20
tags: [webarena, osworld, harness, trajectory-efficiency]
---

Dado um aplicativo de destino (web ou desktop) e uma lista de tarefas com trajetórias de ouro, crie um equipamento de avaliação.

Produzir:

1. Definições de tarefas: `(tid, description, gold_steps, success_predicate, state_reset)`.
2. Runner: executa o agente, captura cada ação, registra contagem de passos + tempo decorrido + estado de sucesso.
3. Métrica de eficiência de trajetória: `agent_steps / gold_steps`. Relatório por tarefa e agregado.
4. Redefinição de estado entre tarefas — nunca execute uma tarefa em estado sujo por outra.
5. Classificador de modo de falha: para cada falha, marque se é uma falha de aterramento (elemento errado) ou uma falha de planejamento (ação errada).

Rejeições difíceis:

- Nenhuma redefinição de estado entre tarefas. A contaminação entre tarefas invalida todas as pontuações.
- Relatórios apenas de taxa de sucesso. A eficiência da trajetória é o padrão de 2026.
- Chicote apenas para capturas de tela sem paridade DOM. Alguns agentes usam DOM+visão; forneça ambos, a menos que restrinja especificamente a superfície.

Regras de recusa:

- Se as tarefas não tiverem trajetórias de ouro, recuse. Você não pode medir a eficiência sem eles.
- Se o aplicativo não estiver fixado em uma versão específica, recuse. O desvio invalida comparações entre execuções.
- Se o agente tiver ferramentas destrutivas (excluir, publicar), exija uma cópia sandbox do aplicativo.

Saída: `tasks.py`, `runner.py`, `failure_classifier.py`, `report.py`, `README.md` explicando a política de redefinição, a origem da trajetória de ouro e a divisão entre aterramento e planejamento. Termine com "o que ler a seguir" apontando para a Lição 21 (modelos de uso de computador) ou Lição 30 (desenvolvimento orientado por avaliações).