---
name: disassembly-and-control-flow
description: Turn an object file and a function name into a checked listing, basic blocks, typed edges, dominators, and a record of every unresolved transfer.
version: 1.0.0
phase: 13
lesson: 33
tags: [reverse-engineering, x86-64, disassembly, control-flow-graph, dominators, jump-tables, relocations]
---

Given a relocatable or linked x86-64 object that you built yourself and one function in it, produce a disassembly whose instruction boundaries are checked, a control-flow graph whose edges carry their evidence, and a list of what stayed unknown. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The object file and the exact compiler and command that produced it.
- A reference listing from `llvm-objdump -d` captured from the same object and stored beside it.
- The function name or entry address, and the section that holds the code.
- The symbol table with function sizes, and the `.rela.*` sections when the object is not linked.
- The decoder from lesson 33 (`code/main.py`) or an equivalent that raises on an unknown opcode.

## Procedure

1. Run the decoder as a linear sweep over the whole code section and compare every instruction with the reference listing by address, bytes, and text. Stop and fix the decoder on the first mismatch. Record the instruction count that agreed.
2. Run recursive descent from the function entry with the function extent as the limit. Record the visit order, the conflicts, and every unresolved indirect jump or call with its address.
3. For each unresolved indirect jump, match the table idiom: the register the jump reads, the `add` that produced it, the indexed load, the RIP-relative `lea`, and the bounds check. Resolve the `lea` through its relocation with `S + A + (end - P)`. Read the entries through `.rela.rodata` when the object is relocatable, or from the bytes when it is linked. Record the evidence kind for each target.
4. Rerun the descent with the recovered tables and build basic blocks: leaders are the entry, every direct or table target, and every instruction after a transfer. Tag each edge `fallthrough`, `taken`, `jump`, or `table`.
5. Compute immediate dominators with the iterative algorithm in reverse postorder. List the back edges as loops.
6. Account for every byte in the function extent as claimed by the descent, claimed only by the sweep, or claimed by neither. Classify the second group as padding or data and the third as unreachable or missing.
7. Look for loads through a RIP-relative `lea` that do not feed a jump. Report each as a value table with its entries and evidence, and say that it changes a load and not the control flow.
8. Write every remaining indirect transfer, conflict, and undecodable byte as an unknown with its address and the bytes you saw.

## Required report

For the function, report:

- object name, compiler, build command, and reference listing path
- oracle agreement as agreed over compared instructions
- instruction count under the sweep, the plain descent, and the descent with tables
- block list with start, end, and instruction count
- edge list with kind and, for `table` edges, the relocation or byte offset that produced the target
- immediate dominator of every block and the back edges
- byte accounting: code claimed, padding claimed by the sweep, data bytes, bytes never reached
- every table with section, offset, entry size, count, entries, and evidence kind
- every unknown with address, bytes, and the reason the analysis stopped

## Hard rejects

- Trusting a listing because every byte decoded.
- Treating agreement with `llvm-objdump` as proof of reachability. The oracle is itself a linear sweep.
- Guessing an opcode the decoder does not know instead of raising.
- Reading more than 15 bytes for one instruction or reading past the section end.
- Resolving a RIP-relative operand without adding the distance from the relocation field to the end of the instruction.
- Reading a jump table from zero bytes in a relocatable object instead of from its relocations.
- Reporting a value table as a jump table, or a jump table as dead code.
- Dropping an unresolved indirect transfer from the report.
- Counting padding after the last return as function code.
- Computing dominators over blocks the entry cannot reach.
- Capturing the oracle from a different compiler or object than the one under analysis.

## Produce

Return these sections:

1. Oracle: instructions compared, instructions agreed, first mismatch if any.
2. Methods: instruction and byte counts for the sweep, the descent, and the descent with tables.
3. Blocks and Edges: the typed graph with the evidence for every table edge.
4. Dominators and Loops: the immediate dominator table and the back edges.
5. Tables: jump tables and value tables with entries and evidence kind.
6. Byte Accounting: claimed, padding, data, unreached, with address ranges.
7. Unknowns: every address where the analysis stopped and why.

End with the first unknown. If there is none, state the oracle agreement count and the number of table targets proven by relocation.
