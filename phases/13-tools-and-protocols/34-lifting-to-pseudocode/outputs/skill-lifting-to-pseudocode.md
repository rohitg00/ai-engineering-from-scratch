---
name: lifting-to-pseudocode
description: Lift one compiled function to pseudocode with a derivation for every line, then reconcile it with the decompiler's text.
version: 1.0.0
phase: 13
lesson: 34
tags: [reverse-engineering, decompilation, ir, ssa, structuring, ghidra, rea]
---

Given a function in an object file or executable that you built or are authorized to analyze, produce two things. First, pseudocode where every line traces back to instructions. Second, a difference table against the decompiler's output. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The target file, its SHA-256, the compiler and flags that produced it, and the written authorization to analyze it.
- The function name or entry address and the section that holds it.
- A reference disassembly from `llvm-objdump -d -r` or the decompiler's instruction view.
- The relocation records that apply to the function body.
- The calling convention of the target (System V AMD64 psABI section 3.2.3 for x86-64 Linux objects).
- The decompiler text for the same function, with the provider name and version, for example Ghidra 12.1.4 through rea 6.5.0.
- The source of the function when the target is your own fixture, for the behaviour comparison.

## Procedure

1. Decode the function from its first byte to the next function start. Compare every instruction with the reference disassembly by address, bytes, and text. Stop on the first disagreement.
2. Split the instructions into basic blocks at jump targets and after every jump or return. Record successors and predecessors. Compute immediate dominators in reverse postorder.
3. Lift every instruction to IR statements. Model flag-setting instructions as writes to one `flags` variable and every conditional jump as a read of it. Keep the stack pointer and frame pointer out of the IR and turn frame slots into named locals.
4. Resolve every RIP-relative operand through its relocation: target = symbol + addend + the distance from the displacement field to the end of the instruction. Name the target by section and offset.
5. Take parameters from the calling convention. A register in the argument sequence that is read before any write is a parameter. The highest such register fixes the count. Never take a callee-saved register as a parameter.
6. Build SSA: place phi functions on the iterated dominance frontier of each variable's definitions, then rename with a dominator tree walk. Record the width of every definition.
7. Simplify: fold condition codes against `cmp` and `test`, fold casts, turn scaled loads into element accesses, and recognize the multiply-and-shift division idiom only when the multiplier equals the ceiling of a power of two over the divisor and the error bound holds.
8. Substitute a value into its only use when the use is in the same block and no store or call sits between them. Substitute constants anywhere except into a phi. Remove definitions with no uses and no side effect. Repeat until nothing changes.
9. Coalesce each phi with its arguments into one variable. Give variables names that show the register or slot they came from. Infer `int` or `long` from width and a pointer type from use as a scaled load base, and share the type along copies.
10. Structure: use the immediate post-dominator as the join of a conditional. Emit `if`, `if` with `else`, or an early return. Detect loops from back edges. Emit `while` when the header exits and `do while` when the latch exits. Report an indirect jump as unresolved instead of guessing targets.
11. Compile the pseudocode with the target triple and `-Wall -Werror`. When the source is available, compile the source and the pseudocode into separate programs with one driver and compare their outputs over an input grid.
12. Place the decompiler text next to the pseudocode. For every line that differs, write the instruction that explains the difference, or write that the difference is a decompiler guess with no instruction behind it.

## Required matrix

For every function, report:

- function name, address range, instruction count, block count, and phi count
- decoder agreement with the reference disassembly: every instruction or the first address that differs
- each parameter with its register, width, and inferred type
- each table read with its relocation, section offset, element width, and the bound that fixed its length
- each idiom recognized, with the arithmetic that justifies it
- each structure emitted (if, if-else, early return, while, do while, unresolved indirect jump)
- compile result and behaviour comparison result with the input grid used
- the difference table against the decompiler: line, our text, their text, instruction or guess

## Hard rejects

- Trusting a decompiler signature, return type, or parameter count without checking the register reads and writes behind it.
- Taking a callee-saved register or a register first written inside the function as a parameter.
- Folding a multiply-and-shift into a division without checking the multiplier and the error bound.
- Guessing the targets of an indirect jump from nearby code.
- Reading a table past the next referenced address or the section end.
- Substituting a loaded value across a store or a call.
- Emitting `goto` for a shape that an `if`, `while`, or `do while` covers.
- Declaring the pseudocode correct because it compiles. Compiling proves syntax, the behaviour comparison proves semantics.
- Accepting a refinement model's edit that replaces a visible unknown with an invented field, type, callee, or guard.
- Analyzing software you do not own or are not authorized to analyze.

## Produce

Return these sections:

1. Target: file, SHA-256, compiler, flags, authorization.
2. Decoder Agreement: instruction count and the reference comparison result.
3. Graph: blocks, successors, immediate dominators, loops.
4. IR and SSA: the statement listings with versions and phi functions.
5. Pseudocode: the structured text with its data definitions.
6. Types: every parameter, local, and return type with the evidence for each.
7. Decompiler Comparison: the difference table with the instruction or guess for each line.
8. Proof: compile result and the behaviour comparison over the input grid.
9. Unknowns: unresolved jumps, unapplied relocations, types that the machine code cannot fix.

End with the first line of the decompiler text that no instruction supports. If every line is supported, state the input grid that proved the behaviour equal.
