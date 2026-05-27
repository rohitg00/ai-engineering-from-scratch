---
name: durable-execution-review
description: Review a proposed long-running agent deployment for correct durable-execution shape (activities, determinism, checkpoint backend, human-input state, HITL-on-resume).
version: 1.0.0
phase: 15
lesson: 12
tags: [durable-execution, workflows, checkpointing, temporal, langgraph, agents-sdk]
---

Given a proposed long-running agent deployment (Temporal + OpenAI Agents SDK, LangGraph with PostgreSQL checkpointer, Microsoft Agent Framework, Claude Code Routines, Cloudflare Durable Objects, or an in-house equivalent), audit the design against the durable-execution pattern.

Produce:

1. **Activity inventory.** List every activity (LLM call, tool call, HTTP request, file write). For each, confirm it is wrapped as an activity with retry policy, timeout, and idempotency key. Raw LLM calls outside the activity envelope are a reliability hole.
2. **Workflow determinism.** Identify every non-deterministic read inside the workflow code (wall clock, random, external state). Each must be registered as a side-effect activity so replay returns the same value. Hidden non-determinism is the most common cause of replay drift.
3. **Checkpoint backend.** Name the backend (PostgreSQL, SQLite, Redis, Durable Objects). Confirm it survives deploys. SQLite is dev-only. Redis requires AOF or snapshot config. Cloudflare Durable Objects are transparent but require a unique key discipline.
4. **Human-input state.** Confirm pauses for HITL are a first-class workflow state, not a polling loop. The workflow should block on an external signal (approval queue, webhook, `interrupt()` primitive) that resumes exactly when the approval arrives.
5. **HITL-on-resume policy.** For any resume after a crash, state whether fresh HITL is required before executing the next activity. Without this, durable execution plus an approval granted before the crash may re-fire an approved action when the context has changed. Critical for long horizons.

Hard rejects:
- Agent SDK usage where LLM calls are not wrapped as activities.
- Checkpoint backends that do not survive a deploy.
- Workflows that embed wall clock or random without activity wrapping.
- Human-input modeled as a polling loop rather than a signal.
- Long-horizon runs (above one hour) with no HITL-on-resume policy.
- Runs with no budget kill switch (Lesson 13) layered on top of durability.

Refusal rules:
- If the user proposes a durable workflow with no explicit idempotency on side-effect activities, refuse and require idempotency keys first. Retries will double-execute otherwise.
- If the user cannot show a replay test (run workflow, crash mid-run, replay, assert no double side effects), refuse and require that test before production.
- If the user proposes a 24-hour unattended run with no HITL checkpoint, refuse. The 35-minute degradation (Lesson 12 notes) makes this a reliability problem even if durability is correct.

Output format:

Return a design-review memo with:
- **Activity table** (activity, retry policy, timeout, idempotency key)
- **Determinism audit** (non-deterministic reads and how each is handled)
- **Checkpoint backend** (name, survives-deploy y/n, replay-test status)
- **HITL state shape** (first-class state / polling / missing)
- **HITL-on-resume policy** (explicit, with rationale)
- **Readiness** (production / staging / research-only)
