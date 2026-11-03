---
id: trace-context-over-stdio
title: One trace across HTTP and stdio tool servers
card: production-mlops
kind: design
level: 3
roles: [ai-evaluation-reliability-engineer, inference-engineer]
rounds: [system-design, debugging]
tags: [tracing, mcp, traceparent, propagation]
minutes: 12
lessons: [phases/13-tools-and-protocols/20-opentelemetry-genai]
manuals: []
practice: []
cheatsheet: [genai-observability]
related: [production-mlops/span-kind-client-or-internal, production-mlops/read-this-span]
updated: 2026-11-03
---

Your agent uses three tool servers over the MCP protocol. Two of them speak streamable HTTP, and one runs as a local subprocess over stdio. Design how a single trace id reaches all three, and say what each server has to do when it arrives.

## Short answer

For the HTTP servers, inject the W3C `traceparent` header into every request, as any traced HTTP client does. The stdio transport has no headers, so put the same value into the `_meta` field of each JSON-RPC request until the protocol adds a standard field for it. Each server reads the value, opens its own span as a child of that context, writes the trace id into its logs, and passes the context on if it calls anything else.

## Full answer

### Why this is worth the work

The lesson opens with a report from production: the agent sometimes answers in 3 seconds and sometimes in 30. The logs show the model calls and nothing else. The cause was one tool server that hung during its cold start, and nothing short of an end-to-end trace could show it.

### The HTTP servers

Streamable HTTP carries standard headers. The client injects `traceparent`, and the server starts a span under that parent. On the client side the call is a CLIENT span under the `execute_tool` span. On the server side the work is a child of the same trace. The gap between the two is the transport time.

### The stdio server

Stdio carries no HTTP headers. The protocol roadmap discusses a `_meta.traceparent` field on JSON-RPC calls. Until it ships, include the `traceparent` value in `_meta` on every request yourself, and have the server read it from there. The server logs the trace id so that a log line and a span can be joined later.

### What every server does with the context

1. Parse the context from the header or from `_meta`.
2. Start a span as a child of that context, not a new trace.
3. Write the trace id into every log line of the request.
4. Propagate the context to anything it calls in turn.

### What you can see afterwards

One waterfall: the agent step, the tool call, the server's work. A hang appears as one long server span under a long client span. Beside the spans, emit the tool execution duration histogram per tool, which answers the dashboard questions without a trace.

## Follow-ups

- **Level 3:** A server ignores the `_meta` field. What do you see in the trace? Expected: the server's work shows up as a separate trace or not at all, and the client span shows the duration but not where the time went.
- **Level 3:** Which span records the hang, the client span or the server span? Expected: both. The client span shows the wait from the agent's side, the server span shows what the server did, and the gap between them is the transport.
- **Level 4:** Another team operates one tool server. What do you ask them to commit to? Expected: accept the context from headers or `_meta`, continue the trace instead of starting one, log the trace id, and export spans to a backend that both teams can read.

## Wrong answers

- "Log a request id and join the logs later." A request id has no parent-child structure and no timing. A trace has both.
- "The stdio server is local, so it does not need tracing." The hang in the lesson was in a local server's cold start. Local does not mean fast.
- "Put the trace id into the prompt so the model carries it." The model is not a transport, and a changing value in the prompt also breaks the prefix cache.

## Taught in

The [OpenTelemetry GenAI lesson](../../../phases/13-tools-and-protocols/20-opentelemetry-genai/) covers propagation across the MCP transports and the tool duration metric.
