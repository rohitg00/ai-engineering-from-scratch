---
id: locked-bounded-delegated
title: Write a specification that leaves judgment where it belongs
card: behavioral
kind: design
level: 3
roles: [agentic-ai-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [behavioral, design-review]
tags: [specification, decision-modes, proof, invariants]
minutes: 12
lessons: [phases/14-agent-engineering/51-write-specifications-that-preserve-judgment]
manuals: []
practice: []
cheatsheet: [agent-planning, delegation-feedback]
related: [behavioral/agent-decides-alone, behavioral/plan-you-would-reject]
updated: 2026-11-03
---

You hand a task to a coding agent, or to a new engineer, to add a read-only diagnosis step to an incident tool. Last time the brief was two sentences and the result guessed the system. The time before, the brief was a twelve-page design and the result transcribed a mistake in it. How do you write this one?

## Short answer

I write an executable contract with six surfaces: the outcome, the invariants that must always hold, concrete examples, non-goals, a decision policy, and the proof required before completion. Every decision is marked locked, bounded or delegated by its consequence and reversibility. The production-write boundary is locked, the time budget for the data source is bounded, and local structure and names are delegated with an explanation required.

## Full answer

### Two bad extremes

An underspecified task makes the builder guess the system. An overspecified task makes the builder transcribe a design that may already be wrong. The useful middle fixes invariants and evidence and leaves reversible choices open.

### The six surfaces

| Surface | Purpose |
|---|---|
| Outcome | The observable result |
| Invariants | Conditions that must always stay true |
| Examples | Concrete cases that show intent |
| Non-goals | Adjacent behavior excluded on purpose |
| Decision policy | Which choices are locked, bounded or delegated |
| Proof | Evidence required before completion |

### Three decision modes

- Locked: the builder must not choose. Public compatibility, authority, safety, irreversible cost, product commitments.
- Bounded: the builder may choose inside explicit limits. Search budgets, retry counts, allowed dependencies, a known interface family.
- Delegated: the builder owns the choice and explains it. Local structure, names, reversible refactors, implementation detail.

"The implementation may use any read-only source that returns inside the time budget" is not vague. It is a delegated decision with a boundary and a proof.

### Examples compress intent

"Helpful", "robust" and "production-ready" are not executable. A small set of normal, edge, failure and forbidden cases gives the builder and the verifier the same target. Examples do not replace invariants; one passing case cannot prove a universal safety rule.

### Proof matches the claim

A unit test proves a local function contract. A wire test proves serialization and transport. A browser journey proves an interface path. A replay set proves behavior over representative cases. An audit log proves that authority boundaries held. I do not accept a lower layer as proof of a higher-layer claim.

## Follow-ups

- **Level 3:** Someone moves the production-write decision from locked to delegated. The schema accepts it. Why is it still wrong? Expected: the schema checks shape, not product risk; a write to production is irreversible and changes authority, so it stays locked.
- **Level 3:** A retry count is set to a fixed number in the brief. Is that locked or bounded? Expected: bounded is the better mode; the builder may pick inside a stated range and the range carries the reason.
- **Level 4:** Three implementation instructions describe the same behavior. What do you replace them with? Expected: one invariant and two examples, so the intent survives a change of implementation.
- **Level 4:** Why record the reason behind each locked choice? Expected: so a later team can revise it when the evidence changes, without archaeology through old threads.

## Wrong answers

- "Specify every step so nothing can go wrong." A step-by-step script transcribes the author's mistakes and removes the judgment that catches them.
- "Give the goal and trust the builder." Without invariants and proof, the builder guesses the system and the result cannot be verified.
- "A passing unit test proves the feature works." A unit test proves a local contract, not an interface path or an authority boundary.

## Taught in

The [specification lesson](../../../phases/14-agent-engineering/51-write-specifications-that-preserve-judgment/) gives the six surfaces, the three decision modes and the rule that proof must match the claim.
