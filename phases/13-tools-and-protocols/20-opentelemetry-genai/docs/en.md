# OpenTelemetry GenAI — Tool CallsをEnd-to-EndにTracingする

> Agentが5つのtools、3つのMCP servers、2つのsub-agentsをcallする。全体を貫く1つのtraceが必要になる。OpenTelemetry GenAI semantic conventions（v1.37以降のstable attributes）は2026年のstandardであり、Datadog、Langfuse、Arize Phoenix、OpenLLMetry、AgentOpsがnative supportしている。このlessonではrequired attributes、span hierarchy（agent → LLM → tool）を整理し、どのOTel exporterにも繋げられるstdlib span emitterをshipする。

**種別:** 構築
**言語:** Python (stdlib, OTel span emitter)
**前提条件:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**所要時間:** 約75分

## Learning Objectives

- LLM spanとtool-execution spanに必要なOTel GenAI attributesを言える。
- Agent loop、LLM call、tool call、MCP client dispatchをcoverするtrace hierarchyを作る。
- 何をcapture（opt-in）し、何をredact（defaults）するかを決める。
- Tool codeを書き換えずにlocal collector（Jaeger、Langfuse）へspansをemitする。

## 問題

2026年2月のdebug例: userが「agentのresponseが時々30秒かかり、時々3秒で返る」と報告する。Tracesはない。LogsにはLLM callは見えるが、tool dispatchもMCP server round-tripもsub-agentも見えない。推測するしかない。最終的に、あるMCP serverがcold-startで時々hangすることを発見する。

End-to-end tracingがなければ、この原因は見つからない。OTel GenAIはそれを直す。

Conventionsは2025-2026年にOpenTelemetry semantic-conventions groupで固まった。Stable attribute namesを定義するため、Datadog、Langfuse、Phoenix、OpenLLMetry、AgentOpsが同じspansをparseできる。Instrumentationは1回でよく、backendはどれでもよい。

## The Concept

### Span hierarchy

```
agent.invoke_agent  (top, INTERNAL span)
 ├── llm.chat       (CLIENT span)
 ├── tool.execute   (INTERNAL)
 │    └── mcp.call  (CLIENT span)
 ├── llm.chat       (CLIENT span)
 └── subagent.invoke (INTERNAL)
```

全体は1つのtrace id配下にnestする。Span idsがparent-child relationshipsをlinkする。

### Required attributes

2025-2026 semconvに基づく:

