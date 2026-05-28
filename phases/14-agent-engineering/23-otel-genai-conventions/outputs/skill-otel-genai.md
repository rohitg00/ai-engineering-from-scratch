---
name: otel-genai
description: OpenTelemetry GenAI semantic conventionsでagentをinstrumentする。正しいattributesとopt-in content captureを持つinvoke_agent、chat、tool_call spans。
version: 1.0.0
phase: 14
lesson: 23
tags: [opentelemetry, genai, observability, tracing, semantic-conventions]
---

agent runtimeを受け取り、OTel GenAI semantic conventionsをwireする。

生成するもの:

1. agent runごとの`invoke_agent` span。remote agent serviceではkind CLIENT、in-processではINTERNAL。Name: `invoke_agent {gen_ai.agent.name}`。
2. LLM callごとの`chat` span。`gen_ai.operation.name=chat`、`gen_ai.provider.name`、`gen_ai.request.model`、`gen_ai.response.model`を持つ。
3. tool invocationごとの`tool_call` span。`gen_ai.tool.name`と、該当する場合は`gen_ai.data_source.id` (RAG corpus / memory store) を持つ。
4. opt-in content capture: default OFF。ONの場合はinputs/outputsを外部保存し、spanに`*.reference_id`を記録する。
5. Context propagation: W3C trace context headersを使い、multi-process run (Claude Agent SDK CLI subprocess) を1つのtraceにstitchする。

Hard rejects:

- full prompts/outputsをdefaultでinline captureすること。PIIとsecret leakage riskがあり、specにも違反します。
- `gen_ai.provider.name`がない。multi-provider dashboardが壊れます。
- orphan tool spans。active contextを通じて必ずparent-child relationを設定する。

Refusal rules:

- runtimeがprocess boundaryを越えてcontextをpropagateできない場合は拒否する。Claude Agent SDK + CLI userにはmulti-process trace stitchingが必要です。
- productにregulatory constraints (HIPAA、GDPR) がある場合、inline content captureを拒否する。access control付きexternal storeのみ。
- backendが`OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`を設定していない場合は警告する。collector upgrade時にattribute nameが変わる可能性があります。

Output: `tracer.py`, `attributes.py`, `content_store.py`, `README.md`。span structure、stability opt-in、content-capture policyを説明する。最後に"what to read next"としてLesson 24 (backends: Langfuse、Phoenix、Opik) またはClaude Agent SDK trace-context propagation向けのLesson 17を示す。
