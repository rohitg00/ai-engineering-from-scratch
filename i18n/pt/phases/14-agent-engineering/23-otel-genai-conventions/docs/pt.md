# OpenTelemetry Convenções semânticas GenAI

> O SIG GenAI da OpenTelemetry (lançado em abril de 2024) define o esquema padrão para telemetria de agentes. Os nomes de espaços, atributos e regras de captura de conteúdo convergem entre os fornecedores, de modo que os rastros de agentes significam a mesma coisa em Datadog, Grafana, Jaeger e Honeycomb.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 13 (LangGraph), Phase 14 · 24 (Observability Platforms)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Nomear as categorias de abrangência da GenAI: modelo/cliente, agente, ferramenta.
- Distinguir`invoke_agent`CLIENT vs INTERNAL e quando cada um se aplica.
- Lista dos atributos de nível superior da GenAI: nome do fornecedor, modelo de solicitação, ID da fonte de dados.
- Explicar o contrato de captura de conteúdo: optar-in, `OTEL_SEMCONV_STABILITY_OPT_IN`, recomendação de referência externa.

## O problema

Cada fornecedor inventa seus próprios nomes de espaço. equipes de operações acabam construindo painéis de controle por quadro.

## O conceito

### Categoria de espaços

1. **Model / client spans.**Cobrir chamadas de LLM crus. emitidas pelos SDKs (Antropic, OpenAI, Bedrock) e adaptadores de modelos frameworks.
2. **Agent spans.** `create_agent`(quando o agente é construído) e `invoke_agent`(quando ele corre).
3. **Tool spans.**Uma por invocação de ferramenta; ligada ao espaço de agente pela relação pai-filho.

### Nomeamento do agente span

- Nome em espanhol: `invoke_agent {gen_ai.agent.name}`se for nomeado; retorno a `invoke_agent`- Não .
- Tipo de espinha:
  - **CLIENT** para serviços de agentes remotos (OpenAI Assistants API, Bedrock Agents).
  - **INTERNAL** para os quadros de agentes em processo (LangChain, CrewAI, local ReAct).

### Atributos-chave

- `gen_ai.provider.name`- Não .`anthropic`- Não .`openai`- Não .`aws.bedrock`- Não .`google.vertex`- Não .
- `gen_ai.request.model` Identificação do modelo.
- `gen_ai.response.model` o modelo resolvido (poderá diferir do pedido devido ao roteamento).
- `gen_ai.agent.name`Identificação do agente.
- `gen_ai.operation.name`- Não .`chat`- Não .`completion`- Não .`invoke_agent`- Não .`tool_call`- Não .
- `gen_ai.data_source.id` para o RAG: qual o corpus ou loja foi consultado.

Existem convenções específicas de tecnologia para Anthropic, Azure AI Inference, AWS Bedrock, OpenAI.

### Captura de conteúdo

A regra padrão: as instrumentações NÃO DEVEM capturar entradas/salidas por padrão.

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

Padrão de produção recomendado: armazenar conteúdo externamente (S3, a sua loja de log), registar referências em intervalos (ID de indicador, não prosa). Esta é a lição 27 de defesa contra intoxicação de conteúdo conectada à observabilidade.

### Estabilidade

A maioria das convenções é experimental a partir de março de 2026.

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

O DataDog v1.37+ mapeia que a GenAI atribui nativamente ao seu esquema de observabilidade LLM. Outros backends (Grafana, Honeycomb, Jaeger) suportam os atributos brutos.

### Onde este padrão vai mal

- **Capturing full prompts in spans.**Informações pessoais, segredos, dados de clientes em vestígios que podem ser lidos.
- **No `gen_ai.provider.name`.**Os painéis de multi-provedor quebram quando falta atribuição.
- **Spans without parent links.**Ferramentas órfãs, sempre propagam contexto.
- **Not setting stability opt-in.**Os seus atributos podem ser renomeados no upgrade de backend.

```figure
ae-genai-span-tree
```

## Construí-lo

`code/main.py`Implementa um emissor de estdlib com um período de tempo correspondente às convenções da GenAI:

- `Span`com esquema de atributos GenAI.
- `Tracer`com`start_span`, contextos aninhados.
- Um agente com roteiro que emite:`create_agent`- Não .`invoke_agent`(INTERNAL), por ferramenta,`chat`- As chamadas de LLM.
- Um modo de captura de conteúdo que armazena pedidos externamente e registra IDs em intervalos.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

Output: uma árvore de extensão com todos os atributos GenAI necessários e uma "localização externa" que mostra as referências de conteúdo de opção.

## Usá-lo

- **Datadog LLM Observability**(v1.37+) mapas atributos nativo.
- **Langfuse / Phoenix / Opik**(Lessão 24)  auto-instrumentar o ecossistema.
- **Jaeger / Honeycomb / Grafana Tempo** rastreamento bruto de OTel; criar painéis de controle a partir de atributos GenAI.
- **Self-hosted** executar o Colector OTel com um processador GenAI.

## Envia-o

`outputs/skill-otel-genai.md`Os cabos OTel GenAI se estendem a um agente existente com padrões de captura de conteúdo e armazenamento de referências externos.

## Exercícios

1. Instrumenta a sua lição 01 ReAct loop com `invoke_agent`(INTERNAL) + extensões por ferramenta. Enviar para uma instância Jaeger.
2. Adicionar captura de conteúdo no modo "apenas referências": pedidos para SQLite, atributos span carregam apenas IDs de fila.
3. Leia a especificação para `gen_ai.data_source.id`Entre em sua pesquisa Memorandum de lição 9.
4. Set `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`e verifique se os seus atributos não são renomeados pelo coletor.
5. Construir um painel de instrumentos: "qual erro de ferramenta correlaciona com quais modelos" apenas a partir dos atributos da GenAI.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GenAI SIG | "OpenTelemetry GenAI group" | OTel working group defining the schema |
| invoke_agent | "Agent span" | Name of the span representing an agent run |
| CLIENT span | "Remote call" | Span for a call to a remote agent service |
| INTERNAL span | "In-process" | Span for an in-process agent run |
| gen_ai.provider.name | "Provider" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG source" | Which corpus/store a retrieval hit |
| Content capture | "Prompt logging" | Opt-in capture of messages; store externally in prod |
| Stability opt-in | "Preview mode" | Env var to pin experimental conventions |

## Mais leitura

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) a especificação
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) Gênero de tempo de tempo por padrão
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) Espaços OTel incorporados
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) Proibição de conteúdo de rastreamento W3C
