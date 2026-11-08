---
id: empty-list-is-not-absence
title: callers is empty and coverage says complete
card: evidence-reverse-engineering
kind: concept
level: 1
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [screen, debugging]
tags: [reverse-engineering, evidence, coverage, unknowns, call-graph]
minutes: 6
lessons: [phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns]
manuals: [reverse-engineering-101#s-residual-unknowns-and-coverage, reverse-engineering-101#s-an-agent-investigation]
practice: []
cheatsheet: [reverse-engineering]
related: [evidence-reverse-engineering/observed-derived-inferred]
updated: 2026-11-03
---

In the record, the dossier for the function `_grade` lists `callers: []` and `callees: []`, and its `relationship_coverage.status` reads `complete`. The agent writes "nothing calls grade". What does the record support, and what would make the agent's sentence true?

## Short answer

`complete` means the engine returned every resolved call reference without a known read limit; the diagnostic beside it says that unresolved computed or indirect calls remain unknown. The one incoming reference is a `DATA` reference from the function starts table, not a call instruction, so the record supports "no resolved call instruction targets this function in this build". The design rule is that missing coverage is unknown, not absence, and the agent's sentence needs either a run or an argument that covers indirect calls, so the honest move is to record a residual unknown with the probe that would close it.

## Full answer

### Three values and a null

`relationship_coverage` states how complete the caller and callee sets are: `complete`, `partial` with its limitations and the limited direction, or `unknown` with a reason, and `null` for an operation that reports no call relationships. Provider caveats stay in `limitations` and do not make the coverage partial. One part of a dossier does declare its coverage in numbers: the value flow reports whether it was truncated and how many operations, inputs and edges it omitted. A zero there is a count the tool stands behind; an empty array elsewhere is a count with no such statement.

### The same lesson in two other empty lists

A bundle comparison across two builds lists ten records that are in one bundle only and classifies every one as `unknown` with the kind `unresolved_branch`, because a bundle has no marker that says it is complete. A summary view of a six-file application reports `semantic_unknowns: 118` and marks its coverage `unknown`. Each one proves that nothing was observed, never that nothing exists.

### The record for what is still open

A residual unknown is a durable record with an `unk_` id, a revision chain, a status and the evidence that would close it. The id is a hash of the domain, the question with whitespace collapsed, and the scope digest of the target, so two analysts who ask the same question about the same file get the same id, and a second `record_unknown` answers `already-exists`. Every change is a new revision that names the digest of the one before, each mutation is itself an evidence record with authority `analyst-inference`, and only an observed record of the required authority can mark a resolution `verified`. The unknown for this dossier asks whether anything calls `_grade` at run time, and its probe is a run or a read of the computed targets.

## Follow-ups

- **Level 1:** The dossier does list a single incoming reference. What is it? Expected: a `DATA` reference from the function starts entry, which the unwinder and crash reporter use, not a branch instruction.
- **Level 2:** Why does a zero in the value-flow counts carry more weight than an empty callers array? Expected: the count is a declared statement about truncation that the tool stands behind, while the array has no completeness statement beyond resolved references.
- **Level 2:** How do you write the open question down so it survives the session? Expected: `record_unknown` with the question, the required authority and confidence, and a recommended probe; the id derives from the question.
- **Level 3:** Two analysts update the same unknown. What stops the second from overwriting the first? Expected: `update_unknown` takes `expected_revision` and answers `revision-conflict` when it is stale, so the second rereads the head and decides again.

## Wrong answers

- "`complete` means every call that can happen." It means every resolved reference was returned; indirect and computed calls stay unknown.
- "An empty list means none." It means none observed; the design rule says missing coverage is unknown.
- "Close the unknown with a sentence in the report." A resolution needs evidence ids of the required confidence and authority, never prose.

## Taught in

The [coverage section](../../../manuals/reverse-engineering-101/sections/5-2-residual-unknowns-and-coverage.md) defines the field and the unknown record, the [agent investigation section](../../../manuals/reverse-engineering-101/sections/8-2-an-agent-investigation.md) shows the `DATA` reference trap, and the [evidence lesson](../../../phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/) builds the revision chain.
