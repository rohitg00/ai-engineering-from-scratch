---
id: span-kind-client-or-internal
title: Which agent spans are CLIENT and which are INTERNAL
card: production-mlops
kind: concept
level: 1
roles: [ai-evaluation-reliability-engineer, inference-engineer, ai-data-engineer]
rounds: [screen, ml-breadth]
tags: [opentelemetry, tracing, spans, genai-conventions]
minutes: 5
lessons: [phases/13-tools-and-protocols/20-opentelemetry-genai, phases/14-agent-engineering/23-otel-genai-conventions]
manuals: []
practice: []
cheatsheet: [genai-observability]
related: [production-mlops/read-this-span, production-mlops/trace-context-over-stdio]
updated: 2026-11-03
---

You add tracing to an agent. In one run it calls a model API twice, runs two tools inside its own process and sends one request to a tool server on another machine. Which of these operations get a CLIENT span, which get an INTERNAL span, and why does anyone care?

## Short answer

A call that leaves the process gets a CLIENT span: the two model API calls and the request to the remote tool server. The agent loop step and a tool that runs in your own process get INTERNAL spans. The kind tells a backend the direction of each call, so it can show which operations left the process and which did not.

## Full answer

### The tree for this run

```text
invoke_agent            INTERNAL
 ├── chat               CLIENT
 ├── execute_tool       INTERNAL
 │    └── remote call   CLIENT
 ├── execute_tool       INTERNAL
 └── chat               CLIENT
```

Every span shares one trace id. Each child carries the id of its parent. That is what makes the run one tree instead of six loose records.

### The rule

CLIENT marks a call across a process boundary: a model provider, a tool server, a hosted agent service. INTERNAL marks the agent's own loop steps and any tool that runs in the same process. The conventions apply the same rule to the agent span itself: an agent that runs as a remote service is CLIENT from the caller, and an in-process agent framework is INTERNAL.

### The attributes that go with each kind

| Span | Attributes |
|---|---|
| model call | `gen_ai.operation.name`, `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `gen_ai.response.id` |
| tool call | `gen_ai.tool.name`, `gen_ai.tool.call.id` |
| agent run | `gen_ai.agent.name`, `gen_ai.agent.id` |

### Why it matters

Backends draw a waterfall from the kinds and the parent links. A CLIENT span with no response id cannot be matched to the provider log. A tool span with no parent is an orphan, and you can no longer see which agent step caused the call.

## Follow-ups

- **Level 1:** What joins the spans into one tree? Expected: one shared trace id, and a parent span id on every child.
- **Level 2:** The agent calls a hosted agent service instead of a local one. What kind is that span? Expected: CLIENT, because the agent runs in another process.
- **Level 2:** Which attribute lets a dashboard split cost by provider? Expected: `gen_ai.provider.name`, and multi-provider dashboards break when it is missing.
- **Level 3:** A sub-agent runs inside the same process. Does it start a new trace? Expected: no. It is a child span under the parent agent span, so the whole run stays in one trace.

## Wrong answers

- "Every tool call is a CLIENT span." A tool that runs in your process is INTERNAL. Only the call that leaves the process is CLIENT.
- "The kind is decoration." Backends read the kind to show direction, and the conventions set it per span category.
- "Start a new trace for each tool call, for isolation." Separate traces lose the parent link, so you cannot see which step caused the call.

## Taught in

The [OpenTelemetry GenAI lesson](../../../phases/13-tools-and-protocols/20-opentelemetry-genai/) draws the span hierarchy, and the [conventions lesson](../../../phases/14-agent-engineering/23-otel-genai-conventions/) names the span categories and their kinds.
