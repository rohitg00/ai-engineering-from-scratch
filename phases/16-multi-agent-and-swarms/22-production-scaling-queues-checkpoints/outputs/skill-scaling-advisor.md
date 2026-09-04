---
name: scaling-advisor
description: Advise on durable-execution choice for a multi-agent production system. Picks between FastAPI + Postgres, LangGraph runtime, Temporal, Restate, or custom based on concrete load and state-retention needs.
version: 1.0.0
phase: 16
lesson: 22
tags: [multi-agent, production, scaling, durable-execution, queues, checkpoints]
---

Given a multi-agent production deployment plan, recommend the durable-execution substrate.

Produce:

1. **Load profile.** Concurrent agent-runs (p50, p99). Per-run duration (seconds to hours). Fraction of runs requiring human-in-the-loop waits. Deploy frequency.
2. **State profile.** Size of per-run state (KB to MB). Retention requirement (seconds of checkpoint history, or full audit log). Determinism: can runs be replayed from checkpoints deterministically, or only from logs?
3. **Side-effect profile.** Which side effects need exactly-once (payments, external APIs, email)? Which can tolerate at-least-once (pure tool reads)? Outbox pattern needed for exactly-once.
4. **Recommendation tier.**
   - Tier 1 (Bedi's rule): FastAPI + Postgres. Under ~100 concurrent runs, sub-hour durations, simple retries.
   - Tier 2: LangGraph runtime or Temporal. Hour-long runs, interrupt/resume, structured retries.
   - Tier 3: Custom with outbox + event sourcing. Specialized needs, high throughput, strict audit.
5. **Deploy model.** Single version or rainbow/canary? Rainbow required for long-running stateful workloads.
6. **Async / thread boundary.** Which parts are async (LLM calls, tool I/O) and which are threads/processes (CPU-bound post-processing, embedding).
7. **Observability.** Per-run traces, super-step audit, retry counter. Storage for traces (separate from checkpoint store).

Hard rejects:

- Recommending Temporal for a 10-concurrent-run prototype. Ceremony cost > value.
- Thread-per-job LLM call architectures. I/O-bound + 1MB/thread does not scale.
- Designs without outbox pattern for paid side effects. Duplicate charges are expensive.
- Single-version deploys for multi-hour agent runs. Users lose state on every code push.

Refusal rules:

- If load is unknown and untested, recommend Tier 1 plus load testing. Premature optimization burns time.
- If the user wants a tokenized / blockchain-persistent system, say that durable-execution engines typically do not solve that (write your own event sourcing); recommend legal review for tokenized flows.
- If the team has no on-call engineer, Temporal / LangGraph runtime maintenance is under-provisioned; recommend Tier 1 until on-call is staffed.

Output: a two-page brief. Start with a one-sentence recommendation ("Tier 1 (FastAPI + Postgres + outbox) for current load; escalate to LangGraph runtime when p99 run duration exceeds 10 min or concurrent runs exceed 200."), then the seven sections above. End with a 90-day upgrade path: metrics to watch, threshold for escalation, runbook outline.
