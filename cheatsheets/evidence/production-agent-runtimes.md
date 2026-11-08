# Evidence: cheatsheets/production-agent-runtimes.md

Abbreviations: L29 = phases/14-agent-engineering/29-production-runtimes, L12 = phases/15-autonomous-systems/12-durable-execution, L22 = phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints, DJ = projects/durable-agent-jobs, CA = projects/cloud-agent-with-aws-strands. d = docs/en.md, c = code/main.py.

## Pick the runtime shape (concepts, 8)
- Request-response, synchronous HTTP, user waits, <30s: L29/d:25-26, 130
- Streaming, SSE or WebSocket, first-token latency, tail latency: L29/d:32, 35
- Durable execution, checkpointed after every step, auto-resumes: L29/d:39
- Queue-based, producer / worker pool / DLQ, queue depth, DLQ size: L29/d:49, 133
- Event-driven, subscribes to triggers, event-to-start latency: L29/d:53, 56
- Scheduled, cron-shaped, combine with durable execution: L29/d:60-61
- Workflow deterministic orchestration, activity is a logged unit (LLM call, tool call): L12/d:25-26, 101-102
- Exactly-once effective = at-least-once delivery + idempotent consumer: L22/d:96

## Durable job store (architecture, 6 nodes, 5 edges)
- enqueue --store DIR --input FILE: DJ/API.md:7
- ledger.lock, jobs.json, inputs/<id>.json, effects/<id>.json, immutable: DJ/API.md:16
- Job fields ID, State, Version: DJ/API.md:16
- read-modify-write under the same advisory lock: DJ/API.md:18
- worker ClaimNext, claim then execution: DJ/API.md:18
- receipt publication in effects: DJ/API.md:16, 20
- worker claim, effect, complete phases: DJ/README.md:3

## Job lifecycle in the stages (flow, 7)
1. NewJob regex ^[a-z][a-z0-9-]{0,63}$, State queued, version zero: DJ/solution/stage1.go:6, 9
2. ClaimJob expected version and queued, else ErrConflict: DJ/solution/stage2.go:6-7
3. Attempts >= maxAttempts gives ErrLimit: DJ/solution/stage2.go:12-13
4. Version++, Attempts++, LeaseUntil = now + ttl, State running: DJ/solution/stage2.go:15-18
5. Finish needs version, running, now < LeaseUntil (else conflict), sets completed: DJ/solution/stage3.go:4-7
6. Reclaim when running and now >= LeaseUntil, queued, Version++: DJ/solution/stage3.go:12-18
7. Save: ValidateJobs, CreateTemp, f.Sync(), os.Rename, 4*1024*1024 limit: DJ/solution/stage4.go:28, 35-38, 45, 54

## Durable jobs CLI (command-table, 8)
- go build -o /tmp/durable-jobs . in solution: DJ/README.md:30-31
- enqueue --store --input, identical repeated enqueue is safe: DJ/README.md:33, 38
- worker --store --max-jobs 100: DJ/README.md:34
- status --store, jobs, available effects and scope: DJ/README.md:35, DJ/API.md:9
- --crash-after effect exits 86, receipt already exists: DJ/README.md:45, 51
- --crash-after claim, recovery before an output exists: DJ/README.md:51
- --now-ms 111 --lease-ms 10, logical clock: DJ/README.md:47, 53
- go run . demo, automates the effect-crash sequence: DJ/README.md:51

## Run the demos (task-table, 5)
- python3 code/main.py: L29/d:100
- --all --solution --strict: DJ/README.md:65, CA/README.md:31
- python3 cli.py samples/input.json: CA/README.md:33
- --mode aws, opt-in AWS CLI adapter: CA/README.md:46
- strands-agents==1.57.1: CA/README.md:66, CA/requirements-framework.txt:1

## Activity replay from an event log (annotated-code, 10 lines)
- @activity("call_llm") and call_llm body: L12/c:77-80
- hit = log.lookup(name, args), return hit["result"]: L12/c:55-58
- log.append started, result = fn(*args), log.append done: L12/c:59-62
- lookup matches name, args and status done: L12/c:42-45

