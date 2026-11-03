---
id: listing-before-pseudocode
title: Four tests pass and the rebuild is 26 bytes long
card: evidence-reverse-engineering
kind: debug
level: 2
roles: [agentic-ai-engineer, applied-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, coding]
tags: [reverse-engineering, decompiler, pseudocode, rebuild, integer-width]
minutes: 8
lessons: [phases/13-tools-and-protocols/34-lifting-to-pseudocode, phases/13-tools-and-protocols/36-rebuild-and-prove-equal]
manuals: [reverse-engineering-101#s-a-proof-harness-outside-rea]
practice: []
cheatsheet: [reverse-engineering]
related: [evidence-reverse-engineering/observed-derived-inferred]
updated: 2026-11-03
---

From the decompiler's pseudocode, an agent rebuilds `percent_change`. The pseudocode reads `undefined1 [16] percent_change(int param_1, int param_2, ulong param_3)` with `lVar1 = (long)((param_2 - param_1) * 100)`. The rebuild is `(int)(((long)after - before) * 100 / before)`, and four hand-written tests pass. The listing of the same record reads `IMUL EAX, ESI, 0x64`, `CDQ`, `IDIV EDI`. What went wrong, and what is the rule?

## Short answer

The 16-byte return and the third parameter are the decompiler's inference, not the program: `idiv` writes the pair `EDX:EAX`, the zero path leaves `EDX` untouched, so the decompiler modelled a 16-byte result and read `%rdx` as an input. The listing says every operation is 32 bits wide, so the honest rebuild is `100 * (after - before) / before` in `int`; the `long` version divides the unwrapped product and fails 26 of the overflow cells while compiling to 26 bytes where the original has 16. The rule is to read the listing before the pseudocode, write the rebuild from the operation widths, and cite the record id it came from.

## Full answer

### Instruction or guess, line by line

| Difference | Verdict |
|---|---|
| return type `undefined1 [16]` against `int` | guess; `idivl` writes two registers and no caller fixes the width |
| `param_3` | guess that follows from the first; `%rdx` is read on the zero path only because the return width was guessed |
| `lVar1 / (long)param_1 & 0xffffffff` against `/ param_1` | instruction; `cltd` plus `idivl` is a sign-extended 32-bit division, and both texts describe it |
| `if (param_1 != 0)` first | instruction order; the branch jumps to the zero return, and either arm may be printed first |

A difference with an instruction behind it is a presentation choice. A difference with no instruction behind it is a guess, and the guess can be on either side.

### Why four tests passed

The naive cases avoid every hard class. The wrapped and unwrapped products agree whenever `(after - before) * 100` fits in 32 bits, so a test that never crosses that line sees two equal functions. On a grid with overflow cells, the `long` rebuild fails 26 cells, every one with `|before| > 1`; for `before` equal to 1 or -1 the 64-bit quotient truncates back to the wrapped value and the two agree by accident.

### The size told you first

Compiled with the original flags, the `long` rebuild is 26 bytes: `movslq`, `imulq`, `cqto` and `idivq` replaced the 32-bit forms. Size is a diagnostic and never an acceptance, and the listing had shown the widths before any compile.

### What the research says about this pattern

A 2026 study of decompilation systems found candidates that passed every test in a benchmark and still diverged on fuzzed inputs. The strongest refinement model raised the build rate from 75 to 90 percent while the behavioural match rate fell from 74 to 62 percent, and the cause was invented fields, types, callees and guards that replaced the visible unknowns a decompiler leaves in its text. The `long` rebuild is an invented type.

## Follow-ups

- **Level 2:** Why did the four tests not catch it? Expected: none of them made the product exceed 32 bits, and the two versions agree everywhere the product fits.
- **Level 3:** Which inputs expose the difference, and which hide it by accident? Expected: overflow cells with `|before| > 1` fail; `before` of 1 or -1 agree because the wide quotient truncates to the wrapped value.
- **Level 3:** What did the 26-byte size tell you before any run? Expected: wider instruction forms replaced the 32-bit ones, so the candidate computes in a different width than the listing.
- **Level 4:** How does the refinement-model finding change how you read clean pseudocode? Expected: a clean signature is right for the wrong reason when it fills an unknown; keep the ugly honest form and record what no instruction supports.

## Wrong answers

- "The decompiler is broken; ignore its output." Its instructions were right; only the parts the instructions leave open were guessed, and the listing in the same record is the correction.
- "The `& 0xffffffff` is a decompiler bug." It describes the truncation of a sign-extended division correctly.
- "Ten tests pass, ship it." A grid with overflow, negative, rounding and trap cells is the test; the ten cases avoided every hazard.

## Taught in

The [lifting lesson](../../../phases/13-tools-and-protocols/34-lifting-to-pseudocode/) fills the difference table, the [rebuild lesson](../../../phases/13-tools-and-protocols/36-rebuild-and-prove-equal/) runs the grid, and the [proof harness section](../../../manuals/reverse-engineering-101/sections/7-2-a-proof-harness-outside-rea.md) records the 26 failing cells and the 26-byte candidate.
