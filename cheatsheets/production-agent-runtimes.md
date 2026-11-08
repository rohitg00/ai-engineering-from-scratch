---
id: production-agent-runtimes
title: Production Agent Runtimes and Queues
code: PA
subtitle: Pick a runtime shape, checkpoint and replay, lease and fence jobs, retry scoped reads. Python and Go.
hue: 30
sources: phases/14-agent-engineering/29-production-runtimes, phases/15-autonomous-systems/12-durable-execution, phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints, projects/durable-agent-jobs, projects/cloud-agent-with-aws-strands
source_hash: e1799546605e724e
---

## Pick the runtime shape
type: concepts
from: phases/14-agent-engineering/29-production-runtimes/docs/en.md, phases/15-autonomous-systems/12-durable-execution/docs/en.md, phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/docs/en.md

- **Request-response**: synchronous HTTP. The user waits. Short tasks only (<30s).
- **Streaming**: SSE or WebSocket. Watch first-token latency and tail latency.
- **Durable execution**: state checkpointed after every step. Auto-resumes on failure.
- **Queue-based**: producer, worker pool, DLQ. Watch queue depth and DLQ size.
- **Event-driven**: the agent subscribes to triggers. Watch event-to-start latency.
- **Scheduled**: cron-shaped. Combine with durable execution.
- **Workflow and activity**: deterministic orchestration code. Each LLM or tool call is a logged activity.
- **Exactly-once effective**: at-least-once delivery plus an idempotent consumer.

## Durable job store
type: architecture
from: projects/durable-agent-jobs/API.md, projects/durable-agent-jobs/README.md

```arch
node | enq | 1,1 | enqueue | --store, --input | client
node | lock | 2,1 | ledger.lock | advisory lock | store
node | jobs | 3,1 | jobs.json | ID, State, Version | store
node | wrk | 1,2 | worker | claim, effect, complete | process
node | inp | 2,2 | inputs/<id>.json | immutable input | store
node | eff | 3,2 | effects/<id>.json | immutable receipt | store
edge | enq | lock | read-modify-write
edge | lock | jobs | snapshot
edge | enq | inp | text
edge | wrk | lock | ClaimNext
edge | wrk | eff | receipt
```

## Job lifecycle in the stages
type: flow
from: projects/durable-agent-jobs/solution/stage1.go, projects/durable-agent-jobs/solution/stage2.go, projects/durable-agent-jobs/solution/stage3.go, projects/durable-agent-jobs/solution/stage4.go

1. **NewJob**: the ID must match `^[a-z][a-z0-9-]{0,63}$`. State is queued, version 0.
2. **ClaimJob**: needs the expected version and state queued. Else `ErrConflict`.
3. **ClaimJob**: `Attempts >= maxAttempts` gives `ErrLimit`.
4. **ClaimJob**: `Version++`, `Attempts++`, `LeaseUntil = now + ttl`, state running.
5. **Finish**: current version, state running and `now < LeaseUntil`. State completed.
6. **Reclaim**: running and `now >= LeaseUntil`. State queued, `Version++` fences the old worker.
7. **Save**: `ValidateJobs`, write temp, `f.Sync()`, `os.Rename`. Limit 4 MiB.

## Durable jobs CLI
type: command-table
from: projects/durable-agent-jobs/README.md, projects/durable-agent-jobs/API.md

| Command | What it does |
|---|---|
| `go build -o /tmp/durable-jobs .` | Builds the reference binary in `solution` |
| `enqueue --store <dir> --input <file>` | Adds jobs. Identical redelivery is safe |
| `worker --store <dir> --max-jobs 100` | Claims and runs up to 100 jobs |
| `status --store <dir>` | Shows jobs, available effects and scope |
| `--crash-after effect` | Exits 86 after the receipt exists |
| `--crash-after claim` | Exits 86 before an output exists |
| `--now-ms 111 --lease-ms 10` | Logical clock. The old lease expired |
| `go run . demo` | Runs the effect-crash sequence |

## Run the demos
type: task-table
from: phases/14-agent-engineering/29-production-runtimes/docs/en.md, projects/durable-agent-jobs/README.md, projects/cloud-agent-with-aws-strands/README.md, projects/cloud-agent-with-aws-strands/requirements-framework.txt

| Task | Code |
|---|---|
| Run a lesson demo | `python3 code/main.py` |
| Grade a project reference | `--all --solution --strict` |
| Run the cloud reader | `python3 cli.py samples/input.json` |
| Read live AWS instead | `python3 cli.py <input> --mode aws` |
| Pin the optional SDK | `strands-agents==1.57.1` |

## Activity replay from an event log
type: annotated-code
lang: python
from: phases/15-autonomous-systems/12-durable-execution/code/main.py

```python
@activity("call_llm")                    # each LLM call is an activity
def call_llm(doc_count: int) -> str:
    return f"summary({doc_count}_docs)"
hit = log.lookup(name, args)             # done event with the same args
if hit:
    return hit["result"]                 # replay, no new execution
log.append({"name": name, "args": list(args), "status": "started"})
result = fn(*args)                       # runs only when not in the log
log.append({"name": name, "args": list(args),
            "status": "done", "result": result})
```

