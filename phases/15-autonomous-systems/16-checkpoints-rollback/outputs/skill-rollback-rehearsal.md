---
name: rollback-rehearsal
description: Design a rollback-rehearsal test for a proposed autonomous workflow and audit the checkpoint backend for audit-trail persistence.
version: 1.0.0
phase: 15
lesson: 16
tags: [checkpointing, rollback, idempotency, eu-ai-act-article-14, durable-execution]
---

Given a proposed long-horizon autonomous workflow, design a rollback-rehearsal test that proves the idempotency + precondition + verify + rollback stack actually works end-to-end, and audit the checkpoint backend for regulator-readiness.

Produce:

1. **Rehearsal script.** Concrete test that (a) starts the workflow, (b) crashes it mid-commit, (c) resumes, (d) asserts the action fires exactly once, (e) injects a verify failure, (f) asserts the rollback fires and state is restored. No production workflow should run without this test having passed at least once.
2. **Idempotency audit.** Confirm the idempotency key is derived from proposal content (Lesson 15) and commit logic uses explicit execution states (`pending` -> `executing` -> `committed`/`failed`). Reserve/lock by idempotency key before the side effect, and mark `committed` only after the side effect has been verified.
3. **Precondition inventory.** List every precondition the workflow must re-check at commit time. Time-of-check vs time-of-use gaps are the most common production bug; the precondition must be evaluated at commit, not at propose.
4. **Verify inventory.** For every consequential action, name the specific read that confirms the side effect happened. "Returned 200" is not acceptable.
5. **Rollback inventory.** For every consequential action, classify the rollback as in-band, compensating transaction, or out-of-band alert. No-op rollbacks ("we cannot undo this") must be named explicitly in the proposal (Lesson 15 metadata).

Hard rejects:
- Workflows with no rehearsed rollback.
- Checkpoint backends that lose data on deploy.
- Commit paths where status is written after execution, not before.
- "Verified" states that only check the return code of the tool call.
- Precondition checks that run only at propose time, not commit time.

Refusal rules:
- If the user has not run the rehearsal script at least once in staging, refuse production rollout.
- If the user cannot produce the checkpoint store schema, refuse and require schema documentation first. Regulators want queryable state.
- If the workflow depends on an in-memory checkpoint (no persistence), refuse.

Output format:

Return a rehearsal plan with:
- **Test script outline** (steps with assertions)
- **Idempotency table** (key composition, status-write order)
- **Precondition table** (check, when evaluated, consequence)
- **Verify table** (action, read that confirms)
- **Rollback table** (action, type, target state)
- **Backend attestation** (store, survives-deploy y/n, query-ready y/n)
- **Readiness** (production / staging / research-only)
