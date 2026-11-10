# OpenTelemetry GenAI  Ferramenta de rastreamento ligações de ponta a ponta

> Um agente chama cinco ferramentas, três servidores MCP e dois sub-agentes. Precisas de um rastro em tudo. As convenções semânticas OpenTelemetry GenAI (atributos estáveis em v1.37 e acima) são o padrão 2026, nativo suportado por Datadog, Langfuse, Arize Phoenix, OpenLLMetry e AgentOps. Esta lição nomeia os atributos necessários, percorre a hierarquia de tempo (agente → LLM → ferramenta) e envia um emissor de tempo stdlib que você pode conectar a qualquer exportador OTel.

**Type:** Build
**Languages:** Python (stdlib, OTel span emitter), TypeScript
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Nomear os atributos OTel GenAI necessários para um período de MLL e um período de execução de ferramentas.
- Construir uma hierarquia de rastreamento que cobre o loop de agente, chamada de LLM, chamada de ferramenta e despacho de cliente MCP.
- Decidir qual conteúdo capturar (opt-in) versus editar (default).
- Emite extensões para um colecionador local (Jaeger, Langfuse) sem reescrever o código da ferramenta.

## O problema

Um erro de erro de fevereiro de 2026: o usuário relata "meu agente às vezes leva 30 segundos para responder; outras vezes 3 segundos". Não há vestígios. Os registros mostram a chamada LLM, mas não o despacho de ferramenta, não a viagem de ida e volta do servidor MCP, não o sub-agente. Você adivinha. Eventualmente você descobre: um servidor MCP ocasionalmente fica pendurado em um arranque frio.

Sem rastreamento de ponta a ponta, não se consegue encontrar isto.

As convenções foram estabelecidas em 2025-2026 sob o grupo de convenções semânticas OpenTelemetry. Eles definem nomes de atributos estáveis para que Datadog, Langfuse, Phoenix, OpenLLMetry e AgentOps analisem todos os mesmos intervalos.

## O conceito

### Hierarquia de espa

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

A coisa toda fica sob uma identificação de rastreamento.

### Atributos necessários

Para o semestre 2025-2026,

- `gen_ai.operation.name`- Não .`"chat"`- Não .`"text_completion"`- Não .`"embeddings"`- Não .`"execute_tool"`- Não .`"invoke_agent"`- Não .
- `gen_ai.provider.name`- Não .`"openai"`- Não .`"anthropic"`- Não .`"google"`- Não .`"azure_openai"`- Não .
- `gen_ai.request.model` cadeia de modelos solicitada (por exemplo `"gpt-4o-2024-08-06"`)).
- `gen_ai.response.model`O modelo realmente serviu.
- `gen_ai.usage.input_tokens`- Não .`gen_ai.usage.output_tokens`- Não .
- `gen_ai.response.id` Identificação de resposta do prestador para correlação.

Para as extensões das ferramentas:

- `gen_ai.tool.name`Identificador de ferramenta.
- `gen_ai.tool.call.id` o número de chamada específico.
- `gen_ai.tool.description` Descrição da ferramenta (opcional).

Para os períodos de agência:

- `gen_ai.agent.name`- Não .`gen_ai.agent.id`- Não .`gen_ai.agent.description`- Não .

### Tipos de espinha

- `SpanKind.CLIENT`Para chamadas que atravessam um limite de processo (provedor de MLM, servidor MCP).
- `SpanKind.INTERNAL`para os próprios passos do agente e a execução da ferramenta.

### Captura de conteúdo de opção

Por padrão, os intervalos transportam métricas e cronometragem  não pedidos ou conclusões.`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`A análise dos dados e os dados de conteúdo é feita com base no conteúdo de cada um dos conteúdos.

### Eventos em espaços

Eventos de nível de tokens podem ser adicionados como eventos de tempo:

- `gen_ai.content.prompt` mensagens de entrada.
- `gen_ai.content.completion` mensagens de saída.
- `gen_ai.content.tool_call` chamada de ferramenta tal como registrada.

Eventos em ordem temporal dentro de um período para repetição detalhada.

### Exportadores

A OTel abrange as exportações para:

