---
id: resolved-breakpoint-zero-hits
title: Every breakpoint resolved and none was hit
card: evidence-reverse-engineering
kind: debug
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [debugging, coding]
tags: [reverse-engineering, dynamic-analysis, debugger, inlining, verdicts]
minutes: 10
lessons: [phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program, phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns]
manuals: []
practice: []
cheatsheet: [reverse-engineering]
related: [evidence-reverse-engineering/observed-derived-inferred, evidence-reverse-engineering/empty-list-is-not-absence]
updated: 2026-11-03
---

An agent reports "main calls `bump`, `classify` and `sum_balances`". You build the program at `-O2`, set a breakpoint on each name, and run it under the debugger. The program prints its four lines and exits with status 0, and `breakpoint list` shows every breakpoint `resolved` with `hit count = 0`. Grade the agent's claim and the seven other static claims in the plan, and name the harness mistake that would have produced a transcript with no stops on a build where the calls do happen.

## Short answer

Each breakpoint resolved, so the symbol exists and a trap was written at its address; a hit count of zero after a full run with exit status 0 means no instruction fetch reached it, so for this build the call-edge claim is refuted, and only that one, because the compiler inlined all three calls and folded the sum into the constant 315. The output claim is confirmed by the four lines and the exit status, and the argument-register, field-offset, store and stride claims are not-observed, because no stop could test them, with the hit counts as the reason. The harness mistake is `--auto-continue`: such a breakpoint reports no stop and the stop hook never runs, so a first version of the harness recorded nothing even on the unoptimized build where every call happens; plain breakpoints, a stop hook and a fixed budget of `continue` commands fix it.

## Full answer

### Three verdicts and never a fourth

A stop that tested a claim and agreed is `confirmed`; a stop that tested it and disagreed is `refuted`; a claim no stop could test is `not-observed`, with the reason. The ledger accepts the first two as observed records with authority `controlled-replay` and keeps the third as an open unknown. A resolved breakpoint never stands in for a run.

### What the refutation does and does not say

The claim was that `main` calls the three functions in this program. For this build and this run it does not, and the harness checked that the run completed, since a hit count of zero before exit would mean only that the run had not reached the call yet. The claim did not say the functions are dead code, and the run does not say that either: `nm` still lists them because they are external and another object could call them, and the debug information for the optimized build has four subprograms and zero inlined-subroutine entries, so even it does not record the inlining. The struct still has `balance` at offset 4 in this build; no stop read memory to show it, and `not-observed` keeps that distinction.

### The unoptimized run for contrast

The same plan on the `-O0` build produced eleven stops: hit counts 1, 3, 1 for the three names and 2, 1, 1, 1 for the four edge breakpoints placed at the target and fall-through of two conditional branches. The watchpoint on `a->balance` fired once with old value 250 and new value 255, which is one write of `by` equal to 5, and the first row of memory read at the entry stop decoded word by word against the DWARF offsets. All eight claims ended `confirmed` there.

### Two more transcript traps

An address breakpoint set without naming the module stays `unresolved` with `hit count = 0` for the whole run, because a bare number before the process exists has no section behind it; the form that connects a listing address to a load address names the module. And the first `continue` after the process has exited ends the whole command file unless `interpreter.stop-command-source-on-error` is false, so `breakpoint list` never runs and the transcript has no hit counts to read.

## Follow-ups

- **Level 3:** Why does the run refute the call edges without making the functions dead code? Expected: the claim was about this program's `main`; the functions are exported and another object could call them.
- **Level 3:** Where does the watchpoint on `a->balance` go in the optimized run? Expected: nowhere; it is set at the `bump` stop, which never happens, so the store claim is not-observed; a register-resident local would never fire either.
- **Level 4:** The transcript stops before `breakpoint list`. What happened and what changes? Expected: a `continue` after exit ended the command file; set the interpreter not to stop sourcing on error so the table prints.
- **Level 4:** Why keep the transcript and not only the verdicts? Expected: the verdicts are derived from it, anyone can re-derive them, and its header records the command line and the debugger version.

## Wrong answers

- "Hit count zero means the functions are dead code." It means no fetch reached them in this run of this build; they are exported and other callers are possible.
- "`nm` lists them, so they are called." The symbol table lists exported functions; the debug information shows four subprograms and no inlined entries.
- "Use auto-continue so the transcript stays clean." An auto-continue breakpoint reports no stop and the hook never runs; the clean transcript is empty evidence.

## Taught in

The [dynamic analysis lesson](../../../phases/13-tools-and-protocols/42-dynamic-analysis-of-your-own-program/) runs both builds and grades every claim, and the [evidence lesson](../../../phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/) stores the verdicts as observed records and the rest as unknowns.
