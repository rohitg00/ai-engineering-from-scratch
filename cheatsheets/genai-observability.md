---
id: genai-observability
title: OpenTelemetry GenAI and Agent Observability
code: OG
subtitle: Emit gen_ai.* spans, sample traces, export metrics, pick a platform and debug a trace. Stdlib code from the lessons.
hue: 25
sources: phases/13-tools-and-protocols/20-opentelemetry-genai, phases/14-agent-engineering/23-otel-genai-conventions, phases/14-agent-engineering/24-agent-observability-platforms, phases/17-infrastructure-and-production/13-llm-observability, phases/19-capstone-projects/11-llm-observability-dashboard, phases/19-capstone-projects/28-observability-otel-traces, projects/agent-trace-debugger
source_hash: 413430fbc0d5ea57
---

## Agent span hierarchy
type: architecture
from: phases/13-tools-and-protocols/20-opentelemetry-genai/docs/en.md, phases/13-tools-and-protocols/20-opentelemetry-genai/code/main.py

```arch
node | agent | 1,1 | agent.invoke_agent | INTERNAL, root span | process
node | llm | 2,1 | llm.chat | CLIENT, LLM provider | model
node | tool | 2,2 | tool.execute | INTERNAL | process
node | mcp | 3,2 | mcp.call | CLIENT, traceparent | process
node | sub | 2,3 | subagent.invoke | INTERNAL | process
node | exp | 3,1 | Exporter | OTLP to any backend | store
edge | agent | llm | parentSpanId
edge | agent | tool | parentSpanId
edge | tool | mcp | _meta.traceparent
edge | agent | sub | parentSpanId
edge | llm | exp | spans
```

## Attributes to set
type: concepts
from: phases/13-tools-and-protocols/20-opentelemetry-genai/docs/en.md, phases/14-agent-engineering/23-otel-genai-conventions/docs/en.md

- **`gen_ai.operation.name`**: `chat`, `embeddings`, `execute_tool`, `invoke_agent`.
- **`gen_ai.provider.name`**: `openai`, `anthropic`, `aws.bedrock`, `google.vertex`.
- **`gen_ai.request.model`**: the model that you ask for.
- **`gen_ai.response.model`**: the model that served the call. Routing can change it.
- **`gen_ai.usage.input_tokens`**: tokens in. `gen_ai.usage.output_tokens` gives tokens out.
- **`gen_ai.response.id`**: the provider response id for correlation.
- **`gen_ai.tool.name`**: the tool. `gen_ai.tool.call.id` names one call.
- **`gen_ai.data_source.id`**: the corpus or store that a RAG step read.

## Instrument in code
type: task-table
from: phases/13-tools-and-protocols/20-opentelemetry-genai/code/main.py, phases/14-agent-engineering/23-otel-genai-conventions/code/main.py, phases/19-capstone-projects/28-observability-otel-traces/code/main.py, phases/17-infrastructure-and-production/13-llm-observability/code/main.ts

| Task | Code |
|---|---|
| Start a child span | `start_span(name, kind, parent=root)` |
| Build a traceparent | `f"00-{mcp_span.trace_id}-{mcp_span.span_id}-01"` |
| Store content as a reference | `tracer.add_content(chat, key, prompt)` |
| Wrap work in a span | `with builder.span(name, attributes=..., parent=...)` |
| Write one span per line | `JSONLExporter(path=trace_path)` |
| Count tool calls | `metrics.counter("tools_called_total")` |
| Render Prometheus text | `prometheus_exposition(registry)` |
| Sample in an exporter | `makeSamplingExporter(consoleExporter, 0.05)` |

## Span builder with metrics
type: annotated-code
lang: python
from: phases/19-capstone-projects/28-observability-otel-traces/code/main.py, phases/19-capstone-projects/28-observability-otel-traces/docs/en.md

```python
metrics = MetricsRegistry()
builder = SpanBuilder(exporters=[jsonl, in_mem], metrics=metrics)
with builder.span("gen_ai.chat", attributes={GEN_AI_SYSTEM: "anthropic",
        GEN_AI_OPERATION_NAME: "chat"}, kind="CLIENT") as chat_span:
    chat_span.attributes[GEN_AI_USAGE_INPUT_TOKENS] = 412
    with builder.span("gen_ai.tool.execution", parent=chat_span,
            attributes={GEN_AI_TOOL_NAME: "read_file"}) as tool1:
        tool1.attributes[GEN_AI_TOOL_RESULT_BYTES] = 1024
print(prometheus_exposition(metrics))  # tools_called_total, tool_latency_ms
```

## Run the lessons
type: command-table
from: phases/13-tools-and-protocols/20-opentelemetry-genai/code/main.py, phases/14-agent-engineering/23-otel-genai-conventions/docs/en.md, phases/19-capstone-projects/28-observability-otel-traces/docs/en.md, phases/19-capstone-projects/11-llm-observability-dashboard/code/ts/README.md, phases/19-capstone-projects/11-llm-observability-dashboard/docs/en.md

| Command | What it does |
|---|---|
| `python code/main.py` | Lesson 13.20 prints the spans of one trace |
| `OTEL_CAPTURE_CONTENT=1 python code/main.py` | Adds prompt and completion events |
| `python3 code/main.py` | Lesson 14.23 prints a span tree and the content store |
| `python3 -m pytest code/tests/ -v` | Lesson 19.28 checks round trip and buckets |
| `npm start` | Seeds 1200 synthetic spans, prints the rollup |
| `npm run serve` | Serves ingest and dashboard on `PORT` |

