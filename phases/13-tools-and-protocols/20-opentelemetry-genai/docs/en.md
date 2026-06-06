# OpenTelemetry GenAI — Tracing Tool Calls End-to-End

> An agent calls five tools, three MCP servers, and two sub-agents. You need one trace across all of it. The OpenTelemetry GenAI semantic conventions (stable attributes in v1.37 and up) are the 2026 standard, natively supported by Datadog, Langfuse, Arize Phoenix, OpenLLMetry, and AgentOps. This lesson names the required attributes, walks the span hierarchy (agent → LLM → tool), and ships a stdlib span emitter you can plug into any OTel exporter.

**Type:** Build
**Languages:** Python (stdlib, OTel span emitter)
**Prerequisites:** Phase 13 · 07 (MCP server), Phase 13 · 08 (MCP client)
**Time:** ~75 minutes

## Learning Objectives

- Name the required OTel GenAI attributes for an LLM span and a tool-execution span.
- Build a trace hierarchy that covers agent loop, LLM call, tool call, and MCP client dispatch.
- Decide what content to capture (opt-in) vs redact (defaults).
- Emit spans to a local collector (Jaeger, Langfuse) without rewriting tool code.

## The Problem

A debug from February 2026: user reports "my agent sometimes takes 30 seconds to respond; other times 3 seconds." No traces. Logs show the LLM call, but not the tool dispatch, not the MCP server round-trip, not the sub-agent. You guess. Eventually you find: one MCP server occasionally hangs on a cold-start.

Without end-to-end tracing, you cannot find this. OTel GenAI fixes it.

The conventions settled in 2025-2026 under the OpenTelemetry semantic-conventions group. They define stable attribute names so Datadog, Langfuse, Phoenix, OpenLLMetry, and AgentOps all parse the same spans. Instrument once; ship to any backend.

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

The whole thing nests under one trace id. Span ids link the parent-child relationships.

### Required attributes

Per the 2025-2026 semconv:

- `gen_ai.operation.name` — `"chat"`, `"text_completion"`, `"embeddings"`, `"execute_tool"`, `"invoke_agent"`.
- `gen_ai.provider.name` — `"openai"`, `"anthropic"`, `"google"`, `"azure_openai"`.
- `gen_ai.request.model` — requested model string (e.g. `"gpt-4o-2024-08-06"`).
- `gen_ai.response.model` — the model actually served.
- `gen_ai.usage.input_tokens` / `gen_ai.usage.output_tokens`.
- `gen_ai.response.id` — provider response id for correlation.

For tool spans:

- `gen_ai.tool.name` — tool identifier.
- `gen_ai.tool.call.id` — the specific call id.
- `gen_ai.tool.description` — tool description (optional).

For agent spans:

- `gen_ai.agent.name` / `gen_ai.agent.id` / `gen_ai.agent.description`.

### Span kinds

- `SpanKind.CLIENT` for calls crossing a process boundary (LLM provider, MCP server).
- `SpanKind.INTERNAL` for the agent's own loop steps and tool execution.

### Opt-in content capture

By default, spans carry metrics and timing — not prompts or completions. Large payloads and PII are off by default. Set `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental` and specific content-capture env vars to include content. Review carefully before enabling in prod.

### Events on spans

Token-level events can be added as span events:

- `gen_ai.content.prompt` — input messages.
- `gen_ai.content.completion` — output messages.
- `gen_ai.content.tool_call` — tool call as recorded.

Events time-order within a span for detailed replay.

### Exporters

OTel spans export to:

- **Jaeger / Tempo.** OSS, on-prem.
- **Langfuse.** LLM-observability-specific; visualizes token usage.
- **Arize Phoenix.** Evals + tracing combined.
- **Datadog.** Commercial; natively parses `gen_ai.*` attributes.
- **Honeycomb.** Column-oriented; query-friendly.

All speak OTLP, the wire format. Your code does not care.

### Propagation across MCP

When an MCP client calls a server, inject the W3C traceparent header into the request. Streamable HTTP supports standard headers. Stdio does not carry HTTP headers natively; the spec's 2026 roadmap discusses adding a `_meta.traceparent` field on JSON-RPC calls.

Until that ships: include the traceparent in the `_meta` of every request manually. Server logs the trace id.

### Metrics

Alongside spans, the GenAI semconv defines metrics:

- `gen_ai.client.token.usage` — histogram.
- `gen_ai.client.operation.duration` — histogram.
- `gen_ai.tool.execution.duration` — histogram.

Use these for dashboards that do not need per-call detail.

### AgentOps layer

AgentOps (founded 2024) specializes in GenAI observability. It wraps popular frameworks (LangGraph, Pydantic AI, CrewAI) to emit OTel spans automatically. Useful if your stack uses a supported framework; use manual instrumentation otherwise.

## Use It

`code/main.py` emits OTel-shaped spans to stdout (in OTLP-JSON-like format) for an agent that calls an LLM, dispatches two tools, and makes one MCP round-trip. No real exporter — the lesson focuses on the span shape and attribute set. Paste the output into an OTLP-compatible viewer or just read it.

What to look at:

- Trace id is shared across all spans.
- Parent-child links are encoded via `parentSpanId`.
- Required `gen_ai.*` attributes are populated.
- Content capture is off by default; one scenario turns it on via env var.

## Ship It

This lesson produces `outputs/skill-otel-genai-instrumentation.md`. Given an agent codebase, the skill produces an instrumentation plan: where to add spans, which attributes to populate, and which exporters to target.

## Exercises

1. Run `code/main.py`. Count the spans and identify which is CLIENT vs INTERNAL.

2. Turn on content capture (env var) and confirm `gen_ai.content.prompt` and `gen_ai.content.completion` events appear. Note the implications for PII.

3. Add the tool-execution metric `gen_ai.tool.execution.duration` and emit it as a histogram sample per call.

4. Propagate a traceparent from a parent agent span into an MCP request's `_meta.traceparent` field. Verify the MCP server would see the same trace id.

5. Read the OTel GenAI semconv spec. Identify one attribute listed in the semconv that this lesson's code does NOT emit. Add it.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| OTel | "OpenTelemetry" | Open standard for traces, metrics, logs |
| GenAI semconv | "GenAI semantic conventions" | Stable attribute names for LLM / tool / agent spans |
| `gen_ai.*` | "The attribute namespace" | All GenAI attributes share this prefix |
| Span | "Timed operation" | A unit of work with a start, end, and attributes |
| Trace | "Cross-span ancestry" | Tree of spans sharing a trace id |
| SpanKind | "CLIENT / SERVER / INTERNAL" | Hints about span direction |
| OTLP | "OpenTelemetry Line Protocol" | Wire format for exporters |
| Opt-in content | "Prompt / completion capture" | Off by default; env var to enable |
| traceparent | "W3C header" | Propagates trace context across services |
| Exporter | "Backend-specific shipper" | Component that sends spans to Jaeger / Datadog / etc. |

## Further Reading

- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — canonical conventions for GenAI spans, metrics, and events
- [OpenTelemetry — GenAI spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-spans/) — LLM and tool-execution span attribute list
- [OpenTelemetry — GenAI agent spans](https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/) — agent-level `invoke_agent` span
- [open-telemetry/semantic-conventions — GenAI spans](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md) — GitHub-hosted source of truth
- [Datadog — LLM OTel semantic convention](https://www.datadoghq.com/blog/llm-otel-semantic-convention/) — production integration walkthrough
