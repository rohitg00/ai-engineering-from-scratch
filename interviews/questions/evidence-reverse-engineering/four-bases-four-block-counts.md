---
id: four-bases-four-block-counts
title: Three addresses for grade and four block counts
card: evidence-reverse-engineering
kind: debug
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, applied-ai-engineer]
rounds: [debugging, design-review]
tags: [reverse-engineering, tool-comparison, load-address, basic-blocks, jump-table]
minutes: 10
lessons: [phases/13-tools-and-protocols/37-the-reverse-engineering-landscape, phases/13-tools-and-protocols/33-disassembly-and-control-flow]
manuals: []
practice: []
cheatsheet: [re-from-scratch-tools, reverse-engineering]
related: [evidence-reverse-engineering/sweep-trap-addq-at-0x13]
updated: 2026-11-03
---

An agent runs four tools on one relocatable object and reports that `grade` sits at `0x08000050` in one, `0x400010` in another and `0x100010` in a third, so the tools disagree about where the function is. On the `-O0` object it then reports 3, 8, 8 and 9 basic blocks for the same function. Explain both reports, and say what a block count measures.

## Short answer

The object has no load address, so each tool picks one: `0x08000000` for the file in two tools, which puts `.text` at `0x08000040`, `0x400000` in a third, `0x100000` in a fourth, and the sweep prints offsets with no base at all. Subtract each tool's `.text` address and every answer is `0x10`, which is what the symbol table says. The block counts are four answers to how far each tool followed one indirect jump and where it cut: 3 blocks is a tool that stopped at `jmp rax` and left 36 bytes unreached, 8 with 11 edges is a tool that read the five relocations behind the table and found four distinct targets, 8 with 7 edges is a tool whose case blocks exist but whose transfer at `0x62` goes to an unresolvable node, and 9 with 12 edges is a tool whose switch analysis placed a label on the jump at `0x74` and whose block model starts a new block at a label.

## Full answer

### Reduce before you compare

The harness reads the base from each capture and compares after reduction. A disagreement on raw addresses is a disagreement about loaders, and the test that every tool places `grade` at offset `0x10` from its own base is the first thing to fix in place. Loaders also differ on relocations: one processes them on import, one applies them, and one prints a hint that relocations were not applied unless a setting says so. What a loader does with relocations decides what every later stage can see.

### Compare in order, read the notes

Instruction starts first: in the agreement case all four tools report the same starts in every function, and the four graph builders report 3, 3, 5 and 4 blocks with identical edge sets. Then blocks, then edges, and each tool's own note before judging a count: a `switch_op` with five cases and four distinct targets, a `COMPUTED_JUMP` flow with four targets, or an unresolvable target node explains most differences. All four tools decoded the same 33 instructions once they reached them. The lesson-33 graph had 8 blocks and 11 edges, and one tool matches it exactly; the tool with 9 and 12 found the same four targets and split one block at a label.

### Where tools invent and miss

One framework ends a block at a `call`, because its IR block is single-entry multiple-exit, so a function that calls another reports 2 blocks where the other three report 1 for the same instructions. The same framework invents functions at padding gaps with no symbol, 9 across the four objects, and one more on the trap table. The sweep decodes padding bytes that no graph builder treats as code. The harness names one missed range in one tool, the 36 case bytes of `grade`, and no missed function in any tool.

### What was run and what was read

Two commercial tools were described from documentation only and are marked as not run in the figure and the table. A description is useful evidence of a different kind from a capture, and the report says which is which. Every capture is stored with its command, version and date; a disagreement you cannot re-read is not a finding.

## Follow-ups

- **Level 3:** One tool reports 9 blocks and 12 edges, another 8 and 11, for the same control flow. Who is wrong? Expected: neither; a label on the indirect jump started a new block, and both found the same four computed targets.
- **Level 3:** On the caller of `grade`, one tool reports two blocks and the rest one. Explain. Expected: that tool's IR block ends at a call; the instruction set is the same.
- **Level 4:** One listing shows the four case blocks as dead code. How do you classify those bytes? Expected: missed by a stopped walk, since three tools reach them through the table; the byte accounting names the range and the tool.
- **Level 4:** You could not run two commercial tools. How do they appear in the report? Expected: from their documentation, marked as not run, with no measured number attributed to them.

## Wrong answers

- "The tool with the most blocks found the most code." The extra block is a label split; all four decoded the same instructions where they reached them.
- "Compare the raw addresses; the tools disagree." The object is relocatable, and each tool chose a base; the offset agrees.
- "The sweep tool is broken because it prints `0x10`." It prints section offsets with no base, which is the correct answer with the base removed.

## Taught in

The [landscape lesson](../../../phases/13-tools-and-protocols/37-the-reverse-engineering-landscape/) reduces the four bases and explains each block count from the tool's own note, and the [disassembly lesson](../../../phases/13-tools-and-protocols/33-disassembly-and-control-flow/) builds the graph the counts are compared against.
