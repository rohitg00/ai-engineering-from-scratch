---
name: the-reverse-engineering-landscape
description: Run several disassemblers and decompilers on one object you built, normalise their addresses, and report where they agree and where each one invents or misses code.
version: 1.0.0
phase: 13
lesson: 37
tags: [reverse-engineering, tool-comparison, disassembly, control-flow-graph, intermediate-representation, ghidra, radare2, rizin, angr]
---

Given a relocatable or linked object that you built yourself, the compiler command that produced it, and two or more analysis tools, produce a comparison that says, for every function, which tools agree on instruction starts, blocks, and edges, and which bytes each tool decodes that the others do not. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The object file and the exact compiler and command that produced it.
- The symbol table of the object (function names, offsets, sizes) read from the file itself.
- For each tool: the version string, the exact headless command, and the raw output captured to a file beside the object.
- The address each tool gave the `.text` section, so every address can be reduced to a section offset.
- The lesson 37 harness (`code/main.py`) or an equivalent that reads captures and never trusts one tool as the oracle.

## Procedure

1. Capture first, compare second. Run every tool once in headless mode (`llvm-objdump -d -r`, `r2 -qc`, `rizin -qc`, an angr script, `analyzeHeadless -postScript`), store the output, and record the command and version in a manifest. Never compare live output that you cannot re-read.
2. Read the function symbols from the ELF symbol table. They are the only shared ground truth. Compute the padding gaps between functions.
3. Normalise every address to a `.text` offset by subtracting the base each tool reports for the section. Check that one known function lands at the same offset in every tool before you compare anything else.
4. For each function extent, collect the set of instruction starts per tool. Take the majority set over the graph builders and report, per tool, the starts it adds and the starts it lacks.
5. Collect block starts and edges per tool as offset pairs. Report counts and whether the sets match. When counts differ, list the edges each tool lacks relative to the union, and read the tool's own notes (switch resolution, computed jump, unresolvable target) before you judge.
6. Account for bytes. For each tool, record code bytes inside symbols, padding bytes claimed, and symbol bytes left unclaimed. Name the bytes a tool claims that the majority does not as invented code, and the bytes it leaves that the majority decodes as missed code. Bytes inside a symbol that no graph builder decodes are data.
7. Compare decompiler output on one small function with a known idiom (a division by a constant, a switch). Note which tool folds the idiom and which leaves the lifted arithmetic.
8. For tools you did not run, say so in the report and describe them from their documentation only.

## Output

For the object, report:

- compiler, command, object name, and the manifest of tool versions and commands
- the base each tool used and the offset check on one function
- per function: instruction-start agreement, per-tool extra and missing starts, block counts, edge counts, edge sets missing per tool
- per tool: code bytes inside symbols, padding bytes claimed, symbol bytes unclaimed, invented ranges, missed ranges
- the data ranges inside symbols that no graph builder decodes
- the functions a tool invents with no symbol, and the functions it misses
- decompiler output for one function per tool with the idiom named
- the list of tools described from documentation only

## Failure modes

- Comparing addresses before subtracting each tool's base, which makes every tool look wrong.
- Treating one tool as the oracle. A linear sweep agrees with itself on data bytes.
- Reading a block count as a measure of code found. A label split or a padding heuristic changes the count without changing the code.
- Dropping a tool's own notes (switch resolution, unresolvable jump) from the report, which hides why edge counts differ.
- Running the tools live inside the tests. Captures with recorded commands and versions are what make a disagreement reproducible.
- Describing a tool you did not run as if you had run it.
- Comparing captures made from different objects or different compiler versions.