## Checkpoint per super-step
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/code/main.py

```python
store = CheckpointStore(db_path)         # SQLite table checkpoints
store.write(thread_id, super_step, dict(state))  # one row per step
restored = store.latest(thread_id)       # ORDER BY super_step DESC
super_step, state = restored
super_step += 1                          # resume after the last step
run_agent_with_checkpoint(store, "t-1", crash_at=3, goal=5)
final = run_agent_with_checkpoint(store, "t-1", goal=5)  # worker 2
await asyncio.gather(*(sim_llm_call_async() for _ in range(n)))
```

## Scoped cloud reader contract
type: annotated-code
lang: python
from: projects/cloud-agent-with-aws-strands/API.md, projects/cloud-agent-with-aws-strands/solution/plan.py, projects/cloud-agent-with-aws-strands/solution/executor.py, projects/cloud-agent-with-aws-strands/solution/retry.py, projects/cloud-agent-with-aws-strands/solution/cli.py

```python
ALLOWED = {"inventory.list", "metrics.read", "logs.read"}
validate_plan(raw, scope)        # one to ten actions, read-only, in scope
execute(plan, provider, max_steps=5, max_chars=4000)
# over budget: state budget_exhausted
request_key(operation, resource) # sha256 of the JSON pair
cached_read(operation, resource, provider, cache, retries=2)
# cache hit: attempts 0. Only TimeoutError retries
run(payload, provider)           # adds receipts with cached, attempts
parse_model_plan(text, scope)    # the model plan goes to validate_plan
```

## Defaults
type: defaults
from: projects/durable-agent-jobs/API.md, projects/durable-agent-jobs/solution/main.go, projects/cloud-agent-with-aws-strands/solution/executor.py, projects/cloud-agent-with-aws-strands/solution/retry.py, projects/cloud-agent-with-aws-strands/solution/cli.py

| Setting | Default | Note |
|---|---|---|
| `--lease-ms` | 30000 | Claim lease in milliseconds |
| `--max-attempts` | 3 | Then the job waits for manual reconciliation |
| `--max-jobs` | 1 | Jobs for one worker invocation |
| `--delay-ms` | 0 | Range 0..60000 |
| `--now-ms` | -1 | -1 means current wall time |
| `max_steps` | 5 | Step budget. `max_chars` is 4000 |
| `retries` | 2 | In `cached_read`. The CLI `run` passes 1 |

## Troubleshooting
type: troubleshooting
from: phases/14-agent-engineering/29-production-runtimes/docs/en.md, phases/15-autonomous-systems/12-durable-execution/docs/en.md, phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/docs/en.md, projects/durable-agent-jobs/README.md, projects/durable-agent-jobs/API.md, projects/durable-agent-jobs/solution/stage3.go

| Symptom | Cause | Fix |
|---|---|---|
| Users hang up, retries compound | Request-response for a 5-minute task | Use a queue or durable shape |
| Failed jobs vanish | Queue workers without dead-letter | Add a DLQ and surface DLQ size |
| Failures invisible until a user reports | Background run without trace export | Export OpenTelemetry GenAI spans |
| Crash reruns tools and re-bills LLM calls | Naive `while True` loop | Log each call as an activity and replay |
| Completion returns conflict | Stale worker: version or lease changed | The new claim finishes the job |
| Job stays at the attempt cap | `--max-attempts` reached | Reconcile the visible job manually |
| Replay diverges | Wall clock inside a workflow decision | Register it as a side effect |
| 10,000 calls use 10GB of stacks | One thread for each LLM call | Use async for the I/O layer |

## Questions
type: qa
from: phases/15-autonomous-systems/12-durable-execution/docs/en.md, projects/durable-agent-jobs/README.md, projects/cloud-agent-with-aws-strands/README.md, phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/docs/en.md

- **Which checkpoint backend?** PostgreSQL survives deploys. SQLite is local-dev only. Redis is ephemeral unless AOF/snapshot configured.
- **When is durable execution wrong?** Runs shorter than a few minutes with no human input, or strictly read-only retrieval.
- **Does durability fix the 35-minute degradation?** No. Add fresh HITL on re-entry and budget kill switches.
- **Is the receipt exactly once?** No. Execution is at least once. The receipt makes only this local effect idempotent.
- **Why two provider reads for three steps?** Repeated metrics.read uses the request-local cache.
- **What does recovery show?** `incident-summary` is completed v4, attempts 2, with `reused_effect: true`.

## Tips
type: tips
from: phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/docs/en.md, projects/durable-agent-jobs/README.md, projects/durable-agent-jobs/API.md

- Start with FastAPI + Postgres. Upgrade when you measure it failing.
- Put a dedup key in every side-effect call.
- Use the outbox pattern for payments and external API calls.
- Use rainbow deploys. Never kill in-flight agent runs during deploys.
- Use async for I/O. Use threads only for CPU-bound post-processing.
- Keep the job store on one local POSIX filesystem. Do not put it on NFS.
- Do not edit storage files while workers run.
