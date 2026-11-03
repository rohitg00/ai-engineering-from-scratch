---
id: an-empty-list-is-not-none
title: An empty list that an agent read as none
card: scenarios
kind: incident
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [evidence, coverage, unknowns, reverse-engineering, agents]
minutes: 25
lessons: [phases/14-agent-engineering/26-failure-modes-agentic]
manuals: []
practice: []
cheatsheet: []
related: [scenarios/plausible-is-not-equal, scenarios/exit-zero-was-not-a-pass]
updated: 2026-11-03
system:
  version: rea 6.7.0 at 27dc42d with the Ghidra provider
  model: no model; the fixtures are the ledger binaries built at -O1 and -O2
  hardware: one aarch64 Mac
source:
  - manuals/reverse-engineering-101/capture/out/10-mcp-09-analyze-function-percent-change-O1.json
  - manuals/reverse-engineering-101/capture/out/11-inspect-evidence-bundle-O1.json
  - manuals/reverse-engineering-101/sections/5-2-residual-unknowns-and-coverage.md
  - manuals/reverse-engineering-101/sections/4-6-analyze-function-and-pseudocode.md
---

## Situation

A coding agent investigates the arm64 executable `ledger-arm64-O1` through the rea MCP server, with the Ghidra provider behind it. Its task is a security review of the division in `_percent_change`. The agent calls `analyze_function` once and writes in its report: "The function is a leaf. It calls nothing, so the division cannot reach a callback or a handler." A reviewer asks where that sentence comes from. The agent points at one line of the dossier, the `callees` array, which is empty.

The reviewer does not accept the line as proof and asks you to say what the dossier does and does not establish. You have the dossier, the row of the same record in the bundle summary, and the manual pages that describe both. The report is due in an hour, and the sentence about the leaf is the one that the rest of the review rests on.

## Evidence

- [the callees array of the dossier](evidence/the-callees-line.txt)
- [the unresolved_calls array of the same dossier](evidence/unresolved-calls.txt)
- [the relationship_coverage block of the record](evidence/the-coverage-block.txt)
- [the ten limitations of the record](evidence/the-limitations.txt)
- [the value_flow counts of the same record in the bundle summary](evidence/value-flow-counts.txt)
- [the head of the bundle summary](evidence/bundle-summary-head.txt)
- [the assembly facet of the same dossier](evidence/the-assembly-facet.txt)

## Questions

1. The callees array is empty. Name two different states of the world that produce that same line.
2. Which field of the record says how complete the callees set is, and what does its value cover?
3. The limitations list is long. Which one qualifies the callees array, and how does it change the sentence in the report?
4. The bundle summary reports counts for the value flow. Why does rea stand behind a zero there and not behind an empty array in the dossier?
5. What evidence in the same record settles whether the function makes a call? Write the sentence that the report should carry instead.
6. If no facet settled the question, what would you record, and what would close it?

## Walkthrough

1. **Separate the array from the claim.** An empty `callees` array says that the provider returned no resolved call reference. It does not say that no call exists. The two states that give the same line are a function with no calls and a function whose calls Ghidra could not resolve to a target. The agent picked one state without looking further.
2. **Read the second empty list.** `unresolved_calls` is also empty. That removes one case: Ghidra saw no call site with an unknown destination. It does not remove computed or indirect flows that never became a reference at all.
3. **Read the coverage block.** `relationship_coverage.status` is `complete`, and its diagnostic says that only resolved Ghidra call references are returned, and that unresolved computed or indirect calls remain unknown. Complete means that rea returned the whole resolved set without a read limit. It is a statement about the provider's read, not about the program at run time.
4. **Find the limitation that applies.** The seventh of the ten strings says that resolved reference metadata identifies the edges that Ghidra found, and that unresolved targetless flows remain unknown. The record itself tells you how to read its empty arrays. The manual's rule is the same: missing coverage means unknown, not absent.
5. **Compare with a count that carries a statement.** The bundle summary shows the `value_flow` object of the same record: `truncated` is false, and the omitted operations, inputs and edges are all 0. Those zeros come with a flag that says nothing was cut. The `callees` array carries no such flag. A zero with a truncation statement is a count. An empty list without one is an observation that nothing was seen.
6. **Read the unknown counters.** The summary head says `unknown_revisions` is 0. That number means that no unknown had been recorded when the bundle was exported. It does not mean that the investigation has no open questions.
7. **Use the observed facet.** The assembly facet holds six instructions: a compare and branch on zero, a subtract, a move of the constant, a multiply, a signed divide, and a return. None of them transfers control to another function. The assembly is the Listing text that Ghidra observed, and it is the evidence that the leaf claim needs. The callees array was the wrong line to cite for a true sentence.

## Resolution

The claim in the report was right, and the evidence under it was wrong. The corrected sentence reads: "The assembly of `_percent_change` has six instructions and no call instruction; the dossier reports no resolved callee with complete coverage over resolved references, and the record states that unresolved targetless flows remain unknown." The report cites the assembly facet, the coverage block and the limitation, and it quotes the `callees` array as a secondary observation only.

The team also changes how the agent writes. A rule in its instructions now says that an empty list is reported as "none observed" with the coverage status beside it, never as "none". When no observed facet settles a question, the agent calls `record_unknown` with the question, the authority that would close it, and a recommended probe. For a call question that would be `shipped-artifact` authority and `observed` confidence, from the assembly or a process capture, as the unknowns that `compare_functions` opens already ask for.

## Wrong turns

- "The callees array is empty and the coverage is complete, so the function provably calls nothing." Complete covers the resolved references that Ghidra returned. The record's own limitation says that unresolved targetless flows stay unknown.
- "Record a residual unknown and ship the report with the question open." The same record holds an observed facet that answers the question. Read every facet before you open an unknown.
- "The bundle summary says zero unknowns, so nothing is open." That counter reports the unknowns that were recorded. It cannot count the questions that nobody wrote down.
- "Trust the pseudocode; it shows no function call either." The pseudocode is a decompiler reading with low-confidence types, as the same manual shows for this function. Cite the instructions, not the reading of them.

## Generalize

A list in a tool result is a claim about what the tool saw, not about what exists. Before you turn an empty list into "none", find the field that states the coverage of that list and the limitation that qualifies it, and prefer a count that comes with a truncation flag over an array that comes with nothing. When one facet is an interpretation, look for the facet that is an observation of the same thing, and cite that one. When no observation settles the question, write the question down with the evidence that would close it.

## Taught in

The [coverage page of Reverse Engineering 101](../../../manuals/reverse-engineering-101/sections/5-2-residual-unknowns-and-coverage.md#what-an-empty-list-proves) reads these same lines, the [dossier page](../../../manuals/reverse-engineering-101/sections/4-6-analyze-function-and-pseudocode.md) lists the sixteen facets and shows the six instructions, the [failure modes lesson](../../../phases/14-agent-engineering/26-failure-modes-agentic/) names a claim that outruns its evidence as an agent hallucination, and [lesson 35](../../../phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/) builds the unknowns ledger in Python.
