---
name: linking-loading-and-stripped-binaries
description: Turn a program you built into its import list with providers, one call traced to the slot the loader fills, a record of what strip removed and what survived, and a scored recovery of function starts and names in a stripped build.
version: 1.0.0
phase: 13
lesson: 40
tags: [reverse-engineering, linking, elf, pe, coff, mach-o, plt, got, iat, chained-fixups, strip, function-identification, flirt]
---

Given a linked executable or shared library that you built yourself, its unstripped twin, and the objects it was linked from, produce a report that names every external call's provider, shows one call followed from the call site to the loader-written slot with the arithmetic, states what `strip` removed and what the loader still needs, and scores every function finder and signature against the symbol table of the twin. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The linked file, the exact link command, and the toolchain versions.
- The unstripped twin, or the file before `strip`, as ground truth for function starts and names.
- The relocatable objects the file was linked from, with their relocation records, for the signatures and the link plan.
- Captured tool text from the same files: `llvm-objdump -h -p -T -R -d` or `-h -t -r` for ELF and COFF, `llvm-objdump -p` for PE, and `otool -h -l -Iv`, `dyld_info -fixups -fixup_chain_details -imports -exports -function_starts`, and `nm -m` for Mach-O.
- The readers from lesson 40 (`code/main.py`) or equivalents that refuse unknown formats instead of guessing.

## Procedure

1. Read the headers and name the format and the kind. Record magic, type or filetype, machine, and the flags with their names. Stop on anything the reader does not know.
2. List the imports with their providers. ELF: `DT_NEEDED` and the undefined `.dynsym` entries, with version names when `.gnu.version_r` exists. PE: every import descriptor with its DLL, lookup table, IAT, and hint/name entries. Mach-O: the chained imports table with library ordinals mapped to `LC_LOAD_DYLIB` order, or the `nlist` library ordinals.
3. Follow one call to its slot. Record the call bytes and address, the stub or PLT entry bytes with the displacement arithmetic, the slot address, the word in the file, and what the loader writes. For a PLT entry, record the `pushq` index and the `DT_JMPREL` record. For a chained fixup, decode bind or rebase, `next`, ordinal or target. For an IAT slot, show that the lookup table and the IAT are equal before binding.
4. From the objects, plan the link: for each relocation decide in place, direct, PLT and GOT slot, GOT slot only, or a dynamic relocation, with the Table 4.9 formula. Compare the planned PLT, GOT, and `.rela.plt` sizes with the linked file where one exists.
5. Compare the symbol table before and after `strip`. List the removed names, the kept names with the reason the loader needs each one, and the tables that survived: exports, function starts, unwind tables, section or load command headers. Run the stripped program and record its output next to the original.
6. In the stripped file, run every finder you can: the link editor's starts table (`LC_FUNCTION_STARTS`, `.pdata`, `.eh_frame`), prologue scans with the exact byte pattern or mask, and call targets plus the entry point. Score each against the twin: hits, true positives, false positives, missed.
7. Build signatures from the objects: the first 32 bytes with relocated bytes marked variant, the CRC16 of the bytes after 32 up to the first variant byte, the function length, and the referenced names. Match them at the recovered starts. Record every collision and the tail byte or referenced name that split it, or that nothing did.
8. Write every claim with the captured tool line that supports it, and every mismatch between the reader and the tool as an unknown with the address.

## Required report

- file, format, kind, flags, link command, toolchain versions, and the capture commands
- imports with provider, ordinal or version, and the slot each one binds
- the traced call: call site, stub or entry, slot, word in the file, loader action, with the arithmetic shown
- the link plan with counts per decision and the planned sizes, and the measured sizes when a linked file exists
- strip comparison: records before and after, removed names, kept names with reasons, surviving tables, program output before and after
- finder scores: for each method, found, true positives, false positives, missed, recall
- signatures: every `.pat` line, every name assigned, every collision with its resolution
- unknowns: every address where the reader and the tool disagree or where no method named a function

## Hard rejects

- Reading a GOT, IAT, or `__got` word from the file and calling it an address without decoding it as the format defines it.
- Reporting a PLT entry for a call whose symbol is defined in the inputs.
- Treating `nm` output on a stripped file as the function count when a starts table exists.
- Scoring a finder without the unstripped twin.
- Claiming partial or full RELRO without reading `PT_GNU_RELRO` and `DF_BIND_NOW`.
- Comparing COFF `REL32` with ELF `PC32` without accounting for the addend in the ELF record.
- Naming a function from a signature that collided with another signature and was not split by a tail byte or a referenced name.
- Building a signature from bytes under a relocation without marking them variant.
- Quoting a number from a tool run on another build or another machine.
- Stripping a shared library below the level the loader needs without recording what the exports table still carries.

## Produce

Return these sections:

1. Identity: format, kind, flags, machine, toolchain, commands.
2. Imports: provider per name, the slot each binds, and the binding time (lazy, at load, or none).
3. One Call: the traced path with bytes and arithmetic.
4. Link Plan: decisions, counts, planned and measured sizes.
5. Strip: before and after, removed, kept with reasons, surviving tables, program output.
6. Finders: scores per method with the misses named.
7. Signatures: `.pat` lines, assignments, collisions and their resolution.
8. Unknowns: every disagreement and every unnamed start.

End with the first unknown. If there is none, state the number of fixups or relocations that matched the tool text and the number of functions named.
