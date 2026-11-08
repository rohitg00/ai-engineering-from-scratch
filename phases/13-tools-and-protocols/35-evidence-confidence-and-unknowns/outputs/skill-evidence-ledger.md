---
name: evidence-ledger
description: Record binary analysis findings as observed, derived, or inferred evidence with content-hash ids, and refuse to state a result without an observed run.
version: 1.0.0
phase: 13
lesson: 35
tags: [reverse-engineering, evidence, confidence, unknowns, ghidra, rea]
---

Given a program you compiled yourself and a set of questions about it, keep one ledger of evidence records and one list of residual unknowns. Every sentence in the final report cites an evidence id. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The target file, its SHA-256, its format, and its architecture.
- The provider for each observation: a tool name and version, or the analyst.
- The analysis profile of each provider run, including every contract version string.
- The questions to answer, each with the authority and confidence that would settle it.
- A host compiler and a test program when the questions are about behaviour.
- The authorization that covers the target. Analyze only programs you own or have written permission to analyze.

## Procedure

1. Hash the target. Put the digest, format, and architecture in every subject. Keep name and path out of the identity.
2. Give every record one confidence. `observed` means read from bytes or from a run. `derived` means computed from observed records. `inferred` means an expectation.
3. Give every record one authority. `shipped-artifact` means a read of the file. `controlled-replay` means a run you controlled. `analyst-inference` means your own judgement.
4. Compute `evidence_id` as `ev_` plus SHA-256 over the canonical JSON (RFC 8785) of the record. Leave out the id, the name, and the path.
5. Record provider limitations verbatim. Add your own limitation when a run used a different build than the file under analysis.
6. Link every derived and inferred record to the records it rests on through `evidence_links`.
7. Open one unknown per question. Store the question, the scope digest, the severity, the required confidence, the required authority, and one recommended probe.
8. Make every change to an unknown a new revision that names the digest of the revision before it. Refuse a change whose expected revision is stale.
9. Check a behaviour claim only against observed run records that name the same function and arguments. Count the inputs that have a run.
10. Report `pass` when every input has an agreeing run. Report `fail` when any run disagrees. Report `unknown` when some inputs have no run. Report `unsupported` when none do.
11. Resolve an unknown only with evidence ids that have the required confidence and authority. A sentence does not close an unknown.
12. Cache provider answers under a key that covers the target, the provider, the profile digest, the operation, and the parameters. Refuse a snapshot whose profile digest or format version differs.

## Required ledger

For every claim, report:

- claim text and the function and arguments it covers
- the prediction record id and the derived records it rests on
- inputs with observed runs, out of the inputs the claim covers
- supporting and contradicting evidence ids
- limitations carried from the supporting records
- status: `pass`, `fail`, `unknown`, or `unsupported`
- the unknown id, its current status, and its revision

For every unknown, report the question, the severity, the required authority, the current status, and the revision count.

## Hard rejects

- A result stated from pseudocode or a disassembly listing with no observed run.
- A `pass` for a claim whose inputs are only partly covered by runs.
- A `fail` or a `pass` written from an empty list. An empty list is `unknown`.
- An evidence id computed over the local path or the file name.
- A record whose analysis profile names a different provider than the record.
- An unknown resolved with derived or inferred evidence, or with no evidence id.
- An unknown changed without the current revision number.
- A snapshot replayed after a contract version string changed.
- A record that drops a provider limitation.
- A run record that hides the fact that it executed a different build of the same source.
- A claim that calls static analysis an observation of execution.

## Produce

Return these sections:

1. Target: digest, format, architecture, build command, and authorization.
2. Evidence: every record with id, confidence, authority, operation, and limitations.
3. Claims: the required ledger above, one row per claim.
4. Unknowns: open, investigating, blocked, contradicted, and resolved, each with its revision chain.
5. Cache: the snapshot key fields, the entries reused, and every refused import with its reason.
6. Completion: the `ecl_` id, the count per status, and whether every claim passed.

End with the first unknown that still blocks a complete answer, and the probe that would close it.
