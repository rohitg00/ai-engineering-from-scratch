# Production Scaling — Queues, Checkpoints, Durability

> Scaling multi-agent systems to thousands of concurrent runs requires **durable execution**. LangGraph's runtime writes a checkpoint after each super-step keyed by `thread_id` (Postgres by default); worker crashes release a lease and another worker resumes. Agents can sleep indefinitely waiting for human input. **MegaAgent** (arXiv:2408.09955) ran a per-agent producer-consumer queue with three states (Idle / Processing / Response) and two-layer coordination (intra-group chat + inter-group admin chat). **Fiber/async** beats thread-per-job for LLM streaming: threads sit idle 99% of the time waiting for tokens, fibers cooperatively yield on I/O. Counterpoint: Ashpreet Bedi's "Scaling Agentic Software" argues for **FastAPI + Postgres + nothing else** until load proves otherwise — simple architectures go further than expected. This lesson builds a durable checkpoint log, a per-agent work queue with state transitions, an async-vs-thread demo, and lands the pragmatic "start simple" rule.

**Type:** Learn + Build
**Languages:** Python (stdlib, `asyncio`, `sqlite3`)
**Prerequisites:** Phase 16 · 09 (Parallel Swarm Networks), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Problem

A prototype multi-agent system works on one laptop with three agents in an in-memory event loop. You move to production:

- Agents sometimes run for hours (long research, human-in-the-loop waits).
- Worker processes crash. Restarting loses state.
- Peak load is 10x average; you need horizontal scaling.
- Users pay per agent-run; you need exactly-once semantics for charging.

The in-memory event loop does none of these. You need a durable execution layer underneath. The 2026 canonical options are:

