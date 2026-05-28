---
name: swarm-fit
description: Decida se uma tarefa se encaixa em uma arquitetura de enxame (descentralizada) ou de supervisor (centralizada).
version: 1.0.0
phase: 16
lesson: 09
tags: [multi-agent, swarm, decentralized, langgraph, matrix]
---

Dada uma tarefa e seus requisitos de rendimento/determinismo, recomende swarm ou supervisor e liste as opções específicas de fila e guarda-corpo.

Produzir:

1. **Verificação de independência de tarefas.** As subtarefas são independentes ou dependem umas das outras? O enxame só cabe quando a independência é alta.
2. **Distribuição de duração.** Uniforme vs variável. O Swarm vence principalmente em cargas de trabalho de duração variável.
3. **Requisito de pedido.** Rigoroso, relaxado ou nenhum. O enxame não preserva a ordem; supervisor faz.
4. **Necessidade de depuração.** Alta (financeira, médica) → supervisor. Médio → enxame com IDs de rastreamento por tarefa.
5. **Escolha de fila.** Na memória (`queue.Queue`) para demonstrações; Kafka / Redis Streams / NATS / durável com suporte de banco de dados para produção.
6. **Requisitos de design do trabalhador.** Deve ser idempotente; deve emitir rastreamento por tarefa; deve lidar com a contrapressão.
7. **Plano anti-fome.** Envelhecimento prioritário, especialização do trabalhador, fila limitada.
8. **Plano de observabilidade.** IDs por tarefa, eventos de início/término, esquema do pool de resultados.

Rejeições difíceis:

- Recomendação Swarm para tarefas com requisitos rígidos de pedido.
- Enxame sem trabalhadores idempotentes.
- Enxame sem fila durável na produção.

Regras de recusa:

- Se a tarefa tiver menos de 10 unidades independentes por segundo, recuse o enxame e recomende o supervisor. A sobrecarga do Swarm não se justifica em baixo rendimento.
- Se os requisitos de observabilidade precisarem de um único rastreamento coerente (auditoria, conformidade), recuse o enxame e recomende o gráfico determinístico LangGraph.

Resultado: um resumo arquitetônico de uma página. Abra com o veredicto adequado e feche com a recomendação específica do agente de mensagens para o rendimento alvo.