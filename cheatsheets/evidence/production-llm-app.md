# Evidence: cheatsheets/production-llm-app.md

Abbreviations: L13 = phases/11-llm-engineering/13-production-app, L29 = phases/17-infrastructure-and-production/29-model-demo-interfaces, SAR = projects/streaming-answer-recovery, GW = projects/llm-gateway-with-fallbacks. d = docs/en.md, pa = code/production_app.py, m = code/main.py.

## Lesson tasks (task-table, 8)
- pip install fastapi uvicorn: L13/d:1075
- uvicorn production_app:app --host 0.0.0.0 --port 8000 --workers 4: L13/d:1119, four workers L13/d:1122
- LLM_MODEL override, gpt-4o in registry: L13/pa:19, L13/pa:24
- python3 code/main.py --serve: L29/d:478
- export DEMO_ACCESS_TOKEN: L29/d:476
- curl POST /api/predict with {"text": "ok"}: L29/d:446-447, L29/d:458-459
- curl -N POST /api/stream: L29/d:469-470
- python3 -m unittest discover -s code/tests -v: L29/d:484

## Request pipeline (architecture, 8 nodes, 7 edges)
- Client web, mobile, API: L13/d:43. API Gateway auth + rate limit: L13/d:44
- Input guardrails, injection and PII redaction: L13/pa:299-321, REDACTED L13/pa:315
- Prompt Router, template and A/B version: L13/d:45, L13/pa:167-175
- Semantic Cache threshold 0.92: L13/d:46, L13/pa:440
- LLM call with retry and fallback chain: L13/pa:374, L13/pa:407
- Output guardrails, flagged text replaced: L13/pa:491-493
- Response with eval log, cost, SSE: L13/d:49-51
- edges: L13/d:53-60 (cache miss to LLM: L13/d:57)

## Retry with backoff (annotated-code, 11 lines)
- call_llm_with_retry signature and loop: L13/pa:374-376
- except (ConnectionError, TimeoutError), backoff min(2 ** attempt + random.uniform(0, 1), 10), asyncio.sleep: L13/pa:397-402
- final raise ConnectionError: L13/pa:404
- call_with_fallback walks FALLBACK_CHAIN, preferred first: L13/pa:43, L13/pa:407-419

## Failure handling (troubleshooting, 8)
- API 429, retry with backoff, queue the request: L13/d:135
- API 500, retry 3 times, switch to fallback model: L13/d:136
- API timeout over 30s, retry once, shorter prompt, smaller model: L13/d:137
- Malformed output, retry with the error in the prompt: L13/d:138, layer 2 L13/d:129
- Guardrail block, no retry, explain the block: L13/d:139
- Vector store down, skip RAG context: L13/d:140
- Cache down, direct LLM call: L13/d:141
- All models fail, cached response then apology: L13/d:146, apology text L13/pa:421-422

## Defaults in the code (defaults, 8)
- similarity_threshold 0.92: L13/pa:208
- ttl_seconds 3600: L13/pa:208
- max_entries 10000: L13/pa:208
- max_retries 3: L13/pa:374
- MAX_CHARS 500: L29/m:32
- MAX_BODY_BYTES 4096: L29/m:33
- BUCKET_CAPACITY 5, REFILL_PER_SECOND 0.5: L29/m:35-36
- DAILY_CALL_CAP 2000, over the cap gives 503: L29/m:37, 371

## Demo error codes (command-table, 8)
- 413 body_too_large: L29/d:79
- 408 request_timeout: L29/d:80
- 415 unsupported_media_type: L29/d:81
- 400 bad_json: L29/d:82
- 422 text_too_long: L29/d:83, L29/m:160
- 422 control_characters: L29/d:83, L29/m:163
- 429 rate_limited with Retry-After: L29/m:360-361
- 503 usage_cap_reached with Retry-After: L29/m:371-372

## SSE wire format (annotated-code, 8 lines)
- text/event-stream, blank line ends event: L29/d:106
- token and done events: L29/d:109-116

## Resume a streamed answer (flow, 7)
1. SSEDecoder, split UTF-8 bytes: SAR/solution/main.ts:2, SAR/README.md:3
2. contiguous positive ids, noncontiguous error: SAR/README.md:34, SAR/solution/main.ts:75-80
3. duplicate id same data returns state, conflict throws: SAR/solution/main.ts:68-72
4. text, citation, complete payload types, http/https citations: SAR/README.md:34, SAR/solution/main.ts:85-101
5. drop before complete sets interrupted: SAR/solution/main.ts:162-164
6. Last-Event-ID header on reconnect: SAR/solution/main.ts:134, SAR/README.md:30
7. trace schemaVersion 1, replay: SAR/solution/main.ts:180-187, SAR/README.md:36

## Gateway fallback policy (comparison, 4 rows)
- ClassifyStatus success, retry, terminal: GW/solution/stage2.go:8, 11, 13
- 2xx completes, 429 and 5xx fall back, other stops, cancellation stops: GW/README.md:52
- route states exhausted, cancelled, completed, terminal-error: GW/solution/stage4.go:23, 26, 63, 67
- 502 on failure, 504 on cancellation, upstream body on success: GW/solution/config.go:202-204, GW/README.md:54

## Gateway providers file (annotated-code, 7 lines)
- primary and backup urls: GW/solution/fixtures/providers.example.json:5, 10
- key_env ORCHARD_BACKUP_KEY: GW/solution/fixtures/providers.example.json:12, env var name meaning GW/README.md:33
- max_attempts 2, max_response_bytes 65536, timeout_ms 4000: GW/solution/fixtures/providers.example.json:15-17
- ranges 1 to 16, 16 MiB, 1 to 5000 whole route, one visit per provider: GW/README.md:50

## Project tasks (task-table, 7)
- --init /tmp/<project>-work: SAR/README.md:15, GW/README.md:15
- --stage 1 --path --strict: SAR/README.md:16, GW/README.md:16
- stream demo python3 demo.py, interrupt then resume: SAR/README.md:24-30
- node --experimental-strip-types cli.ts URL /tmp/trace.json: SAR/README.md:32
- gateway go run ., 503 primary then backup: GW/README.md:25-29
- go run . --config /tmp/providers.json --listen 127.0.0.1:8088: GW/README.md:37
- curl --fail-with-body ... --data-binary @fixtures/request.json: GW/README.md:43

## Targets and checklist (tips, 5)
- P50 under 2s, P99 under 10s: L13/d:163-164
- cache hit over 30%, block rate under 5%: L13/d:165-166
- cost per request under $0.01: L13/d:167
- 10 to 50 requests per minute: L13/d:247
- 100 concurrent users load test: L13/d:260

## Q&A (qa, 3)
- EventSource GET only, URLs logged: L29/d:119
- error event after status 200: L29/d:121
- code, message, hint, request_id: L29/d:142-145