1. A workflow engine with checkpoints (Temporal, LangGraph runtime).
2. A message queue with a state store (Postgres + SQS/RabbitMQ).
3. Actor-model frameworks (MegaAgent's producer-consumer per agent).
4. Hand-rolled FastAPI + Postgres (Bedi's argument).

This lesson builds a miniature of each.

## Concept

### Durable execution, the pattern

A durable-execution engine persists the full program state after each "step" (super-step, in LangGraph's language). On crash:

```
worker crashes mid-step
  -> lease timeout
  -> another worker picks up the thread_id
  -> resumes from last checkpoint
  -> no duplicate side effects
```

Requirements for this to work:

- **Serializable state.** All agent state has to be persistable. Function closures with live database connections do not survive.
- **Deterministic resume.** Given the same state and same inputs, the agent produces the same actions (or defers to an external deterministic oracle for LLM calls).
- **Idempotent side effects.** External calls (tool calls, payments) must be idempotent or use a deduplication key.

LangGraph writes a checkpoint after each super-step; Temporal writes after each activity; Restate uses event-sourced journals. All three implement the same pattern.

### LangGraph's runtime

Each agent has a `thread_id`; state is a typed dict; each super-step writes a row to the checkpoints table. On resume, the runtime replays from the last checkpoint, not from scratch. Agents can `interrupt()` waiting for human input; the runtime persists and releases the worker. When input arrives, any worker can resume.

This is the reference production design in April 2026.

### MegaAgent's per-agent queue

arXiv:2408.09955 describes a scale experiment: thousands of concurrent agents in one cluster. Architecture:

```
agent i:
  state ∈ {Idle, Processing, Response}
  in_queue   <- messages addressed to agent i
  out_queue  -> replies + side effects

coordinators:
  intra-group chat  (agents in the same group)
  inter-group admin chat  (high-level routing)
```

The two-layer coordination lets intra-group conversation happen densely while inter-group stays sparse — the pattern used for keeping cost linear in thousands of agents.

### Async vs thread-per-job

LLM calls are I/O-bound. A thread waiting for the next token is idle 99% of the time. Threads cost ~1MB RAM each; at 10,000 concurrent calls, that is 10GB just for stacks.

Fibers (Python `asyncio`, Go goroutines, Rust `tokio`) cooperatively yield on I/O. The same 10,000 calls fit comfortably in process. At LLM-agent scale, async is not an optimization — it is the architecture.

Exception: CPU-bound post-processing (embedding, tokenizer tricks) still wants threads or processes. Separate your I/O layer from your CPU layer.

### Bedi's counterpoint

"Scaling Agentic Software" (Ashpreet Bedi, 2026) argues that most teams over-engineer before they have measured load. The pragmatic default:

- FastAPI + Postgres.
- Each agent run is a row; state updated in-place with optimistic concurrency.
- Background jobs via `pg_notify` or a simple Celery worker.
- Retry policy in application code.

For loads under ~100 concurrent agent-runs on manageable tasks, this is often all you need. Upgrade when you measure it failing.

The rule: adopt durable-execution frameworks when you hit a concrete problem that simple architectures cannot solve. Premature adoption burns time on ceremonies that do not pay off.

### Exactly-once semantics

For paid agent runs, you need "exactly-once effective" (at-least-once delivery + idempotent consumer). The engineering moves:

- **Dedup key per run.** Include it in every side-effect call.
- **Outbox pattern.** Side effects write to a table first, then a separate process executes them. Both steps idempotent.
- **Compensating transactions.** When a side effect succeeds but its tracking write fails, schedule a compensate.

These are database-engineering patterns, not LLM-specific. The LLM tax is only that LLM calls are slow; everything else is standard distributed systems.

### Rainbow deployment

Anthropic's multi-agent research system uses "rainbow deployments": multiple versions of the agent runtime run concurrently so long-running agents do not have to be killed on every code deploy. Canary new versions on a slice of traffic; retire old versions when their agents finish.

This is standard for long-running stateful systems; the 2026 adaptation is that agents can live for hours, so deployment cycles must accommodate.

### The canonical production checklist

- Durable state (checkpoints, snapshots, or outbox + replayable log).
- Idempotent side effects.
- Async I/O layer for LLM calls.
- At-least-once delivery with dedup.
- Rainbow/canary deployment for stateful workloads.
- Observability: per-agent traces, super-step audit, retry counter.

## Build It

`code/main.py` implements:

- `CheckpointStore` — SQLite-backed checkpoint log with thread-id keys. Each super-step appends a row.
- `run_with_checkpoint(agent, thread_id)` — simulates a crash mid-run; a second worker resumes from last checkpoint.
- `AgentQueue` — per-agent Idle / Processing / Response state machine with a small work queue.
- `demo_async_vs_threads()` — runs 500 concurrent simulated "LLM calls" via asyncio and via threads; reports wall-clock and peak memory (approximated).

Run:

```
python3 code/main.py
```

Expected output: checkpoint resume succeeds after simulated crash; async version handles 500 concurrent calls in < 1s; thread version takes several seconds and uses orders of magnitude more memory per concurrent unit.

## Use It

`outputs/skill-scaling-advisor.md` advises on durable-execution choice: FastAPI + Postgres, LangGraph runtime, Temporal, or custom. Calibrated by load, state-retention needs, and deploy frequency.

## Ship It

Canonical production hardening:

- **Start simple (Bedi's rule).** FastAPI + Postgres until you measure it failing.
- **Instrument everything before optimizing.** Per-run latency histogram, per-step time, retry count, failure categorization.
- **Outbox pattern for side effects.** Especially payments and external API calls.
- **Rainbow deploys.** Never kill in-flight agent runs during deploys.
- **Adopt durable-execution engines (Temporal / LangGraph / Restate) when** you hit specific problems: hour-long human-in-the-loop waits, cross-region coordination, complex retry/compensation policies.
- **Async for the I/O layer.** Threads only for CPU-bound post-processing.

## Exercises

1. Run `code/main.py`. Confirm checkpoint resume works; measure async vs thread concurrency difference.
2. Implement an **outbox** table: every tool call writes to outbox first, then a separate goroutine/task executes. Verify idempotency by running the tool call twice.
3. Simulate a **rainbow deploy**: two concurrent runtime versions; route half of new thread_ids to each; confirm that in-flight threads on the old version are not interrupted.
4. Read LangGraph's runtime doc (linked below). Identify which features of the runtime would take the longest to replicate in a hand-rolled FastAPI + Postgres version. Is that a reason to adopt, or can you defer?
5. Read MegaAgent (arXiv:2408.09955) Section 3. The two-layer coordination (intra-group + inter-group admin chat) is explicit. Sketch how you would map this to a message queue with two queue families.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Durable execution | "Persist the program state" | Engine writes state after each super-step; crash recovery is deterministic. |
| Super-step | "Transactional boundary" | Unit of work between checkpoints. LangGraph term. |
| thread_id | "Agent run identifier" | Key that binds checkpoints and resume logic. |
| Idempotency | "Safe to retry" | Repeating a side effect produces the same result as one attempt. |
| Outbox pattern | "Decouple side effects" | Write intent to a table; a separate executor performs and marks done. |
| At-least-once delivery | "Possible duplicates" | Message queue semantics; dedup key makes consumer effective-once. |
| Rainbow deploy | "Overlapping versions" | Multiple runtime versions concurrent during long-running workloads. |
| Async fiber | "Cooperative yielding" | User-mode concurrency; cheap compared to threads for I/O-bound loads. |
| Checkpoint | "State snapshot" | Serialized state at a super-step boundary; key for resume. |

## Further Reading

- [LangChain — The runtime behind production deep agents](https://www.langchain.com/conceptual-guides/runtime-behind-production-deep-agents) — LangGraph runtime design
- [MegaAgent](https://arxiv.org/abs/2408.09955) — per-agent producer-consumer queue; two-layer coordination at thousands of concurrent agents
- [Matrix](https://arxiv.org/abs/2511.21686) — decentralized framework with message queues as the coordination substrate
- [Temporal docs](https://docs.temporal.io/) — the reference workflow engine for durable execution
- [Anthropic — Multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — production lessons including rainbow deployment
