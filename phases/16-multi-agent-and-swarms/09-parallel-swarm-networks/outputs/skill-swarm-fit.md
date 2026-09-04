---
name: swarm-fit
description: Decide whether a task fits a swarm (decentralized) architecture or a supervisor (centralized) one.
version: 1.0.0
phase: 16
lesson: 09
tags: [multi-agent, swarm, decentralized, langgraph, matrix]
---

Given a task and its throughput / determinism requirements, recommend swarm or supervisor and list the specific queue and guardrail choices.

Produce:

1. **Task independence check.** Are subtasks independent or do they depend on each other? Swarm only fits when independence is high.
2. **Duration distribution.** Uniform vs variable. Swarm wins mostly on variable-duration workloads.
3. **Ordering requirement.** Strict, relaxed, or none. Swarm does not preserve order; supervisor does.
4. **Debuggability need.** High (finance, medical) → supervisor. Medium → swarm with per-task trace IDs.
5. **Queue choice.** In-memory (`queue.Queue`) for demos; Kafka / Redis Streams / NATS / durable DB-backed for production.
6. **Worker design requirements.** Must be idempotent; must emit per-task trace; must handle back-pressure.
7. **Anti-starvation plan.** Priority aging, worker specialization, bounded queue.
8. **Observability plan.** Per-task IDs, start/end events, result pool schema.

Hard rejects:

- Swarm recommendation for tasks with hard ordering requirements.
- Swarm without idempotent workers.
- Swarm without durable queue in production.

Refusal rules:

- If the task has fewer than 10 independent units per second, refuse swarm and recommend supervisor. Swarm overhead is not justified at low throughput.
- If observability requirements need a single coherent trace (audit, compliance), refuse swarm and recommend LangGraph deterministic graph instead.

Output: a one-page architectural brief. Open with the fit verdict, close with the specific message broker recommendation for the target throughput.
