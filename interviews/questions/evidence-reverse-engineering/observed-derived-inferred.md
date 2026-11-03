---
id: observed-derived-inferred
title: Three words for one sentence about grade(55)
card: evidence-reverse-engineering
kind: concept
level: 1
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [screen, ml-breadth]
tags: [reverse-engineering, evidence, confidence, authority, decompiler]
minutes: 6
lessons: [phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns]
manuals: [reverse-engineering-101#s-the-evidence-record]
practice: []
cheatsheet: [reverse-engineering]
related: []
updated: 2026-11-03
---

An agent asks a decompiler for `grade`, reads the default branch of the pseudocode, and reports "grade(55) returns 0, observed". The pseudocode line is `uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);` and the bytes at that point are `xor eax, eax`. Which of the three confidence words belongs on each claim hidden in that sentence?

## Short answer

Confidence is one of three words and never a number: `observed` is a fact read from bytes or from a run, `derived` is a fact computed from observed records, and `inferred` is an expectation that no observation states yet. The record is observed about what the decompiler printed, with authority `shipped-artifact`, because the file on disk was the source. That the default value is 0 is derived, from the listing's `xor` and from the expression, which is always 0 and never says 0. That `grade(55)` returns 0 when the function runs stays inferred until an `execute_function` record with authority `controlled-replay` agrees with it.

## Full answer

### The two enums

| Value | Meaning |
|---|---|
| `observed` | read from bytes or from a run |
| `derived` | computed from observed records |
| `inferred` | an expectation no observation states |
| `shipped-artifact` | the file on disk was the source |
| `controlled-replay` | a run you controlled produced the fact |
| `analyst-inference` | your own judgement |
| `historical-reference` | an older tree or document |
| `external-service` | a service outside the file and the host |

When a producer says nothing, the record gets `observed` and `shipped-artifact`. Read `observed` with care: in a function dossier it means that the tool recorded what the decompiler returned, with the bytes as authority. It does not mean the pseudocode is the program's source.

### The two confusions that cost the most

The first treats pseudocode as an observation of behaviour. It is an observation of what the decompiler printed. The expression above and the instruction both produce 0 for every input, and the agent did not know that; it trusted text because a tool produced it. The second treats an empty list as proof of absence. Missing coverage is unknown, not absence.

### How a claim moves

A claim moves from inferred to supported only through observed runs: `pass` when every input has an agreeing run and none disagrees, `fail` when any run disagrees, `unknown` when some inputs have runs and others do not, `unsupported` when no input has a run. A run of a host build of the same source counts, with the limitation that the object itself never ran. That sentence travels with the claim, because a report that drops it has lost information the reader needs.

## Follow-ups

- **Level 1:** Why is confidence a word rather than a probability? Expected: the three words name the kind of support, and a number would hide which kind it was.
- **Level 2:** A run of the same source compiled for the host agrees with the prediction. Is the claim about the x86-64 object observed? Expected: yes, with the limitation that a host build ran and the object did not; it is the strongest observation without an emulator.
- **Level 2:** Which authority does a run under your own harness receive? Expected: `controlled-replay`, as opposed to `shipped-artifact` for a read of the file.
- **Level 3:** The decompiler's signature says the function returns 16 bytes and takes a third parameter. Which word? Expected: the provider's inference; the dossier marks its return-type confidence low, and the record should say so.

## Wrong answers

- "It is observed because a tool produced it." The tool's text is observed; the behaviour it describes is derived or inferred.
- "Give it a confidence of ninety percent." Confidence is a category with three values, not a number.
- "The expression is a decompiler bug." It is correct and unreadable; two spellings of one bit cancel, and the instruction says it in two bytes.

## Taught in

The [evidence lesson](../../../phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/) builds a ledger with the three words and five authorities, and the [evidence record section](../../../manuals/reverse-engineering-101/sections/5-1-the-evidence-record.md) shows the fields on a recorded dossier.
