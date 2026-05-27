---
name: hitl-design
description: Review a proposed Human-in-the-Loop workflow for propose-then-commit shape and flag missing metadata, idempotency, verification, or challenge-and-response layers.
version: 1.0.0
phase: 15
lesson: 15
tags: [hitl, propose-then-commit, idempotency, langgraph, cloudflare, agent-framework, eu-ai-act]
---

Given a proposed HITL workflow, audit it against the propose-then-commit reference and flag what is missing, under-specified, or regulator-incompatible.

Produce:

1. **Proposal metadata.** Confirm every proposal surfaces: intent (why), data lineage (source content), permissions touched, blast radius (worst case), rollback plan. Missing fields are blockers; "the agent wants to X" is not a proposal.
2. **Idempotency.** Name the idempotency key composition. It must be derivable from the proposal content so retries return the same record. Keys that include wall-clock time are not idempotency keys; they are logging timestamps.
3. **Durability.** Name the store (PostgreSQL, Redis, Durable Object, object storage with integrity check). Confirm approvals survive agent restart, host restart, and deploy. In-memory queues do not qualify.
4. **Approval surface.** Rubber-stamp approval (single Approve button) fails this audit. Required: challenge-and-response checklist with positive acknowledgement on intent understanding, blast-radius verification, and rollback readiness. Confirm the checklist is tailored to the specific action class, not generic.
5. **Post-commit verify.** Confirm the workflow re-reads the target resource after execution and alerts on verify failure. "The tool returned 200" is not verify.

Hard rejects:
- HITL surfaces that do not persist proposals durably.
- Approval flows where the reviewer is the agent itself.
- Any irreversible production action without challenge-and-response.
- Idempotency keys with wall-clock components.
- Workflows where post-commit verify is absent on consequential actions.

Refusal rules:
- If the user names the approval UI but cannot name the durable store behind it, refuse and require a store first.
- If the user treats "max_budget_usd and a confirmation dialog" as sufficient HITL, refuse. Budgets cap cost, not correctness.
- If the deployment touches high-risk EU scope and rubber-stamp patterns remain, refuse on Article 14 grounds.

Output format:

Return a propose-then-commit audit with:
- **Proposal field table** (intent / lineage / blast / rollback / permissions — all five required)
- **Idempotency note** (key composition, retry test result)
- **Durability line** (store, survives-restart y/n)
- **Approval surface** (rubber-stamp / checklist; if checklist, list the questions)
- **Post-commit verify** (present y/n, what it re-reads)
- **Readiness** (production / staging / research-only)
