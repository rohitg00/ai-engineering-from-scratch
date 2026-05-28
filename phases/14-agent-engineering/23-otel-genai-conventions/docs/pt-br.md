# OpenTelemetry GenAI Semantic Conventions

> A GenAI SIG do OpenTelemetry (lançada em abril de 2024) define o schema padrão pra telemetria de agentes. Nomes de spans, atributos e regras de content-capture convergem entre vendors pra que traces de agentes signifiquem a mesma coisa no Datadog, Grafana, Jaeger e Honeycomb.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 13 (LangGraph), Fase 14 · 24 (Observability Platforms)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear as categorias de spans GenAI: model/client, agent, tool.
- Distinguir spans `invoke_agent` CLIENT vs INTERNAL e quando cada um se aplica.
- Listar os atributos GenAI de nível superior: nome do provider, modelo da request, ID da fonte de dados.
- Explicar o contrato de content-capture: opt-in, `OTEL_SEMCONV_STABILITY_OPT_IN`, recomendação de referência externa.

## O Problema

Cada vendor inventa seus próprios nomes de span. Times de ops acabam construindo dashboards por framework. A GenAI SIG do OpenTelemetry corrige isso definindo um padrão único que todo o ecossistema mira.

## O Conceito

### Categorias de spans

1. **Spans de model/client.** Cobrem chamadas LLM cruas. Emitidos por SDKs de providers (Anthropic, OpenAI, Bedrock) e adaptadores de modelo de frameworks.
2. **Spans de agent.** `create_agent` (quando o agente é construído) e `invoke_agent` (quando ele roda).
3. **Spans de tool.** Um por invocação de tool; conectado ao span do agente por relação pai-filho.

### Naming de spans de agent

- Nome do span: `invoke_agent {gen_ai.agent.name}` se nomeado; reserva pra `invoke_agent`.
- Tipo do span:
  - **CLIENT** — pra serviços de agente remotos (OpenAI Assistants API, Bedrock Agents).
  - **INTERNAL** — pra frameworks de agente in-process (LangChain, CrewAI, ReAct local).

### Atributos-chave

- `gen_ai.provider.name` — `anthropic`, `openai`, `aws.bedrock`, `google.vertex`.
- `gen_ai.request.model` — o ID do modelo.
- `gen_ai.response.model` — o modelo resolvido (pode diferir do request por causa de roteamento).
- `gen_ai.agent.name` — identificador do agente.
- `gen_ai.operation.name` — `chat`, `completion`, `invoke_agent`, `tool_call`.
- `gen_ai.data_source.id` — pra RAG: qual corpus ou store foi consultado.

Convenções eespecificaçãoíficas por tecnologia existem pra Anthropic, Azure AI Inference, AWS Bedrock, OpenAI.

### Content capture

A regra padrão: instrumentações NÃO DEVEM capturar inputs/outputs por padrão. Captura é opt-in via:

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

Padrão recomendado pra produção: armazene conteúdo externamente (S3, seu log store), registre referências nos spans (IDs de ponteiro, não texto). Essa é a defesa de content-poisoning da Aula 27 conectada na observabilidade.

### Estabilidade

A maioria das convenções é experimental em março de 2026. Ative o preview estável com:

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+ mapeia atributos GenAI nativamente no schema LLM Observability. Outros backends (Grafana, Honeycomb, Jaeger) suportam os atributos brutos.

### Onde esse pattern dá errado

- **Capturar prompts completos nos spans.** PII, segredos, dados de cliente em traces que ops podem ler. Armazene externamente.
- **Sem `gen_ai.provider.name`.** Dashboards multi-provider quebram quando a atribuição está faltando.
- **Spans sem links de pai.** Spans órfãos de tool. Sempre propague contexto.
- **Não setar opt-in de estabilidade.** Seus atributos podem ser renomeados no upgrade do backend.

## Construa

`code/main.py` implementa um emissor de span em stdlib seguindo as convenções GenAI:

- `Span` com schema de atributos GenAI.
- `Tracer` com `start_span`, contextos aninhados.
- Uma execução roteada de agente que emite: `create_agent`, `invoke_agent` (INTERNAL), spans por tool, spans `chat` pra chamadas LLM.
- Um modo de content-capture que armazena prompts externamente e registra IDs nos spans.

Execute:

```
python3 code/main.py
```

Saída: uma árvore de spans com todos os atributos GenAI necessários, e um "store externo" mostrando as referências de conteúdo opt-in.

## Use

- **Datadog LLM Observability** (v1.37+) mapeia atributos nativamente.
- **Langfuse / Phoenix / Opik** (Aula 24) — auto-instrumentação no ecossistema.
- **Jaeger / Honeycomb / Grafana Tempo** — traces OTel brutos; construa dashboards a partir dos atributos GenAI.
- **Self-hosted** — rode o OTel Collector com um processor GenAI.

## Entregue

`outputs/skill-otel-genai.md` conecta spans OTel GenAI num agente existente com configurações-padrão de content-capture e armazenamento de referências externas.

## Exercícios

1. Instrumente seu loop ReAct da Aula 01 com `invoke_agent` (INTERNAL) + spans por tool. Envie pra uma instância do Jaeger.
2. Adicione content capture no modo "só referências": prompts no SQLite, atributos de span carregam só IDs de linha.
3. Leia a eespecificaçãoificação de `gen_ai.data_source.id`. Conecte-o na sua busca Mem0 da Aula 09.
4. Set `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` e verifique se seus atributos não são renomeados pelo collector.
5. Construa um dashboard: "quais erros de ferramenta se correlacionam com quais modelos" usando só atributos GenAI.

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| GenAI SIG | "Grupo GenAI do OpenTelemetry" | Working group do OTel definindo o schema |
| invoke_agent | "Span de agente" | Nome do span que representa uma execução de agente |
| CLIENT span | "Chamada remota" | Span pra chamada a um serviço de agente remoto |
| INTERNAL span | "In-process" | Span pra execução de agente in-process |
| gen_ai.provider.name | "Provider" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "Fonte RAG" | Qual corpus/store um retrieval acertou |
| Content capture | "Log de prompts" | Captura opt-in de mensagens; armazene externamente em prod |
| Stability opt-in | "Modo preview" | Variável de ambiente pra fixar convenções experimentais |

## Leitura Complementar

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/especificaçãos/semconv/gen-ai/) — a especificação
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — GenAI spans por padrão
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — OTel spans built-in
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) — propagação W3C trace context
