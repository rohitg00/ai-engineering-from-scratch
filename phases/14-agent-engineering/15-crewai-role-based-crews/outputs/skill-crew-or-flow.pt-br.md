---
name: crew-or-flow
description: Pick CrewAI Crew or Flow for a given task, and scaffold the minimal implementation.
version: 1.0.0
phase: 14
lesson: 15
tags: [crewai, crews, flows, multi-agent, role-based]
---
---
name: crew-or-flow
description: Pick CrewAI Crew or Flow for a given task, and scaffold the minimal implementation.
version: 1.0.0
phase: 14
lesson: 15
tags: [crewai, crews, flows, multi-agent, role-based]
---

Dada a descrição de uma tarefa, escolha Crew (autônomo) ou Flow (determinístico) e, em seguida, andaime.

Decisão:

1. A tarefa possui requisitos de SLA, conformidade ou reprodução determinística? -> Fluxo.
2. A tarefa é exploratória (pesquisa, primeiro rascunho, brainstorming)? -> Tripulação.
3. A tarefa tem mais de 4 especialistas com pedidos selecionados pelo LLM? -> Tripulação Hierárquica.
4. A tarefa tem <=3 especialistas em ordem fixa? -> Tripulação Sequencial ou Fluxo — prefira Fluxo.

Para Tripulações, produza:

1. Definições do agente: função, objetivo, história de fundo (restritivo, <=200 palavras), ferramentas.
2. Definições de tarefas: descrição, saída_esperada, agente.
3. Equipe com o Processo certo (Sequencial | Hierárquico).
4. Um equipamento de teste que executa o Crew em amostras de entradas e verifica se as saídas esperadas são produzidas.

Para Fluxos, produza:

1. Função de entrada `@start`.
2. `@listen(topic)` etapas que formam um DAG.
3. Tópicos explícitos de eventos; nenhuma transmissão mágica.
4. Um equipamento de repetição: dada uma carga inicial, reexecutar deterministicamente.

Rejeições difíceis:

- Tripulações sem histórias de fundo. As histórias de fundo suportam peso.
- Fluxos sem nomes de tópicos explícitos. O "encadeamento implícito" anula o propósito da auditoria.
- Tripulações Hierárquicas com 2 especialistas. A sobrecarga do gerente não é custo de ganho.

Regras de recusa:

- Se o usuário solicitar uma tripulação em uma tarefa de conformidade somente de produção, recuse e migre para o Flow.
- Se o usuário solicitar um Flow em uma tarefa de pesquisa aberta, recuse e migre para Crew.
- Se a história de fundo exceder 200 palavras, recuse e exija um corte. O orçamento de contexto é finito.

Saída: `agents.py`, `tasks.py`, `crew.py` ou `flow.py`, mais `README.md` com a justificativa da decisão. Termine com "o que ler a seguir", apontando para a Lição 24 (Langfuse/AgentOps) para observabilidade ou para a Lição 13 se o Fluxo precisar de uma semântica de currículo durável.