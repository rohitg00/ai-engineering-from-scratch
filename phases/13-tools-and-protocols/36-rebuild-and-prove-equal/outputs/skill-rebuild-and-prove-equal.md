---
name: rebuild-and-prove-equal
description: Prove a rebuilt function equal to the original with a differential grid, a relocation-aware byte compare, and an evidence-backed proof record.
version: 1.0.0
phase: 13
lesson: 36
tags: [reverse-engineering, differential-testing, elf, relocations, mcp, evidence]
---

Given an original object file we own, function evidence from an analysis provider, and a candidate rebuild in C, produce a two-legged proof and a proof record that names every evidence id it rests on. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The original object or executable, its SHA-256, and proof that we wrote and compiled it.
- The exact compiler, version, target, and flags that built the original.
- The instruction listing and pseudocode of each target function, with their evidence ids.
- The candidate rebuild, one function per file, with the same function names as the original.
- The integer width and signedness of every operand, read from the listing.
- The architecture the proof runs on, and whether the original object can be linked on it.
- For each relocation inside a function: offset, type, width, target section, and the shape of the data it points at.

## Procedure

1. Read the listing before the pseudocode. Write the rebuild from the operations the listing shows.
2. Record the evidence id of every record the rebuild came from.
3. Build an input grid with one class per hazard: zero guard, negative, rounding, overflow, trap, and each branch boundary.
4. Add the inputs that make every intermediate wrap at the width the listing uses.
5. Compile the original, the renamed candidate, and a driver into one program. Link the original object when the host can run it.
6. Install a `SIGFPE` handler in the driver so a divide trap becomes a recorded outcome.
7. Run the grid. Record every cell with inputs, original output, candidate output, and class.
8. Check the original column against a model of the target semantics. Report every disagreement.
9. Recompile the candidate with the exact original flags.
10. Read both objects: symbol offset and size, function bytes, and the `.rela` records inside the function.
11. Mask every relocation field, then compare sizes and bytes.
12. Compare relocation records by offset, type, and target section. Treat a different addend as a different offset, not a failure.
13. Read the constants each relocation points at and compare them entry by entry.
14. Write one claim per leg per function with status `pass`, `fail`, or `unknown`.
15. Aggregate fail first, then unknown. Never report `pass` for a claim that did not run.
16. Mint the proof record with `predicate_type`, `operation`, `confidence`, `authority`, the claims, and the evidence links. Hash it for its id.

## Required matrix

For every function, report:

- function name, original offset, and size in bytes
- evidence ids of the listing and pseudocode records
- grid size and the count per class
- naive test count and result
- grid mismatches with the first three cells in full
- host architecture and whether the original was the fixture object or a native build of its source
- model disagreements with the observed original
- candidate size, masked ranges, differing offsets
- relocation records on both sides with target section and addend
- referenced constants on both sides
- claim statuses and the aggregate status
- proof record id

## Hard rejects

- Calling a rebuild equal because hand-written tests passed.
- A grid without overflow inputs for every multiply, add, or subtract in the function.
- A grid that skips the architecture-dependent trap cell without saying so.
- Comparing bytes without masking relocation fields.
- Masking relocation fields without comparing the constants they point at.
- Reporting byte equality across different compilers, versions, or flags.
- Treating size equality as acceptance.
- Reading a model's output as an observation. The model is derived evidence.
- A claim with status `pass` and no evidence id.
- An aggregate `pass` while any claim is `unknown`.
- A proof record whose id does not recompute from its content.
- Any analysis of a program we do not own or have written authorization for.

## Produce

Return these sections:

1. Evidence: the records the rebuild came from, by id, with their limitations.
2. Candidate: the C text and the listing operations it maps to.
3. Leg One: grid design, counts per class, naive result, mismatches, model check, host and original kind.
4. Leg Two: sizes, masked ranges, byte result, relocation records, referenced constants.
5. Claims: one row per claim with status and evidence ids.
6. Proof Record: the JSON record and its `ev_` id.
7. Unknowns: every input class, architecture, or compiler the proof did not cover.

End with the first failing claim. If every claim passed, state the grid, flags, and architecture the pass covers.
