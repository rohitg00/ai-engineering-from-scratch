# Read an ELF relocatable object

Stage 1 of 8. Read the [project prerequisites](../../../README.md) first. This stage applies [Program Anatomy: An ELF Reader From Scratch](../../../../../phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md) and the relocation part of [Disassembly and Control Flow](../../../../../phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md).

## What you build

You build the loader that every later stage reads from. It accepts the bytes of one ELF64 little-endian x86-64 relocatable object (`ET_REL`), and it gives back:

- the section headers, each with its name and its bytes,
- the symbol table, with name, value, size, type, binding and section name,
- every RELA record, grouped by the section it patches and sorted by offset,
- one function at a time: its bytes, the relocations inside it, and the alignment padding after it.

It also resolves a relocation to the place it points at after linking.

## Why it matters

A relocatable object is the output of `clang -c`. The link editor has not run yet, so every address that refers to another section is a field of zero bytes plus a RELA record. The jump table of `band`, the lookup table at `-O1`, and every call to another function are visible only through those records. If the loader drops them, stage 3 cannot find the jump table, stage 7 cannot name the lookup table, and stage 8 compares bytes that the link editor will overwrite.

A function symbol gives the start and the size. The bytes between the end of one function and the start of the next are alignment padding. Stage 3 decodes the padding with a linear sweep to show where the sweep and the recursive descent disagree, so the loader reports it separately.

## Work through one concrete case

Build the fixture yourself, or use the committed objects. The objects were built with:

```bash
clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c samples.c -o samples-x86_64-O1.o
```

The header of `samples-x86_64-O1.o` starts with `7f 45 4c 46 02 01`: the magic, `ELFCLASS64` (2) and little-endian (1). At offset 16, `e_type` is 1 (`ET_REL`) and `e_machine` is 62 (`EM_X86_64`). The section header table is at `e_shoff`, each entry is 64 bytes, and the first five section names are the empty null section, `.strtab`, `.text`, `.rela.text` and `.rodata`. `.text` is 0xb2 bytes long.

The five function symbols, in address order, with their sizes:

| name | value | size | next start | padding |
|---|---|---|---|---|
| `tenths_and_fifths` | 0x0 | 0x23 | 0x30 | 13 |
| `thirds` | 0x30 | 0x1a | 0x50 | 6 |
| `band` | 0x50 | 0x17 | 0x70 | 9 |
| `fold` | 0x70 | 0x26 | 0xa0 | 10 |
| `record` | 0xa0 | 0x12 | 0xb2 | 0 |

`band` holds one relocation. The record in `.rela.text` has `r_offset` 0x5f, type 2 (`R_X86_64_PC32`), the `.rodata` section symbol, and addend -4. Inside the function the offset is 0x5f - 0x50 = 0xf.

The field belongs to `leaq (%rip), %rcx`, which starts at 0x5c and ends at 0x63. The psABI says the link editor stores S + A - P in a PC-relative field, where S is the symbol value, A is the addend and P is the field address. The processor adds the field to the address of the next instruction. So the operand reaches:

```text
S + A - P + end = 0 + (-4) - 0x5f + 0x63 = 0
```

The table starts at `.rodata+0x0`. Its first eight bytes are `05 00 00 00 08 00 00 00`: the values 5 and 8 of the `switch` in `band`.

At `-O0`, `.rodata` itself has six relocations, one per jump table entry. Each is a PC-relative record against `.text` whose target, resolved with the table base as the end, is 0x78, 0x81, 0x8a, 0x93, 0x9c and 0xa5. These are the six case blocks of `band`.

```figure
pj-mini-decompiler-1
```

Change the addend, the field offset and the instruction length in the lab. The target moves by the same amount as the distance from the field to the end of the instruction, which is why `relocation_target` refuses a PC-relative record without that end.

## Implement the contract

Implement these in the `elf` module. The starter keeps the dataclasses, the constants, `_cstring`, `_slice`, `section`, `has_section`, `functions`, `relocation_at` and `symbolize`.

| function | contract |
|---|---|
| `ElfObject(data: bytes)` | Raise `ElfError` unless the data has the ELF magic, `ELFCLASS64`, little-endian encoding, `EM_X86_64`, `ET_REL` and `e_shentsize` 64. Read every section header; `SHT_NOBITS` has no bytes. Name sections from `e_shstrndx`. Then set `self.symbols` and `self.relocations`. Any table outside the file raises `ElfError`. |
| `ElfObject._read_symbols() -> list[Symbol]` | Every 24-byte `Elf64_Sym` of every `SHT_SYMTAB`, named through the string table at `sh_link`. Type is `st_info & 0xf`, binding is `st_info >> 4`. |
| `ElfObject._read_relocations() -> dict[str, list[Relocation]]` | Every 24-byte `Elf64_Rela` of every `SHT_RELA`, keyed by the name of section `sh_info`, sorted by offset. A symbol index past the table raises `ElfError`. |
| `ElfObject.function_extent(name, section=".text") -> (start, end, padding_end)` | From the function symbol: `start` is the value, `end` is `start + size`, `padding_end` is the next function start or the section size. Unknown names raise `ElfError`. |
| `ElfObject.function(name, section=".text") -> FunctionBytes` | The bytes in `[start, end)` and the relocations inside that range, with offsets relative to `start`. |
| `relocation_target(relocation, field_end=None) -> Target` | Absolute: `S + A`. PC-relative (`R_X86_64_PC32`, `R_X86_64_PLT32`): `S + A + (field_end - P)`. A PC-relative record with no `field_end` raises `ValueError`. A section symbol has S = 0. |

The CLI is supplied. After this stage the loader runs, and the `disasm` command starts to work after stage 2.

## Verify and inspect

From the repository root, initialize a workspace once:

```bash
python3 scripts/project_test.py mini-decompiler --init learning-artifacts/mini-decompiler
python3 scripts/project_test.py mini-decompiler --stage 1 --path learning-artifacts/mini-decompiler --strict
```

A fresh workspace fails with `not implemented yet: Stage 1: implement ElfObject.__init__`. The tests check the section order, the symbol table above, the `band` relocation, the jump table targets at `-O0`, the held-out object, and these failure cases.

## Failure cases

- Bytes that start with `MZ`, or only the four magic bytes, raise `ElfError`.
- A 32-bit class, big-endian data, another machine or an executable (`ET_EXEC`) raises `ElfError` with the field that failed.
- A file cut at 200 bytes, or an `e_shoff` past the end, raises `ElfError` instead of reading garbage.
- A RELA record that names symbol 0xffff, past the end of the symbol table, raises `ElfError`.
- `relocation_at(".text", 0x60)` returns `None`, because 0x60 is inside the field but is not its start.

## Extensions

- Read `.symtab` entries with `SHN_COMMON` and `SHN_ABS` and report them as unknown sections.
- Accept `R_X86_64_GOTPCREL` and record that the target is a GOT slot, which only exists after linking.
- Read an `ET_DYN` shared object through its program headers and its dynamic symbol table.
