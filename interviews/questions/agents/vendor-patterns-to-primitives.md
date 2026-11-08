---
id: vendor-patterns-to-primitives
title: Translate eight harness patterns into primitives
card: agents
kind: concept
level: 4
roles: [agentic-ai-engineer, ai-developer-relations-engineer]
rounds: [ml-depth, system-design]
tags: [primitives, harness, queues, authorization, session-persistence]
minutes: 15
lessons: [phases/14-agent-engineering/31-agent-workbench-why-models-fail]
manuals: []
practice: []
cheatsheet: [agent-harness, production-agent-runtimes]
related: [agents/harness-or-a-smarter-model]
updated: 2026-11-03
---

A vendor deck lists its harness features: a loop that re-injects the original intent when the agent tries to stop early, a plan-execute-verify split, control-plane separation, signed tool-call passports, progressive compaction, hooks, skills with progressive disclosure, and sandboxed agents. Translate each one into the primitive it is, and say what the deck leaves out.

## Short answer

Every entry is a distributed-systems primitive with a new name. The re-inject loop is a trigger that re-enqueues the task with fresh context, plan-execute-verify is three workers with a queue between them, the passport is an authorization policy enforced by a pre-action worker, and compaction is a state-management worker over session persistence. Hooks are triggers around the invocation path, skills are a function registry whose metadata loads just in time, sandboxes are the compute plane, and the control-plane item is the control-plane and data-plane split that predates agents. The decks usually leave out queues, workers as the unit of deployment, trigger semantics, persistence as its own concern and authorization as a separate plane.

## Full answer

### The eight primitives

| Primitive | What it carries for an agent |
|---|---|
| Function | A tool call, a rule check, a verification step, a model invocation |
| Worker | The builder, the reviewer, the verifier, a protocol server |
| Trigger | A loop tick, an HTTP request, a queue message, a cron, a file change, a hook |
| Runtime | The boundary that decides what runs where, with which timeouts and resources |
| HTTP or RPC | The wire between caller and worker, including the tool-call protocol and the model API |
| Queue | The durable buffer with back-pressure, retry and idempotency: the task board, the feedback log, the review inbox |
| Session persistence | The state file, checkpoints, key-value stores, the repository itself |
| Authorization policy | Allowed and forbidden files, approval boundaries, capability lists |

### The translation

| Deck entry | What it is |
|---|---|
| Re-inject intent when the agent stops early | A trigger that re-enqueues the task with a clean context; persistence carries the goal forward |
| Plan, execute, verify | Three workers, one per role, communicating through state and a queue between phases |
| A control plane apart from the execution plane | The control-plane and data-plane split, decades old |
| A passport that signs each tool call | An authorization policy enforced by a pre-action worker, with a signed audit queue |
| Progressive compaction | A state-management worker that runs on a schedule over session persistence to keep it within a budget |
| Hooks and middleware | Triggers plus functions wrapped around the runtime's invocation path |
| Skills that disclose themselves step by step | A function registry whose metadata is loaded into context only when needed |
| Sandboxed agents | The compute plane: a runtime with isolated filesystem, network and lifecycle |

### How the surfaces map

Instructions are policy plus function metadata. State is session persistence. Scope is an authorization policy per task. Feedback is an invocation log written into a queue. Verification is a deterministic function triggered on task close that fails closed. Review is a separate worker with read-only access to the builder's artifacts and write-only access to review reports. Handoff is a durable record emitted by a session-end trigger and read by the next session's startup trigger.

### What the decks leave out

The lesson reads the circulating writeups and finds the same gap: they describe the harness as an object you configure, not as a system you deploy. They rarely name queues, workers as a deployment unit, trigger semantics, session persistence as a separate concern, or an authorization policy as its own plane. The strongest line in that literature, that the harness is the primary security boundary, is authorization policy restated. When the system is built from the primitives, the surfaces fall out of it. When it is built without them, no amount of instruction-file polish replaces the missing queue.

### Why the translation matters

Vocabulary changes every release cycle. The primitives do not. A team that translates each new pattern before adopting it can compare vendors on one table, spot a pattern that is two primitives wearing one name, and notice when a deck has no answer for persistence or authorization.

## Follow-ups

- **Level 3:** Which primitive is most often missing from an agent product that otherwise looks complete? Expected: the queue, because without a durable buffer the board, the feedback log and the review inbox are chat messages that scroll away.
- **Level 3:** The deck says its hooks are a security boundary. Test the claim. Expected: a hook is a trigger plus a function inside the runtime, and a security boundary is an authorization policy enforced outside the agent's reach, so ask where the policy lives and who can change it.
- **Level 4:** Two vendors describe the same thing as a handoff and as a checkpoint. How do you tell? Expected: map both to persistence and triggers, and see whether the record is read by the next session's startup trigger, which makes it a handoff, or by the same session on resume, which makes it a checkpoint.
- **Level 4:** What would make a ninth primitive legitimate? Expected: a capability that cannot be built from the eight, which is rare, so the first check is whether it is a shared-state flavor or a policy flavor you have not seen.

## Wrong answers

- "These patterns are new because agents are new." Each one has a name in distributed systems, and the agent label changes the vocabulary and not the engineering.
- "Pick the vendor with the most patterns." More names on a deck is not more primitives covered, and the question is which of the eight are missing.
- "A good instruction file is the harness." Instructions are policy and function metadata, one of eight, and a file cannot replace a queue or a persistence layer.

## Taught in

The [why capable models still fail lesson](../../../phases/14-agent-engineering/31-agent-workbench-why-models-fail/) gives the primitive table, the translation of circulating patterns and the gaps in the vendor writeups.
