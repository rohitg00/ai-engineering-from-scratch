---
name: binary-diffing-and-symbolic-execution
description: Match the functions of two builds you compiled with staged signatures and stated confidence, explain every unmatched or changed function, and solve for the inputs that reach a chosen path with a bounded search and a production solver.
version: 1.0.0
phase: 13
lesson: 44
tags: [reverse-engineering, binary-diffing, function-matching, relocations, symbolic-execution, constraint-solving, angr, z3, ghidra, radare2]
---

Given two relocatable or linked x86-64 objects that you built yourself, their reference listings, and a function whose inputs you want, produce a function-level diff whose every match names the signature that produced it, and a path report whose every leaf carries a solved input. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- Two objects, the exact compiler and command for each, and the SHA-256 of each.
- A reference listing from `llvm-objdump -d` for each object, captured from the same bytes.
- The symbol tables with function sizes and the `.rela.*` sections when the objects are not linked.
- The lesson 44 differ (`code/main.py`) or an equivalent that reads bytes, relocations, mnemonics, and blocks.
- For the solving task: the IR of the function from lesson 34 or a hand lift with one instruction address per statement, the parameter widths, and the concrete tables the function reads.
- Optional: radiff2, Ghidra with Version Tracking, angr, and z3 for the cross-checks.

## Procedure

1. Verify each listing against its object byte for byte. Stop on the first mismatch. A stale listing is a changed fixture.
2. Build one record per function: bytes, bytes with relocation fields zeroed, mnemonic sequence, reachable basic blocks with typed edges, jump-table targets from `.rela.rodata`, and the table the `lea` relocation points at when a bounds check and an indexed load exist.
3. Run the stages in order and record the stage that produced each match: exact bytes, masked bytes, mnemonics, flow-graph shape, names. A signature matches only when its value is unique on both sides. Record the quality of the stage with the match.
4. Rerun the stages with names second when symbols exist. Compare the two match sets. A structural match that the name stage contradicts is a false match; report it with the shape that caused it.
5. For every match, compare the referenced tables. Same code with different constants is a modified function.
6. Repeat the diff on loaded images: lay out the allocated sections, apply `S + A - P` to every PC-relative field and `S + A` to every absolute field, and diff again. A function that matched on exact bytes in the objects and only on masked bytes in the images moved relative to its data.
7. Compute a similarity for every pair as `1 - levenshtein / max(len)` over the raw bytes and state which bytes went into it. When comparing with radiff2, state whether relocations were applied, because the fingerprint changes.
8. For the function to solve: enumerate paths over the IR, add each branch condition to the path, and drop a fork the solver cannot satisfy. Bound every symbolic loop counter or cap the blocks per path, and report the paths the cap cut.
9. Solve each leaf for the inputs you want: a return value, a reached block, or an equality between two builds. Report the bound of the search and the count, minimum, maximum, and one sample inside it.
10. When a production solver is available, run the same queries through angr or z3 and compare class bounds, satisfiability, and the models. Evaluate every model with the IR evaluator before you report it.

## Output

For the diff, report:

- object names, compiler, commands, hashes, and listing files
- per function: size, instruction count, blocks, edges, relocations, and the five signatures
- the match list with stage, quality, agreeing signatures, similarity, name agreement, and table equality
- unmatched functions on each side with the nearest candidate and its similarity
- the object-view and image-view results side by side, with the section layout and the displacement that changed
- the tool comparison table: your stage, radiff2 verdict and ratio, Ghidra correlators that matched

For the solving, report:

- the IR with one instruction address per statement and the check that it covers the listing once
- the path list with trace, condition, return expression, and status (returned or truncated)
- per leaf: solved input count, minimum, maximum, sample, and the bound used
- the production solver's answer to the same query and whether the classes agree
- the loop bound or step cap and how many paths it cut

## Failure modes

- Trusting a byte hash on a loaded image. Relocated displacements differ when sections move; mask the fields or diff the objects.
- Trusting a masked hash on a relocatable object. The fields are already zero, so masking changes nothing and the relocation records and the referenced constants carry the difference.
- Accepting a flow-graph shape match without a second signature. Small diamonds are the shape of many functions.
- Running structural stages before names on a build with symbols and then not checking the result against the names.
- Comparing a similarity ratio with a tool's ratio without the same bytes. radiff2 fingerprints the blocks its analysis found, and the count changes when relocations are applied.
- Reporting a solver model as the input. It is one model; another solver returns another.
- Running a symbolic loop without a bound or a cap and waiting.
- Reporting a bounded search result as unsatisfiable. It is unsatisfiable inside the bound only.
- Claiming agreement with a tool you did not run. Describe closed tools from their documentation and say so.
