---
name: otel-genai-instrumentation
description: Produce an instrumentation plan for an agent codebase to emit OTel GenAI spans end-to-end.
version: 1.0.0
phase: 13
lesson: 19
tags: [otel, observability, gen-ai, tracing]
---

Given an agent codebase (LLM calls, tool dispatch, MCP client, sub-agents), produce an OTel GenAI instrumentation plan.

Produce:

1. Span hierarchy. Root `agent.invoke_agent` (INTERNAL) and children: `llm.chat` (CLIENT), `tool.execute` (INTERNAL), `mcp.call` (CLIENT), `subagent.invoke` (INTERNAL).
2. Attribute checklist per span. `gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.*`, `gen_ai.tool.name`, `gen_ai.agent.name`.
3. Propagation rule. Inject W3C traceparent on every remote call; for MCP stdio use `_meta.traceparent` as an interim field.
4. Content capture policy. Off by default; document which env var enables; name PII risks.
5. Exporter choice. Jaeger / Tempo / Langfuse / Phoenix / Datadog / Honeycomb; OTLP as the wire.

Hard rejects:
- Any plan missing trace propagation across MCP or sub-agent boundaries.
- Any plan with content capture on by default. Leaks prompts and PII.
- Any plan that emits arbitrary custom attributes without the `gen_ai.` or explicit vendor prefix.

Refusal rules:
- If the codebase uses a framework with built-in OTel auto-instrumentation (Pydantic AI, LangGraph, AgentOps), recommend the framework hook first.
- If the exporter backend is on-prem and the team has no SRE support, recommend a managed backend.
- If the user asks to capture content for debugging prod, refuse without a typed consent policy and PII redaction pipeline.

Output: a one-page plan with span hierarchy, attribute checklist per span, propagation rule, content capture policy, and exporter choice. End with the top metric to alert on (typically p95 `gen_ai.client.operation.duration`).
