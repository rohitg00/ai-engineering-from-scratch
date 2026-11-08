---
id: a-worker-died-mid-run
title: A worker died mid-run, and the user paid for the run
card: multi-agent
kind: design
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [durable-execution, checkpoint, idempotency, outbox, rainbow-deploy]
minutes: 15
lessons: [phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints]
manuals: []
practice: []
cheatsheet: [production-agent-runtimes, multi-agent]
related: []
updated: 2026-11-03
---

Your multi-agent prototype runs in one process with an in-memory event loop. In production, runs last hours while they wait for human input, worker processes crash and lose everything, peak load is ten times the average, and users are charged per run so a retried side effect is a double charge. Design the layer that goes under the agents, and say what you would build first.

## Short answer

Put a durable execution layer under the agents: persist the full run state after each step under a run id, so that when a worker crashes its lease expires and any other worker resumes from the last checkpoint. That needs serializable state, a deterministic resume, and idempotent side effects. For the charge, use a deduplication key per run and an outbox so that side effects are written as intent first and executed once, use asynchronous I/O for the model calls, and deploy new versions beside old ones so that in-flight runs are never killed. Build the simplest version first, a web service with a relational database, and adopt a workflow engine when a measured problem demands it.

## Full answer

### The resume path

```text
worker crashes mid-step
  -> lease times out
  -> another worker picks up the run id
  -> resumes from the last checkpoint
  -> no duplicate side effect
```

Three requirements make this work:

1. **Serializable state.** Everything the agent holds must be persistable. A closure with a live database connection does not survive a crash.
2. **Deterministic resume.** Given the same state and the same inputs, the agent takes the same actions, or defers to a recorded result for the model calls.
3. **Idempotent side effects.** Every external call carries a key, or writes to a table first and is executed by a separate process.

Graph runtimes write a checkpoint after each step under a thread id. Workflow engines write after each activity. Event-sourced runtimes keep a journal. The pattern is the same.

### The waiting run

A run that waits hours for a human must not hold a worker. The runtime persists the run, releases the worker, and any worker resumes when the input arrives. That is what makes the checkpoint the unit of the system rather than the process.

### Exactly once, effectively

At-least-once delivery plus an idempotent consumer is the only kind of exactly-once you get.

| Move | What it does |
|---|---|
| Deduplication key per run | Included in every side-effect call so a retry is recognized |
| Outbox | Intent is written to a table, and a separate executor performs it and marks it done |
| Compensating transaction | When the effect succeeded and the tracking write failed, schedule the reverse |

These are database patterns. The only agent-specific tax is that model calls are slow.

### Concurrency

Model calls are I/O bound, and a thread waiting for the next token is idle 99 percent of the time. At 10,000 concurrent calls, threads of about 1 MB each need about 10 GB for stacks alone, while cooperative fibers fit in one process. Use asynchronous I/O for the model layer and threads or processes only for CPU-bound work such as embedding.

### Deploys

Long-running stateful agents cannot be hot-swapped. Run several versions of the runtime at once, send a slice of new runs to the new version, and retire the old version when its runs finish.

### What to build first

The lesson's counterpoint is that most teams over-engineer before they measure. A web service and a relational database, with each run as a row, optimistic concurrency on the state, a simple background worker and application-level retries, carries loads under about 100 concurrent runs on manageable tasks. Adopt a durable-execution engine when you hit a concrete problem the simple design cannot solve: hour-long waits at scale, cross-region coordination, or complex compensation policies.

## Follow-ups

- **Level 3:** Why is the model call the hard part of deterministic resume? Expected: it is not deterministic, so the resume must replay the recorded result of the call rather than make it again.
- **Level 3:** What does the lease do? Expected: it marks a run as owned by one worker for a bounded time, so a crash frees the run for another worker without two workers running it at once.
- **Level 4:** How do you test the outbox? Expected: run the same side effect twice through the executor and assert one external call, then crash the executor between the effect and the mark and assert that the compensation or the idempotent redo leaves one effect.
- **Level 4:** Which feature of a workflow engine is hardest to replicate by hand, and is that a reason to adopt it? Expected: a reasoned pick such as durable timers for hour-long waits or compensation policies, with the rule that adoption follows a measured failure of the simple design.

## Wrong answers

- "Retry the whole run from the start when a worker dies." That repeats every side effect that already happened, which is the double charge in the prompt.
- "Use a thread per run; it is simpler." Threads idle while they wait for tokens, and at ten thousand concurrent calls the stacks alone exhaust memory.
- "Adopt a workflow engine on day one to be safe." The simple design carries about a hundred concurrent runs, and the engine's ceremony costs time until a measured problem pays for it.

## Taught in

The [production scaling lesson](../../../phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/) builds the checkpoint store, the per-agent queue and the asynchronous demo, and lands the start-simple rule.