- **Jaeger / Tempo.**OSS, em local.
- **Langfuse.**LLM-observabilidade-específico; visualiza o uso de tokens.
- **Arize Phoenix.**Evals + rastreamento combinado.
- **Datadog.**Comerciante; nativo parses `gen_ai.*`- Os atributos.
- **Honeycomb.**- A partir de uma coluna.

Todos falam OTLP, o formato de cabo.

### Propagação através de MCP

Quando um cliente MCP chama um servidor, injecte o cabeçalho traceparent W3C na solicitação. Streamable HTTP suporta cabeçalhos padrão. Stdio não carrega cabeçalhos HTTP nativo; o roteiro 2026 da especificação discute adicionar um `_meta.traceparent`campo em chamadas JSON-RPC.

Até que os navios: incluam o rastreador no `_meta`O servidor registra o rastreamento.

### Metricas

Junto com os espaços, o GenAI semconv define métricas:

- `gen_ai.client.token.usage` Histograma.
- `gen_ai.client.operation.duration` Histograma.
- `gen_ai.tool.execution.duration` Histograma.

Use estes para painéis que não precisam de detalhes por chamada.

### Equipamento de transporte

O AgentOps (fundado em 2024) é especializado em observabilidade GenAI. Envolve frameworks populares (LangGraph, Pydantic AI, CrewAI) para emitir extensões OTel automaticamente. Útil se sua pilha usa uma estrutura suportada; use instrumentação manual de outra forma.

```figure
t3-span-waterfall
```

## Usá-lo

`code/main.py`emite intervalos em forma de OTel para estudar (em formato OTLP-JSON) para um agente que chama um LLM, envia duas ferramentas e faz uma viagem de ida e volta de MCP. Nenhum exportador real  a lição se concentra no conjunto de forma e atributos de span. Paste a saída em um visualizador compatível com OTLP ou apenas leia-o.

O que ver:

- A identificação de rastreamento é compartilhada em todos os espaços.
- Os links entre pais e filhos são codificados através de `parentSpanId`- Não .
- Requerido`gen_ai.*`Os atributos estão populados.
- A captura de conteúdo é desativada por padrão; um cenário a activa através de env var.

## Envia-o

Esta lição produz`outputs/skill-otel-genai-instrumentation.md`- Tendo em conta uma base de código de agentes, a competência produz um plano de instrumentação: onde adicionar os espaços, que atribui a população e quais exportadores atingir.

## Exercícios

1. Corra .`code/main.py`Contar os intervalos e identificar qual é o CLIENTE vs. INTERNO.

2. Ativar a captura de conteúdo (env var) e confirmar `gen_ai.content.prompt`E ...`gen_ai.content.completion`Observe as implicações para as PII.

3. Adicionar a métrica de execução de ferramentas `gen_ai.tool.execution.duration`E emitir-se como uma amostra de histograma por chamada.

4. Propagar um rastreador de um agente-mãe para um pedido de MCP `_meta.traceparent`Verifique se o servidor MCP veria a mesma identificação.

5. Leia a especificação OTel GenAI semconv. Identifique um atributo listado na semconv que o código desta lição NÃO emite. Adicione-o.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| OTel | "OpenTelemetry" | Open standard for traces, metrics, logs |
| GenAI semconv | "GenAI semantic conventions" | Stable attribute names for LLM / tool / agent spans |
| `gen_ai.*` | "The attribute namespace" | All GenAI attributes share this prefix |
| Span | "Timed operation" | A unit of work with a start, end, and attributes |
| Trace | "Cross-span ancestry" | Tree of spans sharing a trace id |
| SpanKind | "CLIENT / SERVER / INTERNAL" | Hints about span direction |
| OTLP | "OpenTelemetry Protocol" | Wire format for exporters |
| Opt-in content | "Prompt / completion capture" | Off by default; env var to enable |
| traceparent | "W3C header" | Propagates trace context across services |
| Exporter | "Backend-specific shipper" | Component that sends spans to Jaeger / Datadog / etc. |

## Mais leitura

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) convenções canônicas para os períodos, métricas e eventos da GenAI
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) Lista de atributos de MLL e de duração de execução das ferramentas
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) Nível de agente `invoke_agent`Espécie
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) Fonte de verdade hospedada no GitHub
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) Integrar a produção
