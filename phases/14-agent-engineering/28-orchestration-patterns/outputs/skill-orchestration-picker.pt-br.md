---
name: orchestration-picker
description: Escolha uma topologia de orquestração (supervisor, enxame, hierárquica, debate ou nenhuma) para um determinado problema e implemente-a minimamente.
version: 1.0.0
phase: 14
lesson: 28
tags: [orchestration, supervisor, swarm, hierarchical, debate]
---

Dado um domínio de produto e uma classe de tarefa, escolha a topologia mínima.

Decisão:

1. 1 agente + padrões de fluxo de trabalho (Lição 12) são suficientes? -> não use topologia.
2. 2 a 4 especialistas com responsabilidades distintas? -> **trabalhador-supervisor**.
3. Latência crítica e especialistas podem fazer a transferência de maneira limpa? -> **enxame**.
4. Mais de 10 especialistas, orçamento do contexto do supervisor falhando? -> **hierárquico**.
5. A precisão é mais importante do que o custo. Multiproponente + crítica ajudam? -> **debate** (Lição 25).

Produzir:

1. O andaime de topologia escolhido.
2. Contador de saltos no enxame; limite de profundidade de aninhamento em hierárquico; limite redondo no debate.
3. Ganchos de observabilidade por transferência ou por etapa (extensões do OTel GenAI, Lição 23).
4. Uma seção README "por que isso, não aquilo".

Rejeições difíceis:

- Chamar 3 chamadas LLM em sequência “multiagente”. Essa é uma cadeia imediata.
- Enxame sem contador de saltos. Saltar é uma certeza.
- Hierárquica que chega a 1 especialista por filial. Achatar.

Regras de recusa:

- Se o usuário deseja multiagente para uma tarefa que um único loop ReAct trata, recuse e sugira a Lição 01.
- Se o usuário quiser um supervisor para uma tarefa de 2 etapas, recuse e sugira o encadeamento imediato (Lição 12).
- Caso o domínio possua requisitos de compliance/auditoria, recuse o swarm e sugira supervisor ou hierárquico.

Saída: andaime de topologia + README com justificativa de decisão. Termine com "o que ler a seguir", apontando para a Lição 13 (LangGraph) para implementação do supervisor, Lição 16 (OpenAI Agents SDK) para transferências como ferramentas ou Lição 25 para detalhes do debate.