# Evidence: cheatsheets/genai-observability.md

Abbreviations: A = phases/13-tools-and-protocols/20-opentelemetry-genai, B = phases/14-agent-engineering/23-otel-genai-conventions, C = phases/14-agent-engineering/24-agent-observability-platforms, D = phases/17-infrastructure-and-production/13-llm-observability, E = phases/19-capstone-projects/11-llm-observability-dashboard, F = phases/19-capstone-projects/28-observability-otel-traces, P = projects/agent-trace-debugger. d = docs/en.md, c = code/main.py.

## Agent span hierarchy (architecture, 6 nodes, 5 edges)
- agent.invoke_agent INTERNAL root: A/d:30, A/c:117
- llm.chat CLIENT: A/d:31, A/d:63, A/c:123
- tool.execute INTERNAL: A/d:32, A/d:64, A/c:132
- mcp.call CLIENT with traceparent: A/d:33, A/c:102, 109-110
- subagent.invoke INTERNAL: A/d:35
- Exporter, OTLP wire format to any backend: A/d:82-90
- parentSpanId links parent and child: A/d:38, A/d:123, A/c:56
- _meta.traceparent on MCP requests: A/d:94-96

## Attributes to set (concepts, 8)
- gen_ai.operation.name values chat, embeddings, execute_tool, invoke_agent: A/d:44
- gen_ai.provider.name values openai, anthropic, aws.bedrock, google.vertex: B/d:38
- gen_ai.request.model: A/d:46, B/d:39
- gen_ai.response.model, can differ due to routing: A/d:47, B/d:40
- gen_ai.usage.input_tokens / output_tokens: A/d:48
- gen_ai.response.id for correlation: A/d:49
- gen_ai.tool.name, gen_ai.tool.call.id: A/d:53-54
- gen_ai.data_source.id for RAG corpus or store: B/d:43

## Instrument in code (task-table, 8)
- start_span(name, kind, parent=...): A/c:67, 123
- traceparent f-string: A/c:109
- tracer.add_content(chat, key, prompt): B/c:66, 124
- with builder.span(name, attributes, parent): F/c:336-342, 422-424
- JSONLExporter(path=trace_path): F/c:395
- metrics.counter("tools_called_total"): F/c:377-378
- prometheus_exposition(registry): F/c:274
- makeSamplingExporter(consoleExporter, 0.05, ...): D/code/main.ts:320

## Span builder with metrics (annotated-code, 10 lines)
- metrics = MetricsRegistry(): F/c:396
- builder = SpanBuilder(exporters=[jsonl, in_mem], metrics=metrics): F/c:398
- gen_ai.chat span, GEN_AI_SYSTEM anthropic, GEN_AI_OPERATION_NAME chat, kind CLIENT: F/c:405-414
- GEN_AI_USAGE_INPUT_TOKENS = 412: F/c:417
- gen_ai.tool.execution child, parent=chat_span, read_file: F/c:422-427
- GEN_AI_TOOL_RESULT_BYTES = 1024: F/c:431
- print(prometheus_exposition(metrics)): F/c:492
- tools_called_total and tool_latency_ms metrics: F/c:377-381, F/d:48

## Run the lessons (command-table, 6)
- python code/main.py: A/c:11
- OTEL_CAPTURE_CONTENT=1 python code/main.py adds content events: A/c:8-9, 86-88, 173
- python3 code/main.py prints span tree and external store: B/d:89-93
- python3 -m pytest code/tests/ -v, round trip and bucket counts: F/d:99, 102
- npm start seeds 1200 synthetic spans: E/code/ts/README.md:26
- npm run serve on PORT: E/code/ts/README.md:27

## Debug a trace: agent-trace-debugger (flow, 7 steps)
1. parseTrace, one object per line, error with line number: P/solution/main.ts:20-42, P/project.json:49
2. validateTree errors duplicate span id, span cycle, missing parent, child outside parent: P/solution/main.ts:44-63
3. unionDuration merges overlaps, union not sum: P/solution/main.ts:65-85, P/project.json:87
4. exclusive = inclusive minus child union: P/solution/main.ts:92-95
5. slowest by greatest exclusive: P/solution/main.ts:104-107, P/project.json:87
6. render standalone HTML, escape, error coloring: P/solution/main.ts:110-131, P/project.json:106
7. --baseline adds wall_time_delta_ms, token_delta, error_delta: P/solution/cli.ts:28-35

## Trace debugger commands (annotated-code, 5 lines)
- --init: P/README.md:12
- --stage 1 --strict: P/README.md:13
- --all --solution --strict: P/README.md:31
- node cli.ts --input ... --baseline ... --output trace.html --json trace.json: P/README.md:21, 33
- node cli.ts --format otlp ...: P/README.md:66

## Defaults and numbers (defaults, 7)
- OTEL_CAPTURE_CONTENT default "0": A/c:25
- TailSampler sample_rate 0.10, keeps errors and PII evals: E/c:48-61
- ObservabilityStore capacity 10_000: E/code/ts/src/spans.ts:106
- PORT 8011, SERVE=1: E/code/ts/src/index.ts:109-117
- totalTokens > 8000 high cost, always kept: D/code/main.ts:134-138
- --format default jsonl, also otlp, baseline stays JSONL: P/solution/cli.ts:8, 18-19, P/README.md:66, P/API.md:5
- --output default trace.html, --json: P/solution/cli.ts:10-11, 37-38

## Troubleshooting (troubleshooting, 7)
- full prompts in spans, store externally: B/d:55, 69
- no gen_ai.provider.name: B/d:70
- orphaned tool spans, propagate context: B/d:71
- no stability opt-in, attributes renamed: B/d:72, 59-63
- stdio has no HTTP headers, traceparent in _meta: A/d:94-96
- prompt versions not tied to traces, cannot bisect: C/d:64
- child outside parent error, normalize clocks: P/solution/main.ts:59-60, P/README.md:46

## Pick a platform (comparison, 5 rows)
- Licenses MIT, Elastic License 2.0, Apache 2.0: C/d:23, 30, 38
- Strongest for: C/d:28, 36, 44
- Prompt versioning yes, no, A/B experiments: C/d:26, 35, 40
- Langfuse 50K events/month free cloud: D/d:36, 97. Phoenix self-host: D/d:42. Opik self-hosted or cloud: C/d:91
- Use it when, from picking table: C/d:52-56

## Questions (qa, 6)
- CLIENT vs INTERNAL: A/d:63-64
- invoke_agent CLIENT remote, INTERNAL in-process: B/d:32-34
- 100% errors, 100% high-cost, 5% success: D/d:93
- PSI > 0.2 signals meaningful drift: E/d:132
- tracing without evaluation is expensive logging: C/d:62
- histogram metrics: A/d:102-104
