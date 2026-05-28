---
name: state-graph
description: Construa uma máquina de estado em formato LangGraph com estado digitado, bordas condicionais, pontos de verificação por nó e currículo durável.
version: 1.0.0
phase: 14
lesson: 13
tags: [langgraph, state-machine, durable, checkpointing, human-in-the-loop]
---

Dado um tempo de execução de destino, uma forma de estado, um conjunto de funções de nó e um backend de checkpointer, produza um gráfico de agente com estado.

Produzir:

1. Um `State` digitado (dict ou Pydantic). Documente todos os campos. Estado de leitura dos nós; eles retornam atualizações.
2. Um `StateGraph` com `add_node`, `add_edge`, `add_conditional_edges`, `set_entry`, mais sentinelas `START`/`END`.
3. Uma interface `Checkpointer` com `save(session_id, node, state)` e `load_latest(session_id)`. Padrão para SQLite; permitir Postgres/Redis/custom.
4. Um `Runner` que percorre o gráfico, serializa o estado após cada nó, captura `PausedAtNode` para humano no loop e suporta `resume_from` com `state_override` opcional.
5. Três auxiliares de topologia: supervisor (roteador central), swarm (transferências de ferramentas compartilhadas), hierárquico (subgráficos).

Rejeições difíceis:

- Nós não determinísticos sem captura explícita de sementes aleatórias ou de relógio de parede. O currículo assume que a saída do nó é reproduzível, dado o estado de entrada.
- Um checkpointer que salva apenas o estado "resumo". Serialize o estado completo ou retome as quebras.
- Gráficos onde cada aresta é condicional. Prefira cadeias lineares com ramificações ocasionais.

Regras de recusa:

- Se o usuário solicitar um gráfico de estado sem persistência, recuse. A questão toda é um currículo durável; se você não precisar de currículo, use os padrões de fluxo de trabalho da Lição 12.
- Se o usuário solicitar "checkpoint apenas em caso de sucesso", recuse. As falhas também precisam de estado – é aí que começa a depuração.
- Se o gráfico tiver mais de 30 nós, recuse o layout plano e exija subgráficos aninhados. Gráficos planos de 30 nós não podem ser revisados.

Saída: `state.py`, `graph.py`, `checkpointer.py`, `runner.py`, `README.md` explicando o esquema de estado, a escolha do checkpointer e a semântica de currículo. Termine com "o que ler a seguir" apontando para a Lição 14 para alternativa de modelo de ator, Lição 16 para camada de handoffs/guardrails ou Lição 23 para extensões OTel em etapas do gráfico.