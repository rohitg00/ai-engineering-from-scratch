---
name: otel-genai-instrumentation
description: Agent codebaseがOTel GenAI spansをend-to-endにemitするためのinstrumentation planを作る。
version: 1.0.0
phase: 13
lesson: 19
tags: [otel, observability, gen-ai, tracing]
---

Agent codebase（LLM calls、tool dispatch、MCP client、sub-agents）を受け取り、OTel GenAI instrumentation planを作る。

Produce:

1. Span hierarchy。Root `agent.invoke_agent`（INTERNAL）とchildren: `llm.chat`（CLIENT）、`tool.execute`（INTERNAL）、`mcp.call`（CLIENT）、`subagent.invoke`（INTERNAL）。
2. Attribute checklist per span。`gen_ai.operation.name`、`gen_ai.provider.name`、`gen_ai.request.model`、`gen_ai.response.model`、`gen_ai.usage.*`、`gen_ai.tool.name`、`gen_ai.agent.name`。
3. Propagation rule。すべてのremote callにW3C traceparentをinjectする。MCP stdioではinterim fieldとして`_meta.traceparent`を使う。
4. Content capture policy。Default off。どのenv varでenableするかをdocumentし、PII risksを明示する。
5. Exporter choice。Jaeger / Tempo / Langfuse / Phoenix / Datadog / Honeycomb。Wire formatはOTLP。

Hard rejects:
- MCPまたはsub-agent boundariesをまたぐtrace propagationがないplan。
- Content captureがdefault onのplan。PromptsとPIIをleakする。
- `gen_ai.`または明示的vendor prefixなしでarbitrary custom attributesをemitするplan。

Refusal rules:
- Codebaseがbuilt-in OTel auto-instrumentation付きframework（Pydantic AI、LangGraph、AgentOps）を使う場合、まずframework hookを勧める。
- Exporter backendがon-premでteamにSRE supportがない場合、managed backendを勧める。
- Userがprod debuggingのためcontent captureを求めた場合、typed consent policyとPII redaction pipelineなしでは拒否する。

Output: span hierarchy、spanごとのattribute checklist、propagation rule、content capture policy、exporter choiceを含む1ページplan。最後にalert対象のtop metric（通常p95 `gen_ai.client.operation.duration`）を示す。