## Debug a trace: agent-trace-debugger
type: flow
from: projects/agent-trace-debugger/solution/main.ts, projects/agent-trace-debugger/solution/cli.ts, projects/agent-trace-debugger/project.json

1. **`parseTrace`**: one JSON object per line. A bad line stops with its line number.
2. **`validateTree`**: rejects a duplicate id, a cycle, a missing parent, a child outside its parent.
3. **`unionDuration`**: merges overlapping child intervals. It does not sum them.
4. **`analyze`**: exclusive time is inclusive time minus the child union.
5. **`analyze`**: `slowest` names the span with the greatest exclusive time.
6. **`render`**: writes standalone HTML with escaped names and error coloring.
7. **cli.ts**: `--baseline` adds `wall_time_delta_ms`, `token_delta`, `error_delta`.

## Trace debugger commands
type: annotated-code
lang: bash
from: projects/agent-trace-debugger/README.md, projects/agent-trace-debugger/solution/cli.ts

```bash
python3 scripts/project_test.py agent-trace-debugger --init learning-artifacts/agent-trace-debugger
python3 scripts/project_test.py agent-trace-debugger --stage 1 --path learning-artifacts/agent-trace-debugger --strict
python3 scripts/project_test.py agent-trace-debugger --all --solution --strict
node cli.ts --input samples/trace.jsonl --baseline samples/before.jsonl --output trace.html --json trace.json
node cli.ts --format otlp --input samples/otlp.json --output otlp-trace.html --json otlp-trace.json
```

## Defaults and numbers
type: defaults
from: phases/13-tools-and-protocols/20-opentelemetry-genai/code/main.py, phases/19-capstone-projects/11-llm-observability-dashboard/code/main.py, phases/19-capstone-projects/11-llm-observability-dashboard/code/ts/src/spans.ts, phases/19-capstone-projects/11-llm-observability-dashboard/code/ts/src/index.ts, phases/19-capstone-projects/28-observability-otel-traces/docs/en.md, phases/17-infrastructure-and-production/13-llm-observability/code/main.ts, projects/agent-trace-debugger/solution/cli.ts, projects/agent-trace-debugger/README.md

| Setting | Default | Note |
|---|---|---|
| `OTEL_CAPTURE_CONTENT` | `"0"` | Set 1 to capture prompt and completion |
| `TailSampler` `sample_rate` | `0.10` | Errors and PII evals are always kept |
| `ObservabilityStore` capacity | `10_000` | Ring buffer of spans |
| `PORT` | `8011` | Set `SERVE=1` to start the HTTP server |
| High-cost span | `totalTokens > 8000` | Always kept by the sampling exporter |
| `--format` | `jsonl` | Also `otlp`. Baseline files stay JSONL |
| `--output` | `trace.html` | `--json` writes the report file |

## Troubleshooting
type: troubleshooting
from: phases/14-agent-engineering/23-otel-genai-conventions/docs/en.md, phases/14-agent-engineering/24-agent-observability-platforms/docs/en.md, phases/17-infrastructure-and-production/13-llm-observability/docs/en.md, phases/13-tools-and-protocols/20-opentelemetry-genai/docs/en.md, projects/agent-trace-debugger/solution/main.ts, projects/agent-trace-debugger/README.md

| Symptom | Cause | Fix |
|---|---|---|
| PII and secrets in traces | Full prompts captured in spans | Store content outside, put reference IDs on spans |
| Multi-provider dashboard breaks | No `gen_ai.provider.name` | Set it on every LLM span |
| Orphaned tool spans | Spans without parent links | Always propagate context |
| Attributes renamed on upgrade | No stability opt-in | Set `OTEL_SEMCONV_STABILITY_OPT_IN` |
| MCP server not in the trace | Stdio carries no HTTP headers | Put traceparent in `_meta` of each request |
| Cannot bisect a regression | Prompt versions not tied to traces | Record the prompt version on the trace |
| `child outside parent` | Child interval exceeds the parent | Normalize clocks before import |

## Pick a platform
type: comparison
from: phases/14-agent-engineering/24-agent-observability-platforms/docs/en.md, phases/17-infrastructure-and-production/13-llm-observability/docs/en.md

| Factor | Langfuse | Phoenix | Opik |
|---|---|---|---|
| License | MIT | Elastic License 2.0 | Apache 2.0 |
| Strongest for | Prompt management, sessions | RAG relevancy, drift | Optimization, guardrails |
| Prompt versioning | Yes | No | A/B experiments |
| Free tier | 50K events/month | Self-host | Self-host or cloud |
| Use it when | All-in-one with prompts | Deep RAG eval and drift | Automated optimization |

## Questions
type: qa
from: phases/13-tools-and-protocols/20-opentelemetry-genai/docs/en.md, phases/14-agent-engineering/23-otel-genai-conventions/docs/en.md, phases/17-infrastructure-and-production/13-llm-observability/docs/en.md, phases/19-capstone-projects/11-llm-observability-dashboard/docs/en.md, phases/14-agent-engineering/24-agent-observability-platforms/docs/en.md

- **CLIENT or INTERNAL?** CLIENT crosses a process boundary. INTERNAL is the agent loop and tool execution.
- **Which `invoke_agent` kind?** CLIENT for remote agent services. INTERNAL for in-process frameworks.
- **What do I keep at scale?** 100% errors, 100% high-cost, 5% success.
- **When is drift real?** PSI above 0.2 typically signals meaningful drift.
- **Is tracing enough?** No. Tracing without evaluation is just expensive logging.
- **Which metrics are histograms?** `gen_ai.client.token.usage`, `gen_ai.client.operation.duration`, `gen_ai.tool.execution.duration`.
