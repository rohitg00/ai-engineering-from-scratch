---
id: production-llm-app
title: Shipping a Production LLM App
code: SP
subtitle: Request pipeline, retries, fallback chains, SSE streams, resume, demo limits and a fallback gateway.
hue: 15
sources: phases/11-llm-engineering/13-production-app, phases/17-infrastructure-and-production/29-model-demo-interfaces, projects/streaming-answer-recovery, projects/llm-gateway-with-fallbacks
source_hash: 55ab30194be15d70
---

## Lesson tasks
type: task-table
span: 2
from: phases/11-llm-engineering/13-production-app/docs/en.md, phases/11-llm-engineering/13-production-app/code/production_app.py, phases/17-infrastructure-and-production/29-model-demo-interfaces/docs/en.md, phases/17-infrastructure-and-production/29-model-demo-interfaces/code/main.py

| Task | Code |
|---|---|
| Install the server stack | `pip install fastapi uvicorn` |
| Run the app with 4 workers | `uvicorn production_app:app --host 0.0.0.0 --port 8000 --workers 4` |
| Pick the primary model | `LLM_MODEL=gpt-4o` |
| Start the demo server | `python3 code/main.py --serve` |
| Require an access token | `export DEMO_ACCESS_TOKEN=<token>` |
| Send one prediction | `curl -s -X POST http://127.0.0.1:8000/api/predict -H 'Content-Type: application/json' -d '{"text": "ok"}'` |
| Watch the event stream | `curl -N -X POST http://127.0.0.1:8000/api/stream -H 'Content-Type: application/json' -d '{"text": "<text>"}'` |
| Run the demo tests | `python3 -m unittest discover -s code/tests -v` |

## Request pipeline
type: architecture
from: phases/11-llm-engineering/13-production-app/docs/en.md, phases/11-llm-engineering/13-production-app/code/production_app.py

```arch
node | client | 1,1 | Client | web, mobile, API | client
node | gw | 2,1 | API Gateway | auth, rate limit | process
node | gin | 3,1 | Input guardrails | injection, PII redact | process
node | router | 4,1 | Prompt Router | template, A/B version | process
node | cache | 4,2 | Semantic Cache | threshold 0.92 | store
node | llm | 3,2 | LLM call | retry, fallback chain | model
node | gout | 2,2 | Output guardrails | flagged text replaced | process
node | resp | 1,2 | Response | eval log, cost, SSE | client
edge | client | gw |
edge | gw | gin |
edge | gin | router | pass
edge | router | cache |
edge | cache | llm | miss
edge | llm | gout |
edge | gout | resp |
```

## Retry with backoff
type: annotated-code
lang: python
from: phases/11-llm-engineering/13-production-app/code/production_app.py

```python
async def call_llm_with_retry(prompt, model, max_retries=3):
    for attempt in range(max_retries + 1):
        try:
            ...  # one provider call
        except (ConnectionError, TimeoutError):
            if attempt < max_retries:
                backoff = min(2 ** attempt + random.uniform(0, 1), 10)  # cap 10 s
                await asyncio.sleep(backoff)
            else:
                raise
    raise ConnectionError(f"All {max_retries} retries exhausted for {model.value}")
# call_with_fallback walks FALLBACK_CHAIN, preferred model first.
```

## Failure handling
type: troubleshooting
from: phases/11-llm-engineering/13-production-app/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| API 429 | Rate limit | Retry with backoff. Queue the request |
| API 500 | Server error | Retry 3 times. Switch to the fallback model |
| API timeout over 30s | Slow provider | Retry once. Shorter prompt, smaller model |
| Malformed output | Model failure | Retry with the error in the prompt |
| Guardrail block | Unsafe input | No retry. Explain the block |
| Vector store down | Application failure | Skip RAG context |
| Cache down | Application failure | Direct LLM call |
| All models fail | Chain exhausted | Cached response, then a fixed apology |

## Defaults in the code
type: defaults
from: phases/11-llm-engineering/13-production-app/code/production_app.py, phases/17-infrastructure-and-production/29-model-demo-interfaces/code/main.py

| Setting | Default | Note |
|---|---|---|
| `similarity_threshold` | 0.92 | Semantic cache hit score |
| `ttl_seconds` | 3600 | Cache entry life |
| `max_entries` | 10000 | Cache size |
| `max_retries` | 3 | Per model in the chain |
| `MAX_CHARS` | 500 | Demo text limit |
| `MAX_BODY_BYTES` | 4096 | Larger body gives 413 |
| `BUCKET_CAPACITY` | 5 | Refill 0.5 token per second |
| `DAILY_CALL_CAP` | 2000 | Over the cap gives 503 |

## Demo error codes
type: command-table
from: phases/17-infrastructure-and-production/29-model-demo-interfaces/docs/en.md, phases/17-infrastructure-and-production/29-model-demo-interfaces/code/main.py

