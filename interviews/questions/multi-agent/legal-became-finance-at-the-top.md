---
id: legal-became-finance-at-the-top
title: The legal question came back as finance findings
card: multi-agent
kind: debug
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [hierarchy, decomposition-drift, canary, provenance, depth-cap]
minutes: 12
lessons: [phases/16-multi-agent-and-swarms/06-hierarchical-architecture]
manuals: []
practice: []
cheatsheet: [multi-agent, multi-agent-case-studies]
related: [multi-agent/two-workers-return-different-facts]
updated: 2026-11-03
---

A three-level agent hierarchy reviews a contract. The top manager splits the work into an engineering branch and a legal branch, each with its own sub-manager and workers. The final report is complete and confident, and it contains finance findings where the legal review should be. Nobody asked a finance question. Trace the failure and say what you change in the design.

## Short answer

The top manager mislabeled the legal branch as finance when it decomposed the task. The sub-manager did what it was given, the workers did finance work well, and the top synthesizer reported finance findings. The error surfaced only at the top, one level away from any point where a human could have caught it. The design fixes are a depth cap of two, provenance on every synthesis, a logged decomposition that is checked against the original question, and a canary worker that is always asked the user's question unchanged.

## Full answer

### Why hierarchy hides this

A human manager has stable knowledge of what each team does. A model manager re-derives the whole structure every turn from whatever is in its context. A small drift in that context changes the decomposition, and every level below works on the drifted version in good faith. The lesson names three failure modes, and this incident is the first:

| Failure | Mechanism |
|---|---|
| Task assignment error | The manager hallucinates a decomposition and sends work to the wrong branch |
| Output misinterpretation | A sub-manager returns "unable to verify claim X" and the top reports "claim X not confirmed", and meaning drifts at every level |
| Consensus loop | Two sub-managers disagree, the top asks them to reconcile, they re-delegate, workers re-run, and the loop continues until a step limit |

### Trace it

1. Read the top manager's decomposition log. The branch label is "finance", not "legal".
2. Read the sub-manager's input. It received a finance task and had no way to know it was wrong.
3. Read the synthesis. It cites finance findings. The original legal question appears nowhere.

The side-by-side of what was asked and what was delivered is the whole diagnosis.

### The design changes

- **Cap the depth at two.** Three levels already hide most errors from observability.
- **Provenance on every synthesis.** Each node's summary cites the leaf outputs that produced it, so a report can be traced to the workers who wrote it.
- **Alert on decomposition drift.** Log the manager's decomposition at each step and compare it with the user's question. When the decomposition no longer covers the question, fire an alert before the workers start.
- **A canary worker per sub-manager.** One worker is always asked the original question unchanged. When the canary's answer disagrees with the synthesized answer, the manager stops and escalates instead of merging.
- **An explicit reconciliation budget.** Set the rounds before the top must commit, usually two.

### The deciding question

Before you keep the hierarchy, ask whether the task has independent sub-teams or is a linear flow that looks like a tree. A contract review with legal and engineering branches is a real tree. A task where step two needs step one is a pipeline, and sequential beats hierarchical there.

## Follow-ups

- **Level 3:** How many levels did the error travel before the output diverged from the question? Expected: one, because the mislabel happened at the top and every level below executed it faithfully, which is why the depth cap is two.
- **Level 3:** The canary's answer and the merged answer differ. What does the manager do? Expected: stop, record both answers with provenance, and escalate to a human or re-decompose, never merge the two.
- **Level 4:** How do you detect meaning drift between levels? Expected: compare each node's summary with the leaf outputs it cites, and flag a summary that changes the modality of a claim, such as unverified becoming false.
- **Level 4:** The reconciliation loop keeps hitting its step limit. What does that tell you? Expected: the limit is now a hyperparameter that hides a disagreement, so either the decomposition is wrong or the question has no single answer, and the top must report the disagreement.

## Wrong answers

- "Add a fourth level to check the third." More levels hide more errors from observability, and the fix is fewer levels with provenance.
- "Tell the sub-manager to double-check the task it receives." The sub-manager had no access to the original question, and a canary worker is the mechanism that gives it one.
- "Use a bigger model for the top manager." A bigger manager still re-derives the structure each turn from its context, and the mislabel is a context drift, not a capability gap.

## Taught in

The [hierarchical architecture lesson](../../../phases/16-multi-agent-and-swarms/06-hierarchical-architecture/) runs the happy path against the mislabeled path and lists the guards.
