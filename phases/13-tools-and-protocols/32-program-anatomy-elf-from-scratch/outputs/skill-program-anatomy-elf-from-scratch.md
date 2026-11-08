---
name: program-anatomy-elf-from-scratch
description: Read an ELF64 or Mach-O file the user built and report every structure, symbol, and relocation with its file range.
version: 1.0.0
phase: 13
lesson: 32
tags: [reverse-engineering, elf, mach-o, binary-formats, relocations, fixtures]
---

Given a compiled object or executable that the user built from their own source, produce a layout report from the file bytes alone. Prove the report against tool output captured into fixtures. Use this skill with Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads SKILL.md.

## Required inputs

- The source file and the exact compiler command that produced the target, so the target is a program the user built.
- The target file: an ELF64 little-endian relocatable object, executable, or shared object, or a thin 64-bit Mach-O file.
- Captured text from `llvm-objdump -h -t -r` (and `-p` for an executable), or `llvm-objdump --macho --private-headers` for Mach-O, with the tool version recorded.
- The specification pages that name the fields: System V gABI chapters 4 and 5, x86-64 psABI Table 4.9, and Apple's `loader.h`, `nlist.h`, and `reloc.h`.
- The questions the report must answer, for example the file range of one named function.

## Procedure

1. Confirm authorization first. The target must be a program the user wrote and compiled, or one with written authorization the user can show. Stop when neither holds.
2. Read the first bytes. `7f 45 4c 46` is ELF, and `cf fa ed fe` in file order is a little-endian 64-bit Mach-O. `ca fe ba be` is a universal binary that needs a thinned slice. Refuse a 32-bit class, a big-endian file, or an unknown magic with the observed bytes in the message.
3. For ELF, unpack the 64-byte header with `<HHIQQQIHHHHHH` from offset 16. Check `e_shentsize` is 64 and `e_phentsize` is 56 before reading any table.
4. Read the section header table at `e_shoff` and resolve names through the section at `e_shstrndx`. Record type, flags, offset, size, address, link, info, and alignment for every section. Mark `SHT_NOBITS` sections as owning no file bytes.
5. Read `.symtab` as 24-byte `Elf64_Sym` records and split `st_info` into binding and type. Resolve names through `sh_link`. Print `*UND*`, `*ABS*`, and `*COM*` for the reserved section indexes.
6. Read every `SHT_RELA` section as 24-byte records and split `r_info` into symbol and type. Name the type from the psABI table for the file's `e_machine`. Print the symbol with its signed addend, and print an unknown type as its number.
7. Compute every function's file range as `sh_offset + st_value - sh_addr` with length `st_size`, and return the exact bytes. Report bytes between functions as padding that belongs to no symbol.
8. Build the file offset map. Sort the header, the program header table, every section with file bytes, and the section header table by offset. Name every gap as inactive space and refuse overlaps.
9. For an executable or shared object, read the program headers and map addresses through `PT_LOAD` with `p_offset + (address - p_vaddr)`. Report that a relocatable object has section-relative addresses only.
10. For Mach-O, read `mach_header_64` and walk `ncmds` load commands by `cmdsize`. Read `LC_SEGMENT_64` with its `section_64` records, `LC_SYMTAB` with `nlist_64` entries, `LC_BUILD_VERSION`, and per-section relocations. Qualify every section as `segname,sectname`. Compute a function's length as the distance to the next symbol in its section.
11. Compare every table with the captured tool text field by field. Report each disagreement with the field name, the reader's value, and the tool's value.
12. Answer the user's questions with the computed values and quote the specification field that each value came from.

## Required report

For every target, report:

- the file identity: format, class, byte order, machine, file kind, and file size
- the header fields that locate every table
- every section or Mach-O section with its index, name, type, flags, file offset, file size, address, and the tables it links to
- every symbol with binding, type, section, value, size, and name
- every relocation with its table, target section, offset, type name, symbol, and addend
- every program header or segment with type, flags, offset, address, file size, memory size, and alignment
- the file offset map with every gap named as inactive space and the total mapped bytes
- the file range and exact bytes of each function the user asked about
- the comparison with the captured tool output: fields compared, fields that agree, fields that differ

## Hard rejects

- Analyzing a program the user did not build and cannot show written authorization for.
- Treating `st_value` as a file offset, or `sh_size` of a `SHT_NOBITS` section as file bytes.
- Inventing a name for a section type, relocation type, load command, or flag that the specification does not list.
- Reading the operand bytes at a relocated field as the final value.
- Mapping a linked address through sections when `PT_LOAD` entries exist, or calling a linked address a runtime address.
- Looking up a Mach-O section by `sectname` alone.
- Expecting a size field in `nlist_64`.
- Reading a universal binary as one Mach-O.
- Running the comparison tool inside the tests instead of comparing with committed captured text.
- Reporting agreement with the tool without listing the fields compared.

## Produce

Return these sections:

1. Authorization: the source, the build command, and who owns the target.
2. Identity: format, machine, kind, size, and the header fields that locate the tables.
3. Sections: the table with offsets, sizes, flags, and links.
4. Symbols: the table with binding, type, section, value, and size.
5. Relocations: the records with type names from the specification and the addend arithmetic for each one the user asked about.
6. Segments: program headers or `LC_SEGMENT_64` records and the address-to-offset rule.
7. File offset map: every byte range and its owner, with gaps named.
8. Function bytes: the ranges and bytes requested.
9. Oracle comparison: fields compared, agreements, disagreements.

End with the first disagreement between the reader and the captured tool output. When there is none, state the tool version the capture came from.