## Checkpoint per super-step (annotated-code, 8 lines)
- CheckpointStore(db_path), SQLite table checkpoints: L22/c:22-26, 163
- store.write(thread_id, super_step, dict(state)): L22/c:34, 67
- latest uses ORDER BY super_step DESC: L22/c:41-43
- restored = store.latest(thread_id), super_step += 1: L22/c:54-57
- run_agent_with_checkpoint(store, "t-1", crash_at=3, goal=5), resume goal=5: L22/c:167, 176
- asyncio.gather over sim_llm_call_async: L22/c:126

## Scoped cloud reader contract (annotated-code, 9 lines)
- ALLOWED = {"inventory.list", "metrics.read", "logs.read"}: CA/solution/plan.py:8
- validate_plan one to ten actions, read-only, in scope: CA/solution/plan.py:11-21
- execute(plan, provider, max_steps=5, max_chars=4000), budget_exhausted: CA/solution/executor.py:11, 18, 22
- request_key sha256 of JSON [operation, resource]: CA/solution/retry.py:12-15
- cached_read(..., retries=2), cache hit attempts 0, only TimeoutError retries: CA/solution/retry.py:18-29
- run(payload, provider) receipts with cached and attempts: CA/solution/cli.py:85-99
- parse_model_plan calls validate_plan: CA/API.md:29

## Defaults (defaults, 7)
- --lease-ms 30000: DJ/API.md:14, DJ/solution/main.go:68
- --max-attempts 3, manual reconciliation at the cap: DJ/API.md:14, DJ/README.md:72
- --max-jobs 1: DJ/API.md:14, DJ/solution/main.go:70
- --delay-ms 0, range 0..60000: DJ/API.md:14, DJ/solution/main.go:71, 76
- --now-ms -1 means current wall time: DJ/API.md:14
- max_steps 5, max_chars 4000: CA/solution/executor.py:11
- retries 2 in cached_read, run passes retries default 1: CA/solution/retry.py:18, CA/solution/cli.py:91

## Troubleshooting (troubleshooting, 8)
- Request-response for a 5-minute task, users hang up, retries compound: L29/d:78
- No DLQ, failed jobs vanish: L29/d:79
- Opaque background work without trace export: L29/d:80, OpenTelemetry GenAI spans: L29/d:74
- Naive while True loop re-executes tools and re-bills LLM calls: L12/d:3, 14
- Stale completion fails, Finish conflict on version or lease: DJ/README.md:53, DJ/solution/stage3.go:4-5
- --max-attempts cap, jobs remain visible for manual reconciliation: DJ/API.md:14, DJ/README.md:72
- Wall clock in workflow decision diverges, register as side effect: L12/d:91, 108
- ~1MB per thread, 10,000 calls is 10GB, async for I/O: L22/d:75-77

## Questions (qa, 6)
- PostgreSQL survives deploys, SQLite local-dev only, Redis ephemeral unless AOF/snapshot configured: L12/d:48-50
- Durable execution wrong for short runs with no human input, read-only retrieval: L12/d:63-64
- 35-minute degradation not fixed, fresh HITL on re-entry, budget kill switches: L12/d:59
- Execution at least once, receipt makes only this effect idempotent: DJ/README.md:72
- Two provider reads for three steps, request-local cache: CA/README.md:38
- incident-summary completed v4, attempts 2, reused_effect: true: DJ/README.md:51

## Tips (tips, 7)
- FastAPI + Postgres until you measure it failing: L22/d:148
- Dedup key per run in every side-effect call: L22/d:98
- Outbox pattern for payments and external API calls: L22/d:150
- Rainbow deploys, never kill in-flight agent runs: L22/d:151
- Async for the I/O layer, threads only for CPU-bound post-processing: L22/d:153
- One local POSIX filesystem, not NFS: DJ/README.md:70
- Do not edit storage files while workers run: DJ/API.md:22
