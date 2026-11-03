---
id: plan-you-would-reject
title: What you check before you approve an execution plan
card: behavioral
kind: debug
level: 2
roles: [agentic-ai-engineer, applied-ai-engineer, inference-engineer, ai-evaluation-reliability-engineer]
rounds: [behavioral, design-review]
tags: [planning, evidence, dependencies, review]
minutes: 10
lessons: [phases/14-agent-engineering/44-plan-from-evidence]
manuals: []
practice: []
cheatsheet: [agent-planning]
related: [behavioral/leave-work-resumable, behavioral/split-that-only-looks-parallel]
updated: 2026-11-03
---

A teammate, or a coding agent, hands you this plan for a change to a public API: update the endpoint, add tests, update the documentation. They want approval to start. What do you ask for before you say yes, and what would make you reject the plan outright?

## Short answer

That list repeats the request in future tense. I ask for five things on each item: a stable identifier, the smallest change, the repository facts that justify it, the items it depends on, and the exact check that closes it. I reject a plan with a duplicate identifier, an item without evidence or proof, a dependency on an unknown item, a cycle, or an irreversible step scheduled before the uncertainty it depends on is resolved.

## Full answer

### Why the three-line plan fails

Nothing in it says what was found in the repository, why those files are the right ones, which contract changes first, or what can run at the same time. Someone can complete every line and still create rework.

### The five commitments

| Commitment | Purpose |
|---|---|
| Identifier | A stable reference for dependencies and handoff |
| Change | The smallest behavior or contract change |
| Evidence | Repository facts that justify the change |
| Dependencies | Work that must be true first |
| Proof | The exact check that closes the item |

### Order by dependency, not by prose

When several surfaces depend on one behavior, the contract comes first. Tests, implementation and documentation then share one definition instead of inventing four. A dependency graph also shows safe concurrency: implementation and documentation can proceed together after the contract is fixed, and the integration gate waits for both.

### Evidence must be able to change the plan

An existing helper removes a planned abstraction. A compatibility test forces a migration step. A deployment constraint moves a schema change into another task. If a piece of evidence cannot change the plan, it is decoration, not evidence.

### The rejection list

The first five checks are mechanical: duplicate identifiers, items without evidence, items without proof, unknown dependencies, cycles. The last check needs judgment: does the first irreversible action, such as a migration or a public release, happen before the relevant uncertainty is resolved? I call that one out explicitly in the review.

## Follow-ups

- **Level 2:** One item lists two proof commands. What do you do? Expected: split it into two items, because one item needs one clear completion proof.
- **Level 2:** Two items depend on each other. What does that usually hide? Expected: an unresolved product or design disagreement; the cycle is the symptom, the missing decision is the cause.
- **Level 3:** The plan sits in a chat thread as checked boxes. Why is that a problem? Expected: a session can end at any moment, and another person cannot see which proof ran or which item is now unblocked; the plan belongs next to the work.
- **Level 3:** A migration item needs a human approval. How do you express that in the graph? Expected: as an explicit item with the approval as its proof, which every dependent item waits for.

## Wrong answers

- "Trust the author and review the result instead." Rework found at review time costs more than a plan rejected before editing.
- "A longer plan is a better plan." Length adds nothing; evidence and proof on each item do.
- "Dependencies are obvious from the order of the list." Prose order hides which steps can run together and which must wait.

## Taught in

The [evidence-backed plan lesson](../../../phases/14-agent-engineering/44-plan-from-evidence/) gives the five commitments and the validation rules.