| Command | What it does |
|---|---|
| `413 body_too_large` | Body over 4,096 bytes |
| `408 request_timeout` | Body stops before `Content-Length` |
| `415 unsupported_media_type` | Content type is not JSON |
| `400 bad_json` | Body is not a JSON object |
| `422 text_too_long` | Text over 500 characters |
| `422 control_characters` | Text has control characters |
| `429 rate_limited` | Token bucket empty. Read `Retry-After` |
| `503 usage_cap_reached` | Daily cap reached. Read `Retry-After` |

## SSE wire format
type: annotated-code
lang: bash
from: phases/17-infrastructure-and-production/29-model-demo-interfaces/docs/en.md

```bash
event: token  # Content-Type text/event-stream
data: {"index":0,"text":"Label:"}
  # a blank line ends each event
event: token
data: {"index":1,"text":" positive."}

event: done
data: {"label":"positive","score":1.0,"tokens":11}
```

## Resume a streamed answer
type: flow
from: projects/streaming-answer-recovery/README.md, projects/streaming-answer-recovery/solution/main.ts, projects/streaming-answer-recovery/solution/cli.ts

1. **SSEDecoder**: joins split UTF-8 bytes into complete events.
2. **apply**: needs contiguous positive ids. A gap throws `noncontiguous answer event ID`.
3. **apply**: a repeated id with the same data is a no-op. Other data throws.
4. **apply**: payload type is `text`, `citation` or `complete`. Citations need http or https.
5. **connect**: a drop before `complete` sets status `interrupted`.
6. **connect**: the next call sends `Last-Event-ID` and gets only later events.
7. **trace**: writes `schemaVersion: 1` with accepted events. `replay` rebuilds the state.

## Gateway fallback policy
type: comparison
from: projects/llm-gateway-with-fallbacks/README.md, projects/llm-gateway-with-fallbacks/solution/stage2.go, projects/llm-gateway-with-fallbacks/solution/stage4.go, projects/llm-gateway-with-fallbacks/solution/config.go

| Factor | 2xx | 429 or 5xx | Other status | Cancellation |
|---|---|---|---|---|
| `ClassifyStatus` | `success` | `retry` | `terminal` | none |
| Next provider | No | Yes | No | No |
| Route state | `completed` | `exhausted` at end | `terminal-error` | `cancelled` |
| Proxy reply | Upstream body | 502 at end | 502 | 504 |

## Gateway providers file
type: annotated-code
lang: bash
from: projects/llm-gateway-with-fallbacks/solution/fixtures/providers.example.json, projects/llm-gateway-with-fallbacks/README.md

```bash
{"providers": [
  {"name": "primary", "url": "http://127.0.0.1:11434/v1/chat/completions"},
  {"name": "backup", "url": "http://127.0.0.1:11435/v1/chat/completions",
   "key_env": "ORCHARD_BACKUP_KEY"}],  # env var name, not the key
 "max_attempts": 2,  # 1 to 16, one visit per provider
 "max_response_bytes": 65536,  # 1 byte to 16 MiB
 "timeout_ms": 4000}  # 1 to 5000, whole route
```

## Project tasks
type: task-table
span: 2
from: projects/streaming-answer-recovery/README.md, projects/llm-gateway-with-fallbacks/README.md

| Task | Code |
|---|---|
| Make a work folder | `python3 scripts/project_test.py <project> --init /tmp/<project>-work` |
| Grade one stage | `python3 scripts/project_test.py <project> --stage 1 --path /tmp/<project>-work --strict` |
| Stream demo, drop then resume | `cd projects/streaming-answer-recovery/solution && python3 demo.py` |
| Read your own SSE endpoint | `node --experimental-strip-types cli.ts <url> /tmp/trace.json` |
| Gateway demo, 503 then backup | `cd projects/llm-gateway-with-fallbacks/solution && go run .` |
| Run the gateway proxy | `go run . --config /tmp/providers.json --listen 127.0.0.1:8088` |
| Call the proxy | `curl --fail-with-body http://127.0.0.1:8088/v1/chat/completions --data-binary @fixtures/request.json` |

## Targets and checklist
type: tips
from: phases/11-llm-engineering/13-production-app/docs/en.md

- P50 latency under 2s. P99 latency under 10s.
- Cache hit rate over 30%. Guardrail block rate under 5%.
- Cost per request under $0.01.
- Rate limit each user at 10 to 50 requests per minute.
- Load test with 100 concurrent users before launch.

## Q&A
type: qa
from: phases/17-infrastructure-and-production/29-model-demo-interfaces/docs/en.md

- **Why POST and not `EventSource`?** `EventSource` sends GET only. GET puts the input in logged URLs.
- **Model fails after status 200?** The status is sent. Send an `error` event in the stream.
- **What is in an error body?** `code`, `message`, `hint` and `request_id`.
