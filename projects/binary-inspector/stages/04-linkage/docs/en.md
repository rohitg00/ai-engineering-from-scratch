# Imports, exports, relocations, and chained fixups

Stage 4 of 6. This stage implements the linkage tables of lesson [40](../../../../../phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/docs/en.md): relocation records, PE import and export directories, Mach-O chained fixups, and the exports trie. The relocation fields come from lesson [32](../../../../../phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md).

## What you build

You write five functions in the `linkage` module:

- `uleb128(data, offset)` decodes one unsigned LEB128 value.
- `relocations(data)` lists ELF, COFF, and Mach-O relocation records and PE base relocations.
- `imports(data)` lists what the file needs from elsewhere and the slots that receive each address.
- `exports(data)` lists what the file offers to others.
- `chained_fixups(data)` decodes every fixup word of a linked Mach-O file.

## Why it matters

The bytes of a call or a pointer in an object file are often zero. The relocation record says what the link editor writes there. In a linked image, the loader fills import slots before the program runs. On current macOS, the fixup information sits inside the pointer slots themselves, as chained 64-bit words. A disassembler that reads one of those slots without decoding it reports a pointer to an address that does not exist. Lesson 40 opens with that exact mistake.

The record layouts:

| Format | Record | Fields |
|---|---|---|
| ELF `Elf64_Rela` | `<QQq`, 24 bytes | offset, `r_info` (symbol index high 32 bits, type low 32 bits), addend |
| COFF relocation | `<IIH`, 10 bytes | offset, raw symbol index, type. No addend field. |
| Mach-O `relocation_info` | `<iI`, 8 bytes | address, then symbolnum:24, pcrel:1, length:2, extern:1, type:4 |
| PE base relocation block | `<II` then `<H` entries | page RVA, block size, then type (top 4 bits) and page offset (low 12 bits) |

## Work through one concrete case

ELF. The first `.rela.text` record of the tally object has offset `0x15`, `r_info` `0x0000000a00000002` (symbol index 10, type 2), and addend -4. Type 2 is `R_X86_64_PC32`. Symbol 10 is `tally_counter`. `llvm-objdump -r` prints `0000000000000015 R_X86_64_PC32 tally_counter-0x4`.

PE imports. The import directory of the small PE image is at RVA `0x2000`, which the `.rdata` section maps to file offset `0x400`. The 20-byte descriptor reads: lookup table `0x2028`, time stamp 0, forwarder 0, name `0x2096`, address table `0x2048`. The name RVA gives `kernel32.dll`. The lookup table holds three 64-bit entries and a zero. Bit 63 is clear in each, so each is the RVA of a hint and a name: hint 0 `GetStdHandle`, hint 1 `WriteConsoleA`, hint 2 `ExitProcess`. The slot of import *i* is `ImageBase + 0x2048 + 8 * i`: `0x140002048`, `0x140002050`, `0x140002058`.

Mach-O chained fixups. `LC_DYLD_CHAINED_FIXUPS` points at 152 bytes in `__LINKEDIT`. The header is seven 32-bit fields:

```text
00 00 00 00  20 00 00 00  50 00 00 00  60 00 00 00  04 00 00 00  01 00 00 00  00 00 00 00
version 0    starts 32    imports 80   symbols 96   count 4      format 1     names 0
```

At offset 32, `seg_count` is 5, with one start offset per segment. Only segment 2 (`__DATA_CONST`) has one, 24. At 32 + 24, `dyld_chained_starts_in_segment` reads: size 24, page size `0x4000`, pointer format 6 (`DYLD_CHAINED_PTR_64_OFFSET`), segment offset `0x4000`, page count 1, page start 0.

The chain starts at the file offset of `__DATA_CONST` (`0x4000`) plus page 0 plus 0. Read each 64-bit word:

| Offset | Raw | Bit 63 | next (bits 51 to 62) | Decoded |
|---|---|---|---|---|
| `0x4000` | `0x8010000000000000` | 1, bind | 2 (8 bytes) | ordinal 0 |
| `0x4018` | `0x8010000000000003` | 1, bind | 2 | ordinal 3 |
| `0x4020` | `0x001000000000098d` | 0, rebase | 2 | target `0x98d` + `0x100000000` |
| `0x4038` | `0x000000000000099a` | 0, rebase | 0, end | target `0x10000099a` |

The imports table at offset 80 holds 32-bit entries: library ordinal (8 bits), weak (1 bit), name offset (23 bits). Entry 3 is `0x5c01`: ordinal 1, not weak, name offset 46, and offset 96 + 46 holds `_puts`. Library ordinal 1 is the first `LC_LOAD_DYLIB`, `/usr/lib/libSystem.B.dylib`. So the slot at `0x100004018` receives the address of `_puts`, exactly as `dyld_info -fixups` prints.

The exports trie of the dylib starts `00 01 5f 74 61 6c 6c 79 5f 00 53`: terminal size 0, one child, edge `_tally_`, child at offset `0x53`. Each terminal node holds ULEB128 flags and a ULEB128 offset from the image base. `_tally_sum` is at `0x4a8`. Strip removes `LC_SYMTAB` records from the dylib but keeps this trie, because dyld binds through it.

