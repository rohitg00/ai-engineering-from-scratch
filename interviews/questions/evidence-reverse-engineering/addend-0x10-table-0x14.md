---
id: addend-0x10-table-0x14
title: The table starts at 0x14 and the addend says 0x10
card: evidence-reverse-engineering
kind: code-reading
level: 2
roles: [applied-ai-engineer, agentic-ai-engineer]
rounds: [coding, screen]
tags: [reverse-engineering, elf, relocation, symbol-table, file-offset]
minutes: 8
lessons: [phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch, phases/13-tools-and-protocols/33-disassembly-and-control-flow]
manuals: []
practice: []
cheatsheet: [re-from-scratch-tools]
related: []
updated: 2026-11-03
---

From a relocatable object: the symbol `grade` has `st_value 0x10`, `st_size 46`, section `.text`; `.text` has `sh_offset 0x40` and `sh_addr 0`. The relocation table holds one record at offset `0x36`, type `R_X86_64_PC32`, symbol `.rodata`, addend `0x10`, and the instruction at `0x33` is `leaq (%rip), %rcx` whose last four bytes are zero. Answer three questions: which file bytes are `grade`, what the zero bytes become, and why the addend is `0x10` when the table of return values starts at `.rodata+0x14`.

## Short answer

The file offset of a function is `sh_offset + st_value - sh_addr`, here `0x40 + 0x10`, so `grade` is the 46 bytes at file offset `0x50`, and `st_value` alone is an offset inside the section, not a place in the file. The zero bytes are the displacement field of a RIP-relative operand; the link editor writes `S + A - P` into them, the symbol value plus the addend minus the address of the field. The processor adds that field to the address of the next instruction, `0x3a`, which is four bytes past the field, so the final target is `.rodata + 0x10 + 4 = .rodata + 0x14`; the addend carries the target offset minus the four bytes between the field and the end of the instruction.

## Full answer

### Tables that point at tables

Only the ELF header has a fixed position in the file. Every other structure is found by an offset stored in another structure: `e_shoff` names the section header table, `sh_offset` names a section's bytes, `st_value` is an offset inside the section named by `st_shndx` while `sh_addr` is zero in an object. Sizes matter as much as starts: `grade` ends at `.text` offset `0x3e`, and the two bytes `66 90` after it are a `nop` the compiler added so the next function starts on a 16-byte boundary. They belong to no symbol, a disassembler stops at `st_size`, and a byte comparison masks them.

### Three relocation outcomes

| Type | Formula | What the link editor does |
|---|---|---|
| `R_X86_64_PC32` to a defined symbol | `S + A - P` | writes the distance and the record is gone |
| `R_X86_64_PLT32` to an undefined function | `L + A - P` | makes a PLT entry and a GOT slot when the symbol stays preemptible; when the link binds the symbol, writes the direct distance |
| `R_X86_64_64` in a position-independent image | `S + A` | keeps a relative record for the loader |

The same compensation appears on every RIP-relative operand in the fixtures: a call to `grade` carries `grade-0x4` for the same reason. The five words at `.rodata+0x14` read `1, 2, 3, 4, 4`, which is how the compiler turned the `switch` into a table of return values at `-O1`.

### The jump table at -O0 uses the same arithmetic

In the unoptimized object every table byte is zero and the targets exist only as five records in `.rela.rodata`. Apply `S + A - P` to entry `k` at offset `4k`: the stored value is `.text + A - (.rodata + 4k)`, the code adds `.rodata` back, so the target is `.text + A - 4k`. Entry 0 is `0x91`, entry 1 is `0x8c - 4 = 0x88`, entry 2 is `0x7f`, entries 3 and 4 are both `0x76`, the shared case.

### When the section headers are gone

A linker can remove the section header table and `e_shoff` becomes zero; a tool that walks sections sees nothing. The loader never looked at them: `PT_LOAD` maps an address to a file offset with `p_offset + (address - p_vaddr)`. A linked address is not a runtime address either, since a position-independent executable loads at a base the kernel chooses, and the file offset is the stable coordinate.

## Follow-ups

- **Level 2:** What are the two bytes right after `grade`, and whose are they? Expected: alignment padding, a `nop`, owned by no symbol; `st_size` is the stop condition.
- **Level 3:** In the `-O0` object the jump table bytes are all zero. Where are the targets? Expected: in the five relocation records; target equals the addend minus `4k`, and the code adds the table base back.
- **Level 3:** The executable is stripped of section headers. How do you find the bytes behind an address? Expected: through the `PT_LOAD` program header, `p_offset + (address - p_vaddr)`.
- **Level 4:** A decompiler shows the table under a `DAT_` name at an absolute address. Reconcile it with `.rodata+0x14`. Expected: it placed the object at its own base and applied the relocation; subtract the base it gave `.rodata` and the offset is `0x14`.

## Wrong answers

- "`grade` is at file offset `0x10`." That is `st_value`, an offset inside `.text`; the file offset adds `sh_offset`.
- "The table starts at `0x10` because the addend says so." The addend compensates for the four bytes to the end of the instruction; the target is `0x14`.
- "The instruction is `lea 0(%rip)`." The zeros are a placeholder the link editor fills; the relocation record names the operand.

## Taught in

The [ELF reader lesson](../../../phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/) derives the file offset and the addend by hand, and the [disassembly lesson](../../../phases/13-tools-and-protocols/33-disassembly-and-control-flow/) applies the same formula to the jump table.
