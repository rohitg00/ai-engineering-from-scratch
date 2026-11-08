---
id: hazard-grid-estimate
title: How many cells prove two small functions equal
card: evidence-reverse-engineering
kind: estimate
level: 3
roles: [ai-evaluation-reliability-engineer, applied-ai-engineer, agentic-ai-engineer]
rounds: [ml-depth, coding]
tags: [reverse-engineering, differential-testing, input-grid, overflow, undefined-behavior]
minutes: 10
lessons: [phases/13-tools-and-protocols/36-rebuild-and-prove-equal]
manuals: [reverse-engineering-101#s-a-proof-harness-outside-rea]
practice: []
cheatsheet: [reverse-engineering]
related: [evidence-reverse-engineering/byte-match-is-not-source, evidence-reverse-engineering/listing-before-pseudocode]
updated: 2026-11-03
---

Design the input grid that runs an original and a rebuild of `percent_change(int before, int after)` and `grade(int score)` side by side, so that every hazard the listing shows has at least one cell. Estimate how many cells you need and in which classes, and how many cells a rebuild that kept the decompiler's `long` will fail.

## Short answer

Read the hazards off the listing: a zero guard from `TEST EDI, EDI`, truncation toward zero for negative operands, multiply-before-divide order for rounding, a 32-bit wrap from `IMUL EAX`, a divide trap when the wrapped product is `INT_MIN` and the divisor is -1, and for `grade` both sides of every band edge plus scores beyond the switch. Ten `before` values crossed with seven `after` values give 70 cells, 22 scores add the rest, 92 in all: 32 overflow, 17 negative, 14 boundary, 12 plain, 7 zero guard, 5 negative truncation, 2 beyond the switch, 2 rounding, 1 trap. The `long` rebuild fails the overflow cells with `|before| > 1`, 26 of them, and a threshold rebuild of `grade` fails the two cells beyond the switch, so the plausible pair fails 28 of 92 while all ten naive cases pass.

## Full answer

### One class per hazard

Differential testing needs two comparable systems fed mechanically generated cases, and the hard part is evaluating the result. Here the original is the oracle, so the only question is where the two can disagree, and each class answers one such question. The zero guard cells take the early return. Negative cells check that `-9 / 10` is 0 and `-10 / 10` is -1. Rounding cells check that `(105 - 100) * 100 / 100` is 5 and not 0. Overflow cells make `(after - before) * 100` exceed 32 bits. The one trap cell makes the wrapped product equal `INT_MIN` with `before` equal to -1: the difference is 536870912, which wraps to -2147483648, and the divisor is -1.

### Why overflow is in scope

Signed overflow is undefined in C, and a program generator that avoids undefined behaviour does so because an oracle disagreement there is noise. This oracle is a compiled object with one fixed behaviour, so the overflow cells are in scope; the lesson is to know which cells rest on the standard and which on the compiled bytes. The listing settles it: the multiply keeps the low 32 bits, and the rebuild must too.

### The host is part of the result

On x86-64 the trap cell raises the divide error exception, because the quotient does not fit in 32 bits, and the driver turns `SIGFPE` into the value `trap`. On AArch64 `sdiv` has no trap and returns -2147483648. The recorded run on an arm64 host shows that value with `match: true`, and a run of the same grid on x86-64 records the string `trap`. The report names the architecture beside every row, and a proof without the host name is incomplete.

### Model and run stay apart

A Python model of the listing, with a 32-bit wrap and a C-style division, predicts each cell; the run observes it. Zero disagreements means the model and the binary agree on every cell. The model is derived evidence and the run is observed evidence, and the report keeps them in separate fields rather than rounding one into the other.

## Follow-ups

- **Level 3:** Why include cells whose behaviour is undefined in C? Expected: the oracle is a compiled object with one behaviour, and the listing shows the width, so the rebuild is held to the bytes and not to the standard.
- **Level 3:** Of the 32 overflow cells, how many does the `long` rebuild pass, and why? Expected: six, those with `before` of 1 or -1, because the 64-bit quotient truncates back to the wrapped value by accident.
- **Level 4:** The grid passes on an arm64 host. What stays unproven for x86-64? Expected: the trap cell, whose original result differs by architecture; rerun on x86-64 or mark it with the host.
- **Level 4:** Extend the grid to `total(const int *values, int count)`. Which classes appear? Expected: count 0, a negative count, one element, and sums that wrap at 32 bits, each with the listing instruction that motivates it.

## Wrong answers

- "Ten hand-written tests cover it." They passed on both wrong rebuilds; none crossed the width or the switch bound.
- "Fuzz it instead of a grid." Random inputs find divergence but do not name the hazard; a class per instruction tells you what a failure means and what a pass covers.
- "Skip the divide-by-minus-one cell; nobody does that." It is the one cell whose result depends on the architecture, and the report must name the host.

## Taught in

The [rebuild lesson](../../../phases/13-tools-and-protocols/36-rebuild-and-prove-equal/) builds the grid and the driver, and the [proof harness section](../../../manuals/reverse-engineering-101/sections/7-2-a-proof-harness-outside-rea.md) records the 92 cells, the 28 mismatches and the trap row on an arm64 host.
