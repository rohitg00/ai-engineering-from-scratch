---
id: fail-closed-proof-record
title: A proof record that stays unknown without a compiler
card: evidence-reverse-engineering
kind: design
level: 4
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, design-review]
tags: [reverse-engineering, proof, verification, evidence, fail-closed]
minutes: 15
lessons: [phases/13-tools-and-protocols/36-rebuild-and-prove-equal, phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns]
manuals: [reverse-engineering-101#s-verify-reconstruction, reverse-engineering-101#s-a-proof-harness-outside-rea]
practice: []
cheatsheet: [reverse-engineering]
related: [evidence-reverse-engineering/byte-match-is-not-source, evidence-reverse-engineering/hazard-grid-estimate]
updated: 2026-11-03
---

Design the proof record for a rebuilt function that an obligation ledger will accept. The analysis tool's own verifier grades declared claims against comparison records, and its fixed limitation reads "Pass means every declared claim passed; it does not establish global implementation equivalence"; its readiness rule says that nothing weaker than pass adds up to pass. Your CI host has no C compiler. Say what your record contains, how its id is formed, which claims it can and cannot carry from the tool, and what status it gets on that host.

## Short answer

Mint one evidence record of your own, since no public tool emits it, and give it `predicate_type: rea.reconstruction-proof`, `operation: verify_reconstruction_obligations`, `confidence: observed`, `authority: controlled-replay`, and a `normalized_result` with `passed`, `status` and a list of claims, each `behavioral` or `structural-function` with its status and the `ev_` ids of the function dossiers it rests on, repeated in `evidence_links`. The id is `ev_` plus the SHA-256 of the record without its id over sorted-key compact JSON. Aggregation is fail-closed: `fail` wins, then `unknown`, and an empty claim list is `unknown`. The tool's verifier can only grade a `structural-function` claim as same provider text on one dimension, so behaviour and bytes come from your own two legs; on a host without a compiler the behavioural claims are `unknown`, and the record says `unknown` even when both byte claims pass.

## Full answer

### Why the tool's pass is not enough

A `structural-function` claim names one of nine dimensions of a `compare_functions` record, and the verifier computes its status in a fixed order: any limitation makes it `unknown`, an observed `changed` makes it `fail`, an observed `unknown` or an open residual unknown makes it `unknown`, otherwise `pass`. The recorded run sent four claims and got two passes and two failures. The `total` claims failed although both builds came from one source line, because `-O2` unrolled the loop into 62 instructions where `-O1` had 13; different text does not mean different behaviour. The reverse holds too: a rebuild with a wrong constant in a lookup table prints the same assembly text, so a text claim can pass on a wrong function. Nothing in the tool runs a function or compiles one.

### The two legs you run

Leg one compiles the original and the candidate into one program under different names, runs a grid with one class per hazard, and records every cell, including a trap. Leg two recompiles the candidate with the original flags, masks the relocation fields, compares the relocation records by shape, and reads the constants they point at. Each leg produces one claim per function, and each claim links the dossier records of the function it covers. The behavioural claim without a compiler is `unknown`, not skipped and not passed.

### Authority and id

`authority` is `controlled-replay`, because the proof comes from a harness you ran and not from the object file alone; `shipped-artifact` would claim that the file by itself supports equality, which it does not. The id excludes nothing but itself: adding a claim or a run changes the content and the id, so a proof produced later on a host with a compiler is a new record, and both are kept. No public tool emits this record; the obligation ledger expects it, and you mint it.

### Driving the verifier at all

The tool's verifier is one of 65 MCP tools without a CLI command, so a stdio client sends `initialize`, the initialized notification and `tools/call`. Both dossiers and the comparison record must be in the same connection, because the verifier reads the connection's bundle, and a close clears the retained records; export the bundle before you close.

### The readiness rule, copied

A stage result of fail, unknown, unsupported, truncated or skipped never adds up to pass. That sentence is the aggregation function.

## Follow-ups

- **Level 3:** Why is the authority `controlled-replay` and not `shipped-artifact`? Expected: the fact came from a run and a recompile you controlled; the file alone cannot show that two functions are equal.
- **Level 4:** The verifier passed both `percent_change` claims while the comparison's overall status was `unknown`. How? Expected: each claim reads its own dimension; the unknown dimension was `references`, and the residual unknown it opened names only `overall` and `references`.
- **Level 4:** A compiler appears on the CI host next week. What happens to the record? Expected: the behavioural claims rerun and pass, the content changes, so a new id is minted, and the earlier `unknown` record is kept as history.

## Wrong answers

- "A pass from the verifier proves the rebuild equals the original." Its own limitation says otherwise; it compared decompiler text on one dimension.
- "Mark the behavioural claims passed on CI since the bytes matched." Nothing weaker than pass adds up to pass; a missing run is `unknown`.
- "Keep the same id after adding the run results." The id is a content hash; a changed record is a new record.

## Taught in

The [rebuild lesson](../../../phases/13-tools-and-protocols/36-rebuild-and-prove-equal/) mints the record and its fail-closed aggregate, the [verification section](../../../manuals/reverse-engineering-101/sections/7-1-verify-reconstruction.md) shows the four graded claims and the readiness rule, and the [proof harness section](../../../manuals/reverse-engineering-101/sections/7-2-a-proof-harness-outside-rea.md) runs the two legs.
