---
name: runtime-picker
description: Escolha um tempo de execução do agente de produção (Agno, Mastra, LangGraph, provedor SDK) para uma determinada pilha, orçamento de latência e formato operacional.
version: 1.0.0
phase: 14
lesson: 18
tags: [agno, mastra, langgraph, runtime, selection]
---

Dada uma pilha, orçamento de latência, primitivos necessários e formato operacional, escolha um tempo de execução.

Decisão:

1. Python + FastAPI + milhares de agentes de curta duração por segundo -> **Agno**.
2. TypeScript + Next.js/Vercel + multiprovedor unificado -> **Mastra**.
3. Estado durável, gráfico explícito, retomada em caso de falha -> **LangGraph** (Lição 13).
4. Primeiro produto Claude, deseja o formato de chicote do Código Claude -> **Claude Agent SDK** (Lição 17).
5. Primeiro produto OpenAI, deseja transferências + proteções + rastreamento -> **OpenAI Agents SDK** (Lição 16).
6. Equipe multiagente, simultaneidade de modelo de ator, isolamento de falhas -> **AutoGen v0.4** / **Microsoft Agent Framework** (Lição 14).
7. Colaboração baseada em funções ou fluxos de trabalho determinísticos orientados a eventos -> **CrewAI** Equipe ou Fluxo (Lição 15).
8. Nenhuma das opções acima -> chamadas diretas de API + o loop stdlib da Lição 01.

Produzir:

- Um breve documento de decisão: pilha, alvo de latência, primitivos necessários, compensações observadas.
- Um andaime mínimo no tempo de execução escolhido.
- Um plano de migração se outro tempo de execução estiver em uso hoje.

Rejeições difíceis:

- Escolher Agno ou Mastra apenas com base no “desempenho” quando a carga de trabalho é uma chamada lenta por solicitação. O desempenho raramente é o gargalo.
- Escolher um tempo de execução TypeScript em um monorepo Python sem justificativa. O código do agente de idioma misto é um imposto operacional.
- Escolha LangGraph para tarefas curtas sem estado. O checkpointer adiciona sobrecarga que um fluxo de trabalho simples (Lição 12) evita.

Regras de recusa:

- Se o usuário quiser "todos os cinco tempos de execução, para comparar", recuse. Benchmark em sua carga de trabalho; os benchmarks do fornecedor de estrutura são direcionais.
- Se o usuário quiser auto-hospedar os recursos `ee/` do Mastra, recuse e indique os termos da licença.
- Se o produto precisar de trabalho assíncrono de longa duração (horas a dias), recuse a auto-hospedagem e encaminhe para Claude Managed Agents ou para uma arquitetura baseada em filas (Lição 29).

Saída: documento de decisão + andaime + README. Termine com "o que ler a seguir" apontando para a Lição 24 (observabilidade) e a Lição 29 (tempos de execução de produção) para a camada operacional acima da estrutura.