```figure
pj-binary-inspector-4
```

Enter a 64-bit fixup word in the lab. It splits the word into its bit fields, decides bind or rebase, and computes the next offset and the target.

## Implement the contract

`uleb128(data: bytes, offset: int) -> tuple[int, int]`: return the value and the offset after it. Raise `FormatError` when the bytes end before a byte without bit 7, or after 10 bytes.

`relocations(data: bytes) -> list[dict]`, each `{"section", "offset", "type", "symbol", "addend"}`:

- ELF: every `RELA` (24 bytes, explicit addend) and `REL` (16 bytes, addend `None`) section. `section` is the name of `sh_info`, the section being patched. Symbols come from the table in `sh_link`. Type names are `R_X86_64_` or `R_AARCH64_` plus the name in the supplied table, or the number.
- COFF: records of each section in table order, type `IMAGE_REL_AMD64_` plus the name, addend `None`. The symbol index counts auxiliary records.
- PE: base relocations from the `basereloc` directory. Skip type 0 (padding). `offset` is the RVA, `symbol` is `None`, type `IMAGE_REL_BASED_DIR64` for type 10.
- Mach-O: records of each section. An `ARM64_RELOC_ADDEND` record (type 10) carries a signed 24-bit addend for the next record and is not listed. When `extern` is 0, `symbolnum` is a 1-based section number.
- Raise `FormatError` when a record names a symbol or a section that does not exist.

`imports(data: bytes) -> list[dict]`, each `{"name", "library", "slots", "hint", "ordinal"}`:

- PE: one row per lookup table entry. Bit 63 set means import by ordinal (`name` is `"#n"`). `slots` holds the absolute address of the IAT slot.
- Mach-O with chained fixups: one row per chained import, `ordinal` is its index, `slots` lists the addresses of the binds that use it.
- Everything else: undefined global symbols from stage 3, once per name, `slots` empty. Mach-O rows take `library` from `library_ordinal`.

`exports(data: bytes) -> list[dict]`, each `{"name", "address", "ordinal", "forwarder"}`:

- PE: the export directory. Name *k* maps to address entry `ordinals[k]`, and the exported ordinal is that index plus the ordinal base. An address inside the export directory is a forwarder string.
- Mach-O with a nonempty `LC_DYLD_EXPORTS_TRIE`: the trie, sorted by name, address = `__TEXT` base + offset.
- Everything else: defined global and weak symbols, excluding section, file, `*ABS*`, and `*DEBUG*` entries. Use `.dynsym` alone when the file has one.

`chained_fixups(data: bytes) -> dict` returns `{"header", "imports", "fixups"}`. For a file without `LC_DYLD_CHAINED_FIXUPS`, return `{"header": None, "imports": [], "fixups": []}`.

- `header`: `{"version", "imports_count", "imports_format", "pointer_formats"}`.
- `imports`: `{"index", "name", "library", "weak", "addend"}`. Support import formats 1, 2, and 3. Library ordinals `0`, `-1`, and `-2` are `"self"`, `"main-executable"`, and `"flat-lookup"`.
- `fixups`: `{"offset", "address", "section", "raw", "next", "kind"}` plus `ordinal`, `name`, `library`, `addend` for a bind, or `target` for a rebase. Support pointer formats 2 and 6. Format 6 adds the `__TEXT` base to the target.
- Raise `FormatError` for a nonzero version, compressed names, an unsupported format, and a multi-start page. Also raise for a bind ordinal outside the imports table and for a chain that leaves its page.

## Verify and inspect

```bash
python3 scripts/project_test.py binary-inspector --stage 4 --path learning-artifacts/binary-inspector --strict
```

The tests compare with `llvm-objdump -r`, `llvm-objdump -p`, and `dyld_info -fixups -exports`, and feed corrupted chains, tries, and relocation records.

## Investigate the failure boundary

- Set the `next` field of the first fixup word to `0xfff`. The next word would be `0x3ffc` bytes on, past the page. Without the page check, the reader follows pointers into unrelated data.
- Set a bind ordinal to 50 with only 4 imports. The decoder must raise. It must not print a name from past the table.
- Point a trie child back at offset 0. A reader without a visited set loops forever.
- Look at the COFF relocation for `bucket_names` at `0x102` and the ELF record at the same place. The ELF record carries addend -4. The COFF type `REL32` has the -4 built in.

## Extensions

- Decode `LC_DYLD_INFO_ONLY` bind opcodes for files linked with `-no_fixup_chains`.
- Read the ELF `.dynamic` section and list `DT_NEEDED` libraries for a shared object.
- Read the PE delay-load import directory.

## References

- [System V gABI, relocation](https://www.sco.com/developers/gabi/latest/ch4.reloc.html) and [AMD64 psABI](https://gitlab.com/x86-psABIs/x86-64-ABI)
- [Microsoft PE Format: COFF relocations, the .idata and .edata sections, base relocations](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [Apple dyld, mach-o/fixup-chains.h](https://github.com/apple-oss-distributions/dyld/blob/main/include/mach-o/fixup-chains.h)
- [Apple mach-o/loader.h, exports trie](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)
- [DWARF 5, section 7.6, LEB128](https://dwarfstd.org/doc/DWARF5.pdf)
