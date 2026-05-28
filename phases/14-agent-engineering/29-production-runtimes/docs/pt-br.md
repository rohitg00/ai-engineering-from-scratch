# Runtimes de Produção: Fila, Evento, Cron

> Agentes de produção rodam em seis formatos de runtime: request-response, streaming, execução durável, background baseado em fila, orientado a eventos e agendado. Escolha o formato antes de escolher o framework. Observabilidade é elementar em cada formato.

**Tipo:** Aprender
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 13 (LangGraph), Fase 14 · 22 (Voice)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear os seis formatos de runtime de produção e mapear cada um pra um padrão de framework/produto.
- Explicar por que execução durável (LangGraph) importa pra tarefas de longo horizonte.
- Descrever o runtime orientado a eventos e quando o Claude Managed Agents se encaixa.
- Explicar a afirmação de observabilidade como elemento estrutural pra agentes multi-passos.

## O Problema

Agentes de produção falham de formas que um notebook Jupyter não revela: timeouts de rede no passo 37, usuário cai no meio de uma chamada de voz, job de cron morre no reboot da máquina, worker de background fica sem memória. O formato do runtime determina quais falhas são sobrevivíveis.

## O Conceito

### Request-response

- HTTP síncrono. Usuário espera a conclusão.
- Só viável pra tarefas curtas (<30s).
- Stacks: Agno (Python + FastAPI), Mastra (TypeScript + Express/Hono/Fastify/Koa).
- Observabilidade: logs de acesso HTTP padrão + spans OTel.

### Streaming

- SSE ou WebSocket pra output progressivo.
- LiveKit estende isso pra WebRTC pra voz/vídeo (Aula 22).
- Stacks: qualquer framework com suporte a streaming + frontend que lida com SSE/WS.
- Observabilidade: timing por chunk, latência do primeiro token, latência de cauda.

### Execução durável

- Estado checkpointado após cada passo; auto-retoma em falha.
- Modelo ator do AutoGen v0.4 isola falhas num único agente (Aula 14).
- Diferencial principal do LangGraph (Aula 13).
- Essencial quando contagem de passos é desconhecida e custo de recuperação é alto.

### Baseado em fila / background

- Job entra na fila, workers pegam, resultados fluem de volta via webhooks ou pub/sub.
- Essencial pra agentes de longo horizonte (dezenas a centenas de passos por tarefa, segundo o anúncio de computer use da Anthropic).
- Stacks: Celery (Python), BullMQ (Node), SQS + Lambda (AWS), custom.
- Observabilidade: profundidade da fila, distribuição de latência por job, tamanho de DLQ.

### Orientado a eventos

- Agentes se inscrevem em triggers: email novo, PR aberto, cron dispara.
- Claude Managed Agents cobre isso de fábrica (Aula 17).
- CrewAI Flows (Aula 15) estrutura workflows determinísticos orientados a eventos.
- Observabilidade: fonte do trigger, latência de evento-para-início, latência do agente.

### Agendado

- Agentes estilo cron que rodam periodicamente.
- Combine com execução durável pra que uma execução noturna que falhe retome no próximo tick.
- Stacks: Kubernetes CronJob + framework durável; hosted (Render cron, Vercel cron).

### Padrões de implantação de 2026

- **CrewAI Flows** pra produção orientada a eventos.
- **Agno** FastAPI stateless pra microsserviços Python.
- **Mastra** server adapters (Express, Hono, Fastify, Koa) pra embedding.
- **Pipecat Cloud / LiveKit Cloud** pra voz gerenciada (Aula 22).
- **Claude Managed Agents** pra async de longa duração hospedado.

### Observabilidade é elementar

Sem spans OTel GenAI (Aula 23) mais um backend Langfuse/Phoenix/Opik (Aula 24), você não consegue debugar um agente multi-passos que falhou no passo 40. Isso não é opcional pra produção. É a diferença entre "a gente debuga rápido" e "a gente refaz do zero com mais logging".

### Onde runtimes de produção falham

- **Escolha de formato errada.** Escolher request-response pra uma tarefa de 5 minutos. Usuários caem; workers acumulam; retries se compõem.
- **Sem DLQ.** Workers de fila sem dead-letter. Jobs que falham somem.
- **Background opaco.** Agente roda em background sem exportação de trace. Falhas são invisíveis até o usuário reportar.
- **Pulando estado durável.** Qualquer run > 30 segundos onde você não pode se dar ao luxo de reiniciar precisa de execução durável.

## Construa

`code/main.py` é uma demo multi-formato em stdlib:

- Endpoint request-response (função simples).
- Handler de streaming (generator).
- Worker baseado em fila com DLQ.
- Registro de triggers de evento.
- Scheduler estilo cron.

Execute:

```bash
python3 code/main.py
```

Saída: cinco traces mostrando o comportamento de cada formato na mesma tarefa. Mesma lógica de agente, cascas externas diferentes. Execução durável (o sexto formato) é coberta de forma intencional na Aula 13 com checkpointing do LangGraph.

## Use

- **Request-response** pra UX estilo chat.
- **Streaming** pra respostas progressivas.
- **Durável** pra tarefas de longo horizonte.
- **Fila** pra batch / async / longa duração.
- **Evento** pra reatividade do agente.
- **Cron** pra manutenção (consolidação de memória, evals, relatórios de custo).

## Entregue

`outputs/skill-runtime-shape.md` escolhe um formato de runtime pra uma tarefa e conecta os requisitos de observabilidade.

## Exercícios

1. Porte seu loop ReAct da Aula 01 pra todos os seis formatos na sua stack. Qual formato se encaixa em qual superfície de produto?
2. Adicione uma DLQ à demo baseada em fila. Simule 10% de falha de job; superficie o tamanho da DLQ.
3. Escreva um eval agente acionado por cron que roda todas as noites contra suas 20 top traces do dia.
4. Implemente streaming com backpressure: se o cliente estiver lento, pause o agente. Como isso interage com um orçamento de turn?
5. Leia a documentação do Claude Managed Agents. Quando você migraria um agente self-hosted de longo horizonte pra managed?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Request-response | "Síncrono" | Usuário espera; só pra tarefas curtas |
| Streaming | "SSE / WS" | Output progressivo; melhor UX; latência observável por chunk |
| Execução durável | "Retomar de falha" | Estado checkpointado; reinicia no último passo |
| Baseado em fila | "Jobs em background" / "Background jobs" | Producer / pool de workers / DLQ |
| Orientado a eventos | "Baseado em trigger" | Agente reage a eventos externos |
| DLQ | "Dead-letter queue" | Estacionamento pra jobs que falharam |
| Claude Managed Agents | "Harness hospedado" | Async de longa duração hospedado pela Anthropic com caching + compactação |

## Leitura Complementar

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) — detalhes de execução durável
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) — async de longa duração hospedado
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) — "dezenas a centenas de passos por tarefa"
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — isolamento de falhas por modelo ator
