# OpenTelemetry GenAI Semantic Conventions

> OpenTelemetryのGenAI SIG (2024年4月launch) は、agent telemetryのstandard schemaを定義します。span name、attributes、content-capture rulesがvendor間で収束するため、Datadog、Grafana、Jaeger、Honeycombでagent traceが同じ意味を持ちます。

**種別:** 学習 + 構築
**言語:** Python (stdlib)
**前提条件:** Phase 14 · 13 (LangGraph), Phase 14 · 24 (Observability Platforms)
**所要時間:** 約60分

## Learning Objectives

- GenAI span categoriesを挙げる: model/client、agent、tool。
- `invoke_agent` CLIENT spanとINTERNAL spanを区別し、それぞれがいつ適用されるかを説明する。
- top-level GenAI attributesを列挙する: provider name、request model、data-source ID。
- content-capture contractを説明する: opt-in、`OTEL_SEMCONV_STABILITY_OPT_IN`、external-reference recommendation。

## 問題

各vendorが独自のspan nameを発明しています。その結果、Ops teamはframeworkごとのdashboardを作ることになります。OpenTelemetryのGenAI SIGは、ecosystem全体がtargetにする1つのstandardを定義することでこれを解決します。

## The Concept

### Span categories

1. **Model / client spans。** raw LLM callをcoverする。provider SDK (Anthropic、OpenAI、Bedrock) とframework model adapterがemitする。
2. **Agent spans。** `create_agent` (agent構築時) と`invoke_agent` (実行時)。
3. **Tool spans。** tool invocationごとに1つ。parent-child relationでagent spanにつながる。

### Agent span naming

- Span name: nameがある場合は`invoke_agent {gen_ai.agent.name}`。fallbackは`invoke_agent`。
- Span kind:
  - **CLIENT** — remote agent service (OpenAI Assistants API、Bedrock Agents) 用。
  - **INTERNAL** — in-process agent framework (LangChain、CrewAI、local ReAct) 用。

### Key attributes

- `gen_ai.provider.name` — `anthropic`、`openai`、`aws.bedrock`、`google.vertex`。
- `gen_ai.request.model` — model ID。
- `gen_ai.response.model` — resolved model (routingによりrequestと異なる場合がある)。
- `gen_ai.agent.name` — agent identifier。
- `gen_ai.operation.name` — `chat`、`completion`、`invoke_agent`、`tool_call`。
- `gen_ai.data_source.id` — RAG用。どのcorpusまたはstoreをconsultしたか。

Anthropic、Azure AI Inference、AWS Bedrock、OpenAI向けにはtechnology-specific conventionsがあります。

### Content capture

default rule: instrumentationはdefaultでinputs/outputsをcaptureすべきではありません (SHOULD NOT)。captureは次を通じたopt-inです。

- `gen_ai.system_instructions`
- `gen_ai.input.messages`
- `gen_ai.output.messages`

推奨production pattern: contentは外部に保存する (S3、自社log store)。spanにはreferenceを記録する (proseではなくpointer IDs)。これはLesson 27のcontent-poisoning defenseをobservabilityに組み込むものです。

### Stability

2026年3月時点で、ほとんどのconventionはexperimentalです。stable previewには次でopt inします。

```
OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
```

Datadog v1.37+はGenAI attributesをnativeにLLM Observability schemaへmapします。その他のbackend (Grafana、Honeycomb、Jaeger) はraw attributesをsupportします。

### Where this pattern goes wrong

- **Capturing full prompts in spans。** Opsが読めるtraceにPII、secret、customer dataが入る。外部に保存してください。
- **No `gen_ai.provider.name`。** attributionがないとmulti-provider dashboardが壊れます。
- **Spans without parent links。** orphaned tool spans。必ずcontextをpropagateしてください。
- **Not setting stability opt-in。** backend upgrade時にattributeがrenameされる可能性があります。

## 実装

`code/main.py`はGenAI conventionsに合うstdlib span emitterを実装しています。

- GenAI attribute schemaを持つ`Span`。
- `start_span`とnested contextsを持つ`Tracer`。
- `create_agent`、`invoke_agent` (INTERNAL)、tool別span、LLM call用`chat` spanをemitするscripted agent run。
- promptを外部保存し、spanにIDを記録するcontent-capture mode。

実行:

```
python3 code/main.py
```

Output: required GenAI attributesをすべて持つspan treeと、opt-in content referenceを示す"external store"。

## Use It

- **Datadog LLM Observability** (v1.37+) はattributesをnativeにmapします。
- **Langfuse / Phoenix / Opik** (Lesson 24) — ecosystemをauto-instrumentする。
- **Jaeger / Honeycomb / Grafana Tempo** — raw OTel traces。GenAI attributesからdashboardを構築する。
- **Self-hosted** — GenAI processor付きでOTel Collectorを実行する。

## Ship It

`outputs/skill-otel-genai.md`は、content-capture defaultsとexternal-reference storageを持つOTel GenAI spansを既存agentにwireします。

## Exercises

1. Lesson 01のReAct loopを`invoke_agent` (INTERNAL) + tool別spanでinstrumentする。Jaeger instanceへ送る。
2. "references only" modeでcontent captureを追加する。promptはSQLiteへ、span attributesにはrow IDだけを持たせる。
3. `gen_ai.data_source.id`のspecを読む。Lesson 09のMem0 searchにwireする。
4. `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`を設定し、collectorによってattributeがrenameされないことをverifyする。
5. GenAI attributesだけから「どのtool errorがどのmodelとcorrelateするか」というdashboardを構築する。

## Key Terms

| Term | よくある言い方 | 実際の意味 |
|------|----------------|------------|
| GenAI SIG | "OpenTelemetry GenAI group" | schemaを定義するOTel working group |
| invoke_agent | "Agent span" | agent runを表すspanのname |
| CLIENT span | "Remote call" | remote agent serviceへのcallを表すspan |
| INTERNAL span | "In-process" | in-process agent runを表すspan |
| gen_ai.provider.name | "Provider" | anthropic / openai / aws.bedrock / google.vertex |
| gen_ai.data_source.id | "RAG source" | retrieval hitがどのcorpus/storeか |
| Content capture | "Prompt logging" | message captureはopt-in。prodでは外部保存 |
| Stability opt-in | "Preview mode" | experimental conventionsをpinするenv var |

## 参考文献

- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — spec
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) — GenAI spans by default
- [AutoGen v0.4 (Microsoft Research)](https://www.microsoft.com/en-us/research/articles/autogen-v0-4-reimagining-the-foundation-of-agentic-ai-for-scale-extensibility-and-robustness/) — OTel spans built in
- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) — W3C trace context propagation
