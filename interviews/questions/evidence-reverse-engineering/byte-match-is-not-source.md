---
id: byte-match-is-not-source
title: Same 46 bytes, same relocation, wrong table
card: evidence-reverse-engineering
kind: design
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [system-design, design-review]
tags: [reverse-engineering, rebuild, relocation-masking, byte-comparison, proof]
minutes: 10
lessons: [phases/13-tools-and-protocols/36-rebuild-and-prove-equal]
manuals: [reverse-engineering-101#s-a-proof-harness-outside-rea, reverse-engineering-101#s-compare-and-compare-functions]
practice: []
cheatsheet: [reverse-engineering]
related: [evidence-reverse-engineering/listing-before-pseudocode, evidence-reverse-engineering/addend-0x10-table-0x14]
updated: 2026-11-03
---

Design the second leg of a rebuild proof: build every candidate under the compiler and flags that produced the original, then compare it with the original function. Eight candidates are on the table, among them a pair of `percent_change` rebuilds whose source lines are written differently, a `grade` candidate whose 46 code bytes and relocation shape match the original but whose `case 10` returns 3, and candidates whose relocation addend differs from the original. Say what the compare does at each step, which candidate each step stops, and what a pass means.

## Short answer

Three steps in order: mask every relocation field by zeroing its bytes on both sides and compare the code; compare the relocation records by offset, type and target section, not by addend, because the original says `.rodata+0x10` and every candidate says `.rodata-0x4` and that is a different table position, not a different function; then read the bytes each relocation points at, here five 4-byte words, and compare them. The wrong-constant candidate passes the first two steps and fails only the third, `1, 2, 3, 4, 4` against `1, 2, 3, 4, 3`. A pass proves that this compiler with these flags produced the same code and the same referenced data from the candidate; it does not prove that the candidate is the original source text, since the two `percent_change` rebuilds with different text compile to identical 16 bytes.

## Full answer

### Where each candidate stops

| Candidate | Size | Masked bytes | Records | Table | Status |
|---|---|---|---|---|---|
| `percent_change_mul_first` | 16 and 16 | equal | none | none | pass |
| `percent_change_split` | 16 and 16 | equal | none | none | pass |
| `percent_change_wide` | 16 and 26 | size differs | none | none | fail |
| `percent_change_div_first` | 16 and 18 | size differs | none | none | fail |
| `grade_switch` | 46 and 46 | equal | same shape | equal | pass |
| `grade_table` | 46 and 46 | equal | same shape | equal | pass |
| `grade_thresholds` | 46 and 39 | size differs | 1 against 0 | none | fail |
| `grade_case10_wrong` | 46 and 46 | equal | same shape | differ | fail |

Size is a diagnostic and never an acceptance: a recorded reconstruction project reports a candidate with the right length and hundreds of differing bytes.

### Why mask when the field is already zero

In a RELA object the addend lives in the record and the four field bytes are zero on both sides, so a plain compare would pass while the two relocations name different places. Masking anyway keeps one method for REL objects and for Mach-O, where the field carries the addend. The addends differ because the original object holds another table in `.rodata` before the switch table and the candidate object does not.

### Why read the constants

This step exists because of a documented bug in another reconstruction project: a comparison replayed the target address into the relocation field, compared instruction bytes, and never checked the data at that address, so a source literal of `0.0` appeared exact against a target literal of `128.0` until 1,548 floating-point references were audited. The wrong-constant candidate is this fixture's version of that defect, and the table read is the audit. The count of five comes from the listing: a compare against 4 with an unsigned jump admits indexes 0 to 4, and the load reads 4 bytes per index.

### What the tool's own compare can see

The comparison tool line-diffs provider text on eight dimensions, and its assembly dimension carries two fixed limitations: exact provider text is compared without address or generated-name normalization, and assembly is opaque provider text with relocation normalization unavailable. An `unchanged` assembly dimension means equal text from one engine, a `changed` one means different text, and neither is a statement about bytes. Two copies of the same code at different addresses diff as changed. The byte-level proof is the part the tool leaves to you.

## Follow-ups

- **Level 3:** Why is the addend left out when the two relocation records are matched? Expected: the addend encodes where the table sits in that object's `.rodata`, which depends on what else the object holds, not on what the function does.
- **Level 3:** What does a `changed` assembly dimension in the comparison tool tell you about the two functions' bytes? Expected: nothing; it is a text diff with addresses inside, and a relocatable object against its linked image diffs as changed.
- **Level 4:** Two candidates with different source text pass every byte check. What have you proved? Expected: that this compiler folded both to the same code and data, not that either is the original text; signed overflow being undefined lets the compiler merge the two multiplies.
- **Level 4:** A candidate passes bytes and constants. Is behaviour settled? Expected: on the same architecture yes, since code and referenced data are equal; the trap cell still depends on the host that runs the grid, so the proof names it.

## Wrong answers

- "Equal size means equal function." Size is a diagnostic; a candidate with the right length can differ in hundreds of bytes.
- "A byte match recovers the source." Different source text can compile to identical bytes; the match is a statement about one compiler and one set of flags.
- "The comparison tool said unchanged, so the bytes match." It compared decompiler text with addresses inside and says so in its own limitations.

## Taught in

The [rebuild lesson](../../../phases/13-tools-and-protocols/36-rebuild-and-prove-equal/) builds the masking, the record compare and the table read, the [proof harness section](../../../manuals/reverse-engineering-101/sections/7-2-a-proof-harness-outside-rea.md) records the eight candidates, and the [comparison section](../../../manuals/reverse-engineering-101/sections/5-5-compare-and-compare-functions.md) states the assembly limitation.
