# OpenTelemetry GenAI — Rastreamento de Chamadas de Ferramenta End-to-End

> Um agente chama cinco ferramentas, três servidores MCP e dois sub-agentes. Você precisa de um trace único cobrindo tudo. As convenções semânticas OpenTelemetry GenAI (atributos estáveis na v1.37 e acima) são o padrão de 2026, suportados nativamente por Datadog, Langfuse, Arize Phoenix, OpenLLMetry e AgentOps. Essa lição lista os atributos obrigatórios, percorre a hierarquia de spans (agent → LLM → tool) e disponibiliza um emissor de spans stdlib que você pode conectar em qualquer exportador OTel.

**Tipo:** Construir
**Linguagens:** Python (stdlib, emissor de spans OTel)
**Pré-requisitos:** Fase 13 · 07 (Servidor MCP), Fase 13 · 08 (Cliente MCP)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Nomeie os atributos OTel GenAI obrigatórios pra um span de LLM e um span de execução de ferramenta.
- Construa uma hierarquia de trace que cubra agente loop, chamada de LLM, chamada de ferramenta e despacho de cliente MCP.
- Decida o que capturar de conteúdo (opt-in) vs redigir (padrões).
- Emita spans pra um coletor local (Jaeger, Langfuse) sem reescrever código de ferramentas.

## O Problema

Um debug de fevereiro de 2026: usuário relata "meu agente às vezes leva 30 segundos pra responder; outras vezes 3 segundos." Sem traces. Logs mostram a chamada de LLM, mas não o despacho de ferramenta, não o round-trip do servidor MCP, não o sub-agente. Você adivinha. Eventualmente descobre: um servidor MCP eventualmente trava em cold-start.

Sem rastreamento de ponta a ponta, você não consegue achar isso. OTel GenAI resolve.

As convenções se estabeleceram em 2025-2026 sob o grupo de convenções semânticas do OpenTelemetry. Elas definem nomes de atributos estáveis pra que Datadog, Langfuse, Phoenix, OpenLLMetry e AgentOps todos parseiem os mesmos spans. Instrumente uma vez; disponibilize pra qualquer backend.

## O Conceito

### Hierarquia de spans

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

Tudo se aninha sob um único trace id. IDs de span vinculam relações pai-filho.

### Atributos obrigatórios

Conforme semconv 2025-2026:

