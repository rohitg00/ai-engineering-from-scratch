---
name: compiler-idioms-and-optimization
description: Recognize compiler idioms in a disassembly listing of a program you built, decode each one back to its source construct with a derivation, and verify the result against the source.
version: 1.0.0
phase: 13
lesson: 39
tags: [reverse-engineering, x86-64, arm64, compiler-idioms, division-by-constant, switch-lowering, vectorization, inlining, tail-calls]
---

Given an `llvm-objdump -d -r` listing of an object you compiled yourself, the object file, and the C source, produce a list of recognized compiler idioms. Each entry names the kind, the evidence instructions, the decoded source form, and whether the source confirms it. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The C source and the exact compiler, target, optimization level, and flags that produced the object.
- The object file and its `llvm-objdump -d -r` listing captured from that object.
- The recognizer from lesson 39 (`code/main.py`) or an equivalent that reports evidence addresses for every claim.
- For comparison, the output of at least one decompiler on the same object, captured with its version.

## Procedure

1. Parse the listing into functions and instructions. Attach each relocation line to the instruction before it. Record the architecture from the file format line.
2. Find divisions by a constant. On x86-64 look for `imul` with a 32-bit immediate or a `mov $imm` feeding `imul`, then the shifts and the sign fix-up or the add fix-up. On AArch64 look for `mov` and `movk` building the constant, then `smull` or `umull` and the shifts. Recover the divisor from the multiplier and the total shift with the Granlund-Montgomery bound, and accept it only when the algorithm gives the same constants back.
3. Find modulos as a recognized quotient multiplied back by the divisor and subtracted, as `msub`, or as the power-of-two bias and mask form. When a quotient also feeds another use, keep both the division and the modulo.
4. Classify every switch by its lowering: jump table (indirect jump through a table of addresses, entries from relocations or bytes), lookup table (indexed load of values, entries from the bytes at the relocated address plus 4 for a RIP-relative field), linear map (affine arithmetic selected by a bounds compare), comparison tree (equality tests split by ordered compares), compare chain (equality tests only), or select chain. Read the bounds check for the entry count and compare entries with the source cases, allowing a constant factor the compiler folded in.
5. Find loops from backward branches whose target can reach them again. A loop body that uses SIMD registers is vectorized: report lanes, accumulators, elements per iteration, the trip-count mask, the minimum-trip guard, the reduction, and the scalar remainder loop. A body with N loads at consecutive offsets from one base is unrolled by N.
6. Find tail calls (a `jmp` or `b` carrying a call relocation), inlined callees (a source call with no call instruction and the callee's body shape present in the caller), library replacements (`memset` and `memcpy` reached from a loop or a fixed copy), and inline expansions (a 16-byte load and store pair).
7. Decode branchless selects by evaluating the straight-line code before the `cmov`, `setcc`, `csel`, `cneg`, or `cset` with the parameter names from the source.
8. Report hardening shapes separately: the stack protector (guard load, slot, compare, `__stack_chk_fail`) and `endbr64`.
9. Verify every idiom against the source: the divisor appears after `/` or `%`, the switch exists and its cases match, the loop exists, the callee is called, the select exists. Mark each idiom verified or not and list the unverified ones first.
10. Compare with the decompiler output: for each idiom state whether the tool folded it, left it as arithmetic, or printed something else, and quote the tool's text.

## Required report

For the object, report:

- compiler, target, level, flags, and the listing tool version
- per function, every idiom with kind, decoded source form, evidence addresses, and verification status
- for divisions, the multiplier, the total shift, the divisor, the error, and whether the compiler's constants match the algorithm
- for switches, the lowering kind, the entry count, the table location, the entries or targets, and the evidence kind (relocation or bytes)
- for loops, lanes, accumulators, elements per iteration, remainder loop, or the unroll factor
- the kind matrix per optimization level and whether two levels produced the same code
- the decompiler comparison with quoted output and the tool version
- every idiom the source did not confirm, with the reason

## Hard rejects

- Naming a divisor from the multiplier alone without the shift. The same multiplier means different divisors at different shifts.
- Reporting a lookup table as a jump table or a jump table as dead code.
- Reading table entries from zero bytes in a relocatable object when the entries are relocations.
- Counting a backward branch to a shared default block as a loop.
- Calling a library tail call a return from the function.
- Treating `-O0` hardware division as proof that no magic multiply exists for that compiler.
- Claiming a decompiler folds an idiom without quoting its output on this object.
- Reporting an idiom that the source does not contain without marking it unverified.

## Produce

Return these sections:

1. Build: compiler, target, level, flags, listing tool.
2. Idioms: per function, kind, source form, evidence, verified.
3. Divisions: the magic table with divisor, multiplier, shift, error, add form, and algorithm match.
4. Switches: lowering per function per level with entries and evidence kind.
5. Loops: vector and unroll facts per loop.
6. Decompilers: per idiom, folded or not, with the quoted text and version.
7. Unverified: every idiom the source did not confirm.

End with the unverified list. If it is empty, state the number of idioms recognized and the number of divisions whose constants matched the algorithm.
