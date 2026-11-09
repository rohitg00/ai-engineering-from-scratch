# Tempo de execução da produção: fila, evento, cron

> Agentes de produção executam em seis formas de tempo de execução: solicitação-resposta, streaming, execução duradoura, fundo baseado em fila, orientado por eventos e agendado. Escolha a forma antes de escolher o quadro.

**Type:** Learn
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 22 (Voice)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Nomear as seis formas de execução da produção e combinar cada uma com um padrão de quadro / produto.
- Explique por que a execução duradoura (LangGraph) é importante para tarefas de longo prazo.
- Descreva o tempo de execução baseado no evento e quando Claude Managed Agents se encaixa.
- Explique a alegação de observabilidade como carga de carga para agentes em várias etapas.

## O problema

Agentes de produção falham de maneiras que um notebook Jupyter não aparece: o timeout da rede no passo 37, o usuário pendura a chamada de voz no meio, o trabalho cron morre no reinicio da máquina, o trabalhador de fundo fica sem memória. A forma de tempo de execução determina quais falhas são susceptíveis de sobreviver.

## O conceito

### Requisito-resposta

- HTTP sincrono. O usuário espera a conclusão.
- Apenas viável para tarefas curtas (< 30 anos).
- Estacas: Agno (Python + FastAPI), Mastra (TypeScript + Express/Hono/Fastify/Koa).
- Observabilidade: registos de acesso HTTP padrão + intervalos OTel.

### Transmissão

- SSE ou WebSocket para saída progressiva.
- O LiveKit estende isso ao WebRTC para voz/vídeo (Lessão 22).
- Stacks: qualquer framework com suporte de streaming + uma frontend que lida com SSE/WS.
- Observabilidade: tempo por peça, latença de primeiro token, latença de cauda.

### Execução duradoura

- O estado está em checkpoint após cada passo, resume automaticamente em caso de falha.
- O modelo de atores do AutoGen v0.4 isola falhas em um agente (Lessão 14).
- O diferenciador central do LangGraph (Lessão 13).
- É essencial quando o número de etapas é desconhecido e o custo de recuperação é elevado.

### Baseada em fila / fundo

- O trabalho entra em fila, os trabalhadores recolhem, os resultados fluem para trás através de webhooks ou pub/sub.
- Essenciais para agentes de longo horizonte (dezenas a centenas de passos por tarefa, por anúncio de uso do computador da Anthropic).
- Estacas: Celery (Python), BullMQ (Node), SQS + Lambda (AWS), personalizado.
- Observabilidade: profundidade da fila, distribuição de latência por trabalho, tamanho do DLQ.

### Evento-driven

- Agentes assinam os gatilhos: novo e-mail, aberta PR, fogo cron.
- Claude Managed Agents cobre isto fora da caixa (Lessão 17).
- Os fluxos de CrewAI (Lessão 15) estruturam fluxos de trabalho deterministas orientados por eventos.
- Observabilidade: fonte de desencadeamento, latência do evento para o início, latência do agente.

### Programação

- Agentes em forma de Cron que executam periodicamente.
- Combine com execução duradoura para que uma corrida noturna falha retoma na próxima vez.
- Stacks: Kubernetes CronJob + um framework durável; hospedado (Render cron, Vercel cron).

### Modelos de implantação em 2026

- **CrewAI Flows**para a produção orientada a eventos.
- **Agno**FastAPI sem estado para microsserviços Python.
- **Mastra**Adaptadores de servidor (Express, Hono, Fastify, Koa) para inserção.
- **Pipecat Cloud / LiveKit Cloud**para a voz gerenciada (Lessão 22).
- **Claude Managed Agents**para assincronização de longa duração hospedada.

### Observabilidade é suportável

Sem OpenTelemetry GenAI (Lessão 23) mais um Langfuse / Phoenix / Opik backend (Lessão 24), você não pode depurar um agente multi-passo que falhou na etapa 40.

### Quando os tempos de execução da produção falham

- **Wrong shape choice.**Escolher solicitações-resposta para uma tarefa de 5 minutos.
- **No DLQ.**Trabalhadores em fila sem letra morta.
- **Opaque background work.**Agente de fundo funciona sem rastro de exportação. falhas são invisíveis até o usuário relatá-los.
- **Skipping durable state.**Qualquer execução > 30 segundos em que não se pode permitir reiniciar requer execução duradoura.

```figure
wb-runtime-shapes
```

## Construí-lo

`code/main.py`é uma demonstração multi-forma stdlib:

- O ponto final de resposta-requisito (função simples).
- Gestor de transmissão (generador).
- Trabalhador de fila com DLQ.
- Registro de desencadeamento de eventos.
- Agendador em forma de cron.

- É o que é ?

```bash
python3 code/main.py
npx tsx code/main.ts
```

Output: cinco traços mostrando o comportamento de cada forma na mesma tarefa. A mesma lógica do agente, diferentes conchas externas. A execução duradoura (a sexta forma) é intencionalmente coberta na lição 13 com o ponto de verificação LangGraph.

## Usá-lo

- **Request-response**para UX no estilo chat.
- **Streaming**para respostas progressivas.
- **Durable**para tarefas de longo prazo.
- **Queue**para lote / async / de longa duração.
- **Event**para a reactividade do agente.
- **Cron**para a manutenção da casa (consolidação de memória, avaliações, relatórios de custos).

## Envia-o

`outputs/skill-runtime-shape.md`seleciona uma forma de execução para uma tarefa e fixa os requisitos de observabilidade.

## Exercícios

1. Portar a sua lição 01 ReAct loop para todas as seis formas em sua pilha.
2. Adicione um DLQ à demonstração baseada na fila. Simula 10% falha de trabalho; tamanho de DLQ de superfície.
3. Escreva um agente de avaliação com cron que corre todas as noites contra os 20 principais vestígios do dia.
4. Implementar o streaming com pressão de contração: se o cliente é lento, pause o agente. Como isso interage com um orçamento de turno?
5. Quando é que mudas um agente de longo horizonte para o de gestão?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Request-response | "Synchronous" | User waits; short tasks only |
| Streaming | "SSE / WS" | Progressive output; better UX; latency observable per chunk |
| Durable execution | "Resume from failure" | Checkpointed state; restart at last step |
| Queue-based | "Background jobs" | Producer / worker pool / DLQ |
| Event-driven | "Trigger-based" | Agent reacts to external events |
| DLQ | "Dead-letter queue" | Parking lot for failed jobs |
| Claude Managed Agents | "Hosted harness" | Anthropic-hosted long-running async with caching + compaction |

## Mais leitura

- [LangGraph overview](https://docs.langchain.com/oss/python/langgraph/overview) Detalhes de execução duradoura
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) acomodação de longa data
- [Anthropic, Introducing computer use](https://www.anthropic.com/news/3-5-models-and-computer-use) "dezenas a centenas de passos por tarefa"
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) Isolamento de falhas de modelo de actor
