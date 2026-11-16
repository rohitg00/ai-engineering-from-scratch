# OpenTelemetry spans, with LangSmith off

> Trace model and tool calls with your own OpenTelemetry spans, count tokens from provider usage, and confirm that LangSmith receives nothing unless its flag is true.

A customer says the assistant was slow and wrong at 10:42. You need the model calls of that run, their token counts, the tool that timed out, and the log lines, joined by one id. Your data cannot leave your network, so a hosted tracer is out.

When you finish this section, you can add three kinds of spans to an agent and join them to your logs. You can find the model calls that those spans miss, and prove that no trace goes to LangSmith.

## Three spans

**Span:** one timed operation with a name, attributes, a status, and a parent. The service makes three kinds. `agent.run` wraps one run in the run task of [section 9.1](#s-the-run-endpoint-and-its-stream). A middleware makes `model.call` around each model call and `tool.<name>` around each tool attempt.

```listing
title: the span around each model call
source: capture/lab/prodapp-mac/code/app/middleware.py
lang: python
---
class Tracing(AgentMiddleware):
    async def awrap_model_call(self, request, handler):
        with tracer.start_as_current_span("model.call") as span:
            span.set_attribute("gen_ai.request.model", model_id(request.model))
            span.set_attribute("gen_ai.request.message_count", len(request.messages))
            response = await handler(request)
            message = response.result[-1]
            usage = message.usage_metadata or {}
            span.set_attribute("gen_ai.response.model", message.response_metadata.get("model_name", ""))
            span.set_attribute("gen_ai.usage.input_tokens", usage.get("input_tokens", 0))
            span.set_attribute("gen_ai.usage.output_tokens", usage.get("output_tokens", 0))
            span.set_attribute("gen_ai.response.tool_calls", len(message.tool_calls))
            return response
```

The attribute names follow the OpenTelemetry conventions for generative AI. The token counts are the provider's own. For Ollama they are `prompt_eval_count` and `eval_count`, counted by the model's tokenizer. For Anthropic they are the `usage` of the response.

**We measured** whether Ollama reports the full prompt when the prompt is already in its cache, on the Mac. Three identical calls to Qwen3 4B each reported a `prompt_eval_count` of 65. The prompt evaluation took 1401.9 ms the first time, which included loading the model, and 68.6 and 28.7 ms after that. So the count is the prompt length, and a cache hit shows only in the time.

The exporter writes one JSON line per span to a file. A collector or any OTLP exporter can take its place without a change to the middleware.

```listing
title: one model.call span from a Qwen3 14B run
source: capture/lab/prodapp-mac/runs/suite/qwen3-14b/rep-1/test-spans.jsonl
lang: json
note: The first model.call span of the file, on one line.
---
{"name": "model.call", "context": {"trace_id": "0xc31ff4d300b6481cedfbf16e6295dbf5", "span_id": "0x2d0efd6deeee8df4", "trace_state": "[]"}, "kind": "SpanKind.INTERNAL", "parent_id": "0x37bcefff7e3ac78d", "start_time": "2026-11-15T10:28:39.576564Z", "end_time": "2026-11-15T10:28:42.578468Z", "status": {"status_code": "UNSET"}, "attributes": {"gen_ai.request.model": "qwen3:14b", "gen_ai.request.message_count": 1, "gen_ai.response.model": "qwen3:14b", "gen_ai.usage.input_tokens": 454, "gen_ai.usage.output_tokens": 22, "gen_ai.response.tool_calls": 1}, "events": [], "links": [], "resource": {"attributes": {"telemetry.sdk.language": "python", "telemetry.sdk.name": "opentelemetry", "telemetry.sdk.version": "1.45.2", "service.instance.id": "a07d9619-8c5e-4163-a075-4db5bf1372bf", "service.name": "support-assistant"}, "schema_url": ""}}
```

## What the spans held

**We measured** the spans of the first Qwen3 14B suite run on the Mac. The file held 234 spans: 34 `agent.run`, 65 `model.call`, 36 tool spans, and 99 HTTP request spans. Each of the 65 `model.call` spans had an `agent.run` as its parent. Seven spans had status `ERROR`, and each matched an injected fault. They were one `search_faq`, three `read_order` timeouts, one `create_ticket`, and two primary model calls.

FastAPI 0.162.7 adds its own spans, one per request, through the global tracer provider. The service turns off its operation spans with `telemetry={"operation_spans": False}`, and the request spans stay. They are useful: a slow `POST /threads/{thread_id}/runs` and its `agent.run` share a trace id.

## The model calls that the spans miss

`SummarizationMiddleware` calls the model from its own hook, outside `awrap_model_call`. So no `model.call` span wraps it {{code libs/langchain_v1/langchain/agents/middleware/summarization.py:520-557}}, and a cost report built from spans leaves it out.

The service also records every model call through a LangChain callback, with the provider usage and the name of the span that was current. **We measured** the 20 evals of Claude Haiku 5.5 that way and against the Anthropic usage in our cost ledger. The ledger had 64 calls and 76,076 input tokens, and the callback log had the same 64 calls and the same total. Excluding the outage case, whose calls went to the backup model, the `model.call` spans held 60,354 of those tokens.

The other 15,722 tokens came from two places. The summarizer made 3 calls with 3,966 input tokens, in the six-turn thread and the runaway loop. In the runaway case the test middleware replaced each model reply after the call. So the spans recorded 0 tokens for 8 billed calls with 11,756 input tokens. That second gap comes from the test. The first one is in every run of a summarizing agent.

```figure
id: fig-9-4
kind: chart
title: input tokens per conversation, inside model.call spans and outside them
claim: The model.call spans held 60,354 of 76,076 billed input tokens, and the summarizer calls and the replaced replies made up the rest.
caption: Each bar is one eval conversation with Claude Haiku 5.5, by case number. Plum is input tokens inside model.call spans, and rose is billed tokens outside them. Case 9 calls no model, and case 16 used only the backup. From capture/lab/prodapp-mac/summary/cost-mac.json.
```

## Logs that carry the trace id

Each log line is JSON, and the formatter adds the trace id and the span id of the current span. The lines below are one run of the hung-tool case on Qwen3 14B. The `tool.error` line has the span id of `agent.run` and not of a tool span. `ToolErrorMiddleware` writes it outside the retry, after the last tool span has ended. Join log lines to tool spans by the trace id.

```listing
title: two log lines of one run, joined to its spans by trace_id
source: capture/lab/prodapp-mac/runs/suite/qwen3-14b/rep-1/test-log.jsonl
lang: json
---
{"ts": 1794738671.926, "level": "INFO", "event": "run.start", "thread_id": "7d6ee462-aeeb-43be-bdc1-320a22f92ee8", "user_id": "e14", "trace_id": "f3619cebe3ac7755ec6e9392b2581a61", "span_id": "5226b37abac5ab4b"}
{"ts": 1794738678.029, "level": "INFO", "event": "tool.error", "tool": "read_order", "error": "TimeoutError", "trace_id": "f3619cebe3ac7755ec6e9392b2581a61", "span_id": "5226b37abac5ab4b"}
```

## LangSmith off

LangChain sends runs to LangSmith when `LANGSMITH_TRACING` is true. We pointed `LANGSMITH_ENDPOINT` at a local recorder and gave a dummy key, so that any upload would show up as a request. Then we ran one conversation with the flag `true`, with it `false`, and with it unset. Each conversation asked a FAQ question, asked for a refund with the amount and the reason, and rejected the approval.

**We measured** it once per setting on the Mac with Qwen3 4B. The model called `search_faq` and `refund_order` in all three conversations.

| `LANGSMITH_TRACING` | Requests to the recorder | Bytes | Paths |
|---|---|---|---|
| `true` | 10 | 337,363 | `/info`, `/runs/multipart` |
| `false` | 0 | 0 | none |
| unset | 0 | 0 | none |

The control run proves that the recorder would see an upload: 10 requests and 337,363 bytes for one short conversation. The two other settings sent nothing. A key in the environment is not enough to send data. The flag is.

```takeaways
- Wrap model calls and tool attempts in your own spans, with gen_ai token attributes.
- Take token counts from provider usage, and record calls outside your spans too.
- Put the trace id and span id on every log line.
- Leave LANGSMITH_TRACING unset in production, and test that a recorder receives nothing.
```

Sources: capture/lab/prodapp-mac/code/app/middleware.py, capture/lab/prodapp-mac/code/app/telemetry.py, capture/lab/prodapp-mac/code/app/usage.py, capture/lab/prodapp-mac/code/app/server.py, capture/lab/prodapp-mac/code/scripts/service_real.py, capture/lab/prodapp-mac/code/tests/test_smith_off.py, capture/lab/prodapp-mac/runs/suite/qwen3-14b/rep-1/test-spans.jsonl, capture/lab/prodapp-mac/runs/suite/qwen3-14b/rep-1/test-log.jsonl, capture/lab/prodapp-mac/runs/suite/qwen3-14b/rep-1/usage.jsonl, capture/lab/prodapp-mac/runs/service/service-properties.json, capture/lab/prodapp-mac/runs/ollama-cache-probe.txt, capture/lab/prodapp-mac/runs/suite/haiku/rep-1/usage.jsonl, capture/lab/prodapp-mac/code/scripts/cost_real.py, capture/lab/prodapp-mac/summary/cost-mac.json, capture/lab/prodapp-mac/summary/service-mac.json; libs/langchain_v1/langchain/agents/middleware/summarization.py at langchain==1.5.0.