- `gen_ai.operation.name` — `"chat"`、`"text_completion"`、`"embeddings"`、`"execute_tool"`、`"invoke_agent"`。
- `gen_ai.provider.name` — `"openai"`、`"anthropic"`、`"google"`、`"azure_openai"`。
- `gen_ai.request.model` — requested model string（例: `"gpt-4o-2024-08-06"`）。
- `gen_ai.response.model` — 実際にserveされたmodel。
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`。
- `gen_ai.response.id` — correlation用provider response id。

Tool spans:

- `gen_ai.tool.name` — tool identifier。
- `gen_ai.tool.call.id` — specific call id。
- `gen_ai.tool.description` — tool description（optional）。

Agent spans:

- `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.agent.description`。

### Span kinds

- `SpanKind.CLIENT` はprocess boundaryを越えるcall（LLM provider、MCP server）。
- `SpanKind.INTERNAL` はagent自身のloop stepsとtool execution。

### Opt-in content capture

Defaultではspansはmetricsとtimingを運び、promptsやcompletionsは運ばない。Large payloadsとPIIはdefaultでoffである。Contentを含めるには`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`とspecific content-capture env varsを設定する。Productionで有効にする前に慎重にreviewする。

### Events on spans

Token-level eventsはspan eventsとして追加できる。

- `gen_ai.content.prompt` — input messages。
- `gen_ai.content.completion` — output messages。
- `gen_ai.content.tool_call` — recorded tool call。

Eventsはspan内でtime-orderされ、詳細なreplayに使える。

### Exporters

OTel spansは次へexportできる。

- **Jaeger / Tempo.** OSS、on-prem。
- **Langfuse.** LLM-observability-specific。Token usageをvisualizeする。
- **Arize Phoenix.** Evals + tracing combined。
- **Datadog.** Commercial。`gen_ai.*` attributesをnative parseする。
- **Honeycomb.** Column-orientedでqueryしやすい。

すべてOTLPというwire formatを話す。Code側はbackendを気にしない。

### Propagation across MCP

MCP clientがserverをcallするとき、W3C traceparent headerをrequestへinjectする。Streamable HTTPはstandard headersをsupportする。StdioはHTTP headersをnativeには運ばない。Specの2026 roadmapでは、JSON-RPC callsに`_meta.traceparent` fieldを追加する案が議論されている。

それがshipするまでは、各requestの`_meta`へtraceparentをmanualに含める。Serverはtrace idをlogする。

### Metrics

Spansに加え、GenAI semconvはmetricsも定義する。

- `gen_ai.client.token.usage` — histogram。
- `gen_ai.client.operation.duration` — histogram。
- `gen_ai.tool.execution.duration` — histogram。

Per-call detailを必要としないdashboardsにはこれらを使う。

### AgentOps layer

AgentOps（2024年創業）はGenAI observabilityに特化している。Popular frameworks（LangGraph、Pydantic AI、CrewAI）をwrapし、自動的にOTel spansをemitする。Stackがsupported frameworkを使っているなら便利である。そうでなければmanual instrumentationを使う。

## Use It

`code/main.py`は、LLMをcallし、2つのtoolsをdispatchし、1回のMCP round-tripを行うagentについて、OTel-shaped spansをstdoutへemitする（OTLP-JSON-like format）。Real exporterはない。このlessonはspan shapeとattribute setに集中する。OutputをOTLP-compatible viewerへ貼るか、そのまま読む。

見るべき点:

- Trace idがすべてのspansで共有される。
- Parent-child linksは`parentSpanId`でencodedされる。
- Required `gen_ai.*` attributesが埋まっている。
- Content captureはdefault offであり、1つのscenarioだけenv varでonにする。

## Ship It

このlessonは`outputs/skill-otel-genai-instrumentation.md`を生成する。Agent codebaseを与えると、このskillはinstrumentation planを作る。どこにspansを追加するか、どのattributesを埋めるか、どのexportersをtargetするかを示す。

## Exercises

1. `code/main.py`を実行する。Spansを数え、どれがCLIENTでどれがINTERNALか特定する。

2. Content capture（env var）をonにし、`gen_ai.content.prompt`と`gen_ai.content.completion` eventsが現れることを確認する。PIIへの影響を記録する。

3. Tool-execution metric `gen_ai.tool.execution.duration`を追加し、callごとにhistogram sampleとしてemitする。

4. Parent agent spanからMCP requestの`_meta.traceparent` fieldへtraceparentをpropagateする。MCP serverが同じtrace idを見られることを検証する。

5. OTel GenAI semconv specを読む。このlessonのcodeがemitしていないattributeを1つ特定し、追加する。

## Key Terms

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| OTel | 「OpenTelemetry」 | Traces、metrics、logsのopen standard |
| GenAI semconv | 「GenAI semantic conventions」 | LLM / tool / agent spans向けstable attribute names |
| `gen_ai.*` | 「attribute namespace」 | すべてのGenAI attributesが共有するprefix |
| Span | 「timed operation」 | Start、end、attributesを持つwork unit |
| Trace | 「cross-span ancestry」 | Trace idを共有するspansのtree |
| SpanKind | 「CLIENT / SERVER / INTERNAL」 | Span directionのhint |
| OTLP | 「OpenTelemetry Line Protocol」 | Exporters向けwire format |
| Opt-in content | 「prompt / completion capture」 | Default off。env varでenable |
| traceparent | 「W3C header」 | Services間でtrace contextをpropagateする |
| Exporter | 「backend-specific shipper」 | SpansをJaeger / Datadogなどへ送るcomponent |

## 参考文献

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — GenAI spans、metrics、events向けcanonical conventions
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) — LLMとtool-execution span attribute list
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — agent-level `invoke_agent` span
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) — GitHub-hosted source of truth
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) — production integration walkthrough