- `gen_ai.operation.name` — `"chat"`, `"text_completion"`, `"embeddings"`, `"execute_tool"`, `"invoke_agent"`.
- `gen_ai.provider.name` — `"openai"`, `"anthropic"`, `"google"`, `"azure_openai"`.
- `gen_ai.request.model` — string do modelo requisitado (ex: `"gpt-4o-2024-08-06"`).
- `gen_ai.response.model` — modelo efetivamente servido.
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`.
- `gen_ai.response.id` — ID de resposta do provider pra correlação.

Pra spans de ferramenta:

- `gen_ai.tool.name` — identificador da ferramenta.
- `gen_ai.tool.call.id` — ID da chamada eespecificaçãoífica.
- `gen_ai.tool.description` — descrição da ferramenta (opcional).

Pra spans de agent:

- `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.agent.description`.

### Tipos de span

- `SpanKind.CLIENT` pra chamadas cruzando fronteira de processo (provider de LLM, servidor MCP).
- `SpanKind.INTERNAL` pra passos do loop do agente e execução de ferramentas.

### Captura de conteúdo opt-in

Por padrão, spans carregam métricas e timing — não prompts ou completions. Payloads grandes e PII estão desligados por padrão. Defina `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` e variáveis de ambiente eespecificaçãoíficas de captura de conteúdo pra incluir conteúdo. Revise com cuidado antes de habilitar em prod.

### Eventos em spans

Eventos em nível de token podem ser adicionados como eventos de span:

- `gen_ai.content.prompt` — mensagens de entrada.
- `gen_ai.content.completion` — mensagens de saída.
- `gen_ai.content.tool_call` — chamada de ferramenta conforme registrada.

Eventos ficam ordenados no tempo dentro de um span pra replay detalhado.

### Exportadores

Spans OTel exportam pra:

- **Jaeger / Tempo.** OSS, on-prem.
- **Langfuse.** Eespecificaçãoífico de observabilidade de LLM; visualiza uso de tokens.
- **Arize Phoenix.** Evals + rastreamento combinados.
- **Datadog.** Comercial; parseia nativamente atributos `gen_ai.*`.
- **Honeycomb.** Orientado a colunas; amigável a consultas.

Todos falam OTLP, o formato de wire. Seu código não se importa.

### Propagação via MCP

Quando um cliente MCP chama um servidor, injete o header traceparent W3C na requisição. Streamable HTTP suporta headers padrão. Stdio não carrega headers HTTP nativamente; o roadmap de 2026 da eespecificaçãoificação discute adicionar um campo `_meta.traceparent` em chamadas JSON-RPC.

Até isso ser disponibilizado: inclua o traceparent no `_meta` de cada requisição manualmente. O servidor registra o trace id.

### Métricas

Junto com spans, a semconv GenAI define métricas:

- `gen_ai.client.token.usage` — histograma.
- `gen_ai.client.operation.duration` — histograma.
- `gen_ai.tool.execution.duration` — histograma.

Use pra dashboards que não precisam de detalhe por chamada.

### Camada AgentOps

AgentOps (fundado em 2024) eespecificaçãoializa-se em observabilidade de GenAI. Encapsula frameworks populares (LangGraph, Pydantic AI, CrewAI) pra emitir spans OTel automaticamente. Útil se sua stack usa um framework suportado; use instrumentação manual caso contrário.

## Usar

`code/main.py` emite spans com formato OTel pra stdout (em formato parecido com OTLP-JSON) pra um agente que chama um LLM, despacha duas ferramentas e faz um round-trip MCP. Sem exportador real — a lição foca na forma do span e no conjunto de atributos. Cole a saída num visualizador compatível com OTLP ou simplesmente leia.

O que observar:

- Trace id é compartilhado entre todos os spans.
- Links pai-filho são codificados via `parentSpanId`.
- Atributos obrigatórios `gen_ai.*` estão populados.
- Captura de conteúdo está desligada por padrão; um cenário a liga via variável de ambiente.

## Entregar

Essa lição produz `outputs/skill-otel-genai-instrumentation.md`. Dado um codebase de agente, a skill produz um plano de instrumentação: onde adicionar spans, quais atributos popular e quais exportadores mirar.

## Exercícios

1. Rode `code/main.py`. Conte os spans e identifique quais são CLIENT vs INTERNAL.

2. Habilite captura de conteúdo (variável de ambiente) e confirme que os eventos `gen_ai.content.prompt` e `gen_ai.content.completion` aparecem. Observe as implicações pra PII.

3. Adicione a métrica de execução de ferramenta `gen_ai.tool.execution.duration` e emita como amostra de histograma por chamada.

4. Propague um traceparent de um span de agente pai pro campo `_meta.traceparent` de uma requisição MCP. Verifique que o servidor MCP veria o mesmo trace id.

5. Leia a eespecificaçãoificação semconv OTel GenAI. Identifique um atributo listado na semconv que o código da lição NÃO emite. Adicione-o.

## Termos Chave

| Termo | O que as pessoas dizem | O que significa de verdade |
|------|----------------|------------------------|
| OTel | "OpenTelemetry" | Padrão aberto pra traces, métricas e logs |
| Semconv GenAI | "Convenções semânticas GenAI" | Nomes de atributos estáveis pra spans de LLM / ferramenta / agente |
| `gen_ai.*` | "O namespace de atributos" | Todos os atributos GenAI compartilham esse prefixo |
| Span | "Operação cronometrada" | Uma unidade de trabalho com início, fim e atributos |
| Trace | "Linhagem cross-span" | Árvore de spans compartilhando um trace id |
| SpanKind | "CLIENT / SERVER / INTERNAL" | Dicas sobre direção do span |
| OTLP | "OpenTelemetry Line Protocol" | Formato de wire pra exportadores |
| Conteúdo opt-in | "Captura de prompt / completion" | Desligado por padrão; variável de ambiente pra habilitar |
| traceparent | "Header W3C" | Propaga contexto de trace entre serviços |
| Exportador | "Embarcador eespecificaçãoífico de backend" | Componente que envia spans pra Jaeger / Datadog / etc. |

## Leitura Complementar

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/especificaçãos/semconv/gen-ai/) — convenções canônicas pra spans, métricas e eventos GenAI
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/especificaçãos/semconv/gen-ai/gen-ai-spans/) — lista de atributos de spans de LLM e execução de ferramenta
- [OpenTelemetry — GenAI agente spans](https://opentelemetry.io/docs/especificaçãos/semconv/gen-ai/gen-ai-agent-spans/) — span `invoke_agent` em nível de agent
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) — fonte da verdade no GitHub
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) — walkthrough de integração em produção
