# Checkpoints and Rollback

> Every graph-state transition persists. When a worker crashes, its lease expires and another worker picks up at the latest checkpoint. Cloudflare Durable Objects hold state across hours or weeks. Propose-then-commit (Lesson 15) defines a rollback plan per action. Post-action verification closes the loop. EU AI Act Article 14 makes effective human oversight mandatory for high-risk systems — in practice this means checkpoints must be queryable, rollbacks must be rehearsed, and the audit trail must survive a deploy. The sharp failure mode: without idempotency keys and precondition checks, a retry after a transient failure can double-execute an already-approved action. Post-action verification is what catches it.

**Type:** Learn
**Languages:** Python (stdlib, checkpoint and rollback state machine)
**Prerequisites:** Phase 15 · 12 (Durable execution), Phase 15 · 15 (Propose-then-commit)
**Time:** ~60 minutes

## The Problem

Durable execution (Lesson 12) makes a crashed agent resumable. Propose-then-commit (Lesson 15) makes an approved action auditable. This lesson joins them: what happens when an approved action executes partially, crashes, and resumes? When does the rollback run, and against what state?

Real systems wire this up differently:

- **LangGraph** checkpoints every graph-state transition to PostgreSQL. On worker crash, the lease releases and another worker resumes at the latest checkpoint. Workflows pause on `interrupt()`, which itself persists.
- **Cloudflare Durable Objects** hold per-key state across hours or weeks. Co-locate the computation with the storage for the approved action.
- **Microsoft Agent Framework** exposes `Checkpoint` primitives in the workflow API; replay plus idempotency covers retries.

In every case, the combination that actually works is: idempotency key (prevents double-execute) + precondition check (state is still what we approved against) + post-action verify (the side effect actually happened) + rollback on verify-fail.

## The Concept

### Every transition persists

A graph-state transition is any step that moves the workflow from one named state to another. Naive implementations persist only at specific commit points; production implementations persist every transition. The cost (a few extra writes) is small relative to the reliability gain (replay lands anywhere, lease recovery is precise).

### Lease recovery

When a worker crashes, the workflow is not lost; the lease (a short-lived claim that this worker is executing this run) simply expires. Another worker picks up the latest checkpoint and resumes. The lease mechanism is what lets production systems survive rolling deploys without losing in-flight work.

### Idempotency plus preconditions

Idempotency alone is not enough. Consider: a workflow is approved to "transfer $100 from A to B when balance > $1000." The workflow is committed, crashes mid-execution, and resumes. If only the idempotency key is checked, and the execution resumes, the transfer runs once (correct). But consider that between crash and resume, A's balance drops to $500 via a different workflow. The idempotency check still passes; the precondition does not. Without a precondition check, we ship an overdraft.

Every consequential action needs both:

- **Idempotency key**: prevents double-execute.
- **Precondition check**: confirms the state is still consistent with what was approved.

### Post-action verification

"The tool returned 200" is not verification. Real verification re-reads the target state and confirms the side effect actually happened. Patterns:

- Database update: `UPDATE ... RETURNING *` then assert the returned row matches intended state.
- Email send: check sent-folder for the message ID after submission.
- File write: read the file back and hash it.
- API call: follow-up `GET` on the target resource.

If verify fails, the workflow is in a known-bad state. Rollback engages.

### Rollback plans

Every consequential action in propose-then-commit (Lesson 15) carries a rollback plan. Types:

- **In-band rollback**: reverse the side effect directly (`DELETE` after `INSERT`, `Send-correction-email` after send).
- **Compensating transaction**: a new action that neutralizes the original (standard SAGA pattern).
- **Out-of-band rollback**: alert a human, pause the workflow, leave the bad state for investigation.

No-op rollback ("we cannot undo this") must be named in the proposal. Actions with no rollback require stronger HITL at commit time (Lesson 15 challenge-and-response).

### EU AI Act Article 14 operational reading

Article 14 requires "effective human oversight" for high-risk systems. In operational terms, implementers read it as:

- Checkpoints are queryable by an auditor.
- Rollbacks are rehearsed (tested end-to-end at least once).
- The audit trail survives a deploy (checkpoint backend is not ephemeral).
- Failed verifications are alerted on, not silently logged.

A workflow that crashes mid-commit, resumes, and completes the side effect without a verify + rollback pathway does not survive the Article 14 test.

### The sharp failure mode: the double-execute

The most common production incident in this space:

1. Action approved, idempotency key k.
2. Commit starts, executes, returns 200.
3. Workflow crashes before persisting the "committed" status.
4. Workflow resumes; sees "approved but not committed"; re-executes.
5. Side effect fires twice.

Mitigation: persist an "in-flight" intent before execution, execute with an idempotency key, then mark "committed" only after post-action verification succeeds. If the action fires and the status write fails, you know to verify and (if necessary) re-fire. If the status write succeeds and the action fails, you verify and fire exactly once via the recovery path.

## Use It

`code/main.py` implements a checkpointed workflow with idempotency, preconditions, verify, and rollback. The driver simulates four scenarios: clean run, retry after crash (idempotency catches), precondition fail (workflow aborts without firing), verify fail (rollback fires).

## Ship It

`outputs/skill-rollback-rehearsal.md` designs a rollback-rehearsal test for a proposed workflow and audits the checkpoint backend for audit-trail persistence.

## Exercises

1. Run `code/main.py`. Verify the four scenarios. For the crash-during-commit case, confirm the action fires exactly once across retries.

2. Modify the "mark as done first, then do it" pattern so the status write fires after the action. Rerun the crash scenario. Measure how many duplicate actions fire.

3. Design a rollback plan for a specific production action (e.g., "post to a Slack channel"). Classify as in-band, compensating, or out-of-band. Justify the choice.

4. Take one workflow you know. Identify every state transition. Mark each with a durability requirement (persist / do not persist). Count the ones you are currently not persisting.

5. Rehearsed-rollback test: design an end-to-end test that runs a real workflow, crashes it, and confirms the rollback path fires. What does the test assert?

## Key Terms

| Term | What people say | What it actually means |
|---|---|---|
| Checkpoint | "Save point" | Every graph-state transition persists to a durable store |
| Lease | "Worker claim" | Short-lived claim that a worker is executing a run; expires on crash |
| Precondition | "State gate" | Assertion that the state is still consistent with the approved action |
| Post-action verify | "Re-read check" | Confirm the side effect actually happened in the target system |
| In-band rollback | "Direct undo" | Reverse the side effect with the inverse operation |
| Compensating transaction | "SAGA undo" | A new action that neutralizes the original |
| Mark-as-done-first | "Status write order" | Persist the committed status before returning from commit |
| Article 14 | "EU AI Act human oversight" | Operational: queryable checkpoints, rehearsed rollbacks, auditable trail |

## Further Reading

- [Microsoft Agent Framework — Checkpointing and HITL](https://learn.microsoft.com/en-us/agent-framework/workflows/human-in-the-loop) — checkpoint primitives and lease recovery.
- [Cloudflare Agents — Human in the loop](https://developers.cloudflare.com/agents/concepts/human-in-the-loop/) — Durable Objects as a state substrate.
- [EU AI Act — Article 14: Human oversight](https://artificialintelligenceact.eu/article/14/) — regulatory baseline.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — reliability framing for long-horizon workflows.
- [Anthropic — Claude Code Agent SDK: agent loop](https://code.claude.com/docs/en/agent-sdk/agent-loop) — workflow shape for Claude Code Routines.
