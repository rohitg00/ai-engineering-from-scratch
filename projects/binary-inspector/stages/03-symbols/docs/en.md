# Symbols, string tables, and demangled names

Stage 3 of 6. This stage reads the ELF symbol records of lesson [32](../../../../../phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md) and the COFF and Mach-O symbol tables of lesson [40](../../../../../phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/docs/en.md). The C++ names come from lesson [41](../../../../../phases/13-tools-and-protocols/41-recovering-data-and-types/docs/en.md).

## What you build

You write three functions in the `symbols` module:

- `read_cstring(data, offset, end=None)` reads one NUL-terminated name and refuses a name that has no terminator before `end`.
- `demangle(name)` turns a supported Itanium C++ name into its source form, or returns `None`.
- `symbols(data)` returns every symbol of the file in one shape.

## Why it matters

Symbols are the names a reviewer reads first: which functions a build defines, which ones it needs from elsewhere, and what strip removed. All three formats store names as offsets into a string table. A name offset that points outside its table is the most common corruption in a damaged file. A reader that does not check it prints text from some other table.

The three record layouts:

| Format | Record | Size | Fields |
|---|---|---|---|
| ELF `Elf64_Sym` | `<IBBHQQ` | 24 | name offset, info (binding high 4 bits, type low 4 bits), other, section index, value, size |
| COFF symbol | `<8sIhHBB` | 18 | short name or `0` plus string table offset, value, section number (signed), type, storage class, auxiliary count |
| Mach-O `nlist_64` | `<IBBHQ` | 16 | string offset, `n_type`, `n_sect`, `n_desc`, value |

## Work through one concrete case

ELF. The `.symtab` of the tally object starts at offset 488. Entry 9 is:

```text
59 00 00 00 12 00 02 00 00 00 00 00 00 00 00 00 92 00 00 00 00 00 00 00
```

Name offset `0x59` into `.strtab` (offset 1064) gives `tally_sum`. Info `0x12` is binding 1 (`"global"`) and type 2 (`"func"`). Section index 2 is `.text`. Value 0, size `0x92` (146). `llvm-objdump -t` prints `0000000000000000 g F .text 0000000000000092 tally_sum`.

COFF. Record 28 of the COFF object is `00 00 00 00 6c 00 00 00 a0 00 00 00 01 00 20 00 02 00`. The first four bytes are zero, so the name is at offset `0x6c` in the string table that follows the 36 records: `tally_scale`. Value `0xa0`, section 1 (`.text`), type `0x20` (function), storage class 2 (external, so `"global"`), no auxiliary records. A section symbol such as `.text` has one auxiliary record. Skip it, and keep the raw index of each record, because relocations in stage 4 count auxiliary records too.

Mach-O. Entry 9 of the executable is `62 00 00 00 0f 01 00 00 40 07 00 00 01 00 00 00`. `n_type` `0x0f` is `N_SECT 0x0e` plus `N_EXT 0x01`: defined, global. `n_sect` 1 is `__text`, which holds instructions, so the kind is `"func"`. Value `0x100000740`. Entry 14 is `_puts` with `n_type` 1 (undefined, external) and `n_desc` `0x0100`. Bits 8 to 15 of `n_desc` hold library ordinal 1, the first `LC_LOAD_DYLIB`.

C++. `names.cpp` compiles to `_ZN5tally5resetEPNS_7CounterE`. Parse it:

1. `_Z` starts an encoding. `N ... E` is a nested name: `5tally`, `5reset`. Record `tally` as substitution `S_`. The last part of a function name is not recorded.
2. Parameters follow. `P` is a pointer to the next type.
3. `N S_ 7Counter E` is a nested name. `S_` expands to `tally`, then `Counter`. Record `tally::Counter` as `S0_`.
4. The pointer type `tally::Counter*` becomes `S1_`.

Result: `tally::reset(tally::Counter*)`, the same text that `c++filt` prints.

```figure
pj-binary-inspector-3
```

Type a mangled name in the lab. It shows each token, the substitution table as it grows, and the result.

## Implement the contract

`read_cstring(data: bytes, offset: int, end: int | None = None) -> str`: raise `FormatError` when `offset` is outside `[0, end)` or there is no NUL before `end`. Decode UTF-8 with replacement.

`demangle(name) -> str | None`. Supported subset:

- `_Z` and the Mach-O form `__Z`.
- Plain and nested names (`N ... E`), const member functions (`NK`), constructors `C1` `C2` `C3` and destructors `D1` `D2` `D3`, and `St` for `std::`.
- Builtin types `v b c a h s t i j l m x y f d e w z`, and `P`, `R`, `O`, `K` (pointer, reference, rvalue reference, const). Print `K` as a suffix: `char const*`.
- Substitutions `S_`, `S0_`, `S1_`, and so on, with base 36 digits.
- A function with the single parameter `v` prints `()`.
- Return `None` for a name that is not mangled, for a non-string, and for anything outside the subset, such as templates (`I ... E`) or an undefined substitution. Never raise.

`symbols(data: bytes) -> list[dict]`, one dictionary per symbol:

```python
{"index": int, "name": str, "demangled": str | None, "value": int, "size": int | None,
 "kind": "func" | "object" | "section" | "file" | "notype" | ..., "binding": "local" | "global" | "weak",
 "section": str | None, "defined": bool, "table": "symtab" | "dynsym" | "coff" | "nlist"}
```

- ELF: read every `SYMTAB` and `DYNSYM` section, skip entry 0, and take the string table from `sh_link`. Section index 0 is undefined (`None`), `0xfff1` is `"*ABS*"`, `0xfff2` is `"*COMMON*"`. An unnamed section symbol takes its section's name.
- COFF: section number above 0 names a section, -1 is `"*ABS*"`, -2 is `"*DEBUG*"`, and 0 with a nonzero value on an external symbol is `"*COMMON*"`. Storage class 103 is `"file"`. A static symbol with the section's own name and an auxiliary record is `"section"`. Type `0x20` is `"func"`. A PE image has no symbol table, so return `[]`.
- Mach-O: skip debug entries (`n_type & 0xe0`). `N_SECT` names a section, `N_ABS` is `"*ABS*"`, an undefined external with a nonzero value is `"*COMMON*"`. Add `library_ordinal` (bits 8 to 15 of `n_desc`) to undefined symbols.
- `defined` is `section is not None`.

## Verify and inspect

```bash
python3 scripts/project_test.py binary-inspector --stage 3 --path learning-artifacts/binary-inspector --strict
```

The tests compare names, values, sizes, bindings, and sections with `llvm-objdump -t` and `nm -m`, and the demangled names with `c++filt`.

## Investigate the failure boundary

- Set the name offset of ELF entry 1 to `0x7ffffff0`. `symbols` must raise. It must not return an empty name.
- Compare the unstripped and stripped arm64 builds. Strip keeps five records: four undefined imports that dyld needs to bind, and `__mh_execute_header`, which is referenced dynamically. The stripped dylib keeps no records at all.
- Try `_Z1fS_`. There is no substitution yet, so the demangler must return `None`.
- MSVC names such as `??_C@_03IMLOALHE@low?$AA@` use a different scheme. The demangler returns `None` for them.

## Extensions

- Add template arguments (`I ... E`) and template parameters (`T_`).
- Read the ELF `.gnu.version` table and attach `@GLIBC_2.2.5` style versions to `.dynsym` names.
- Print the COFF auxiliary section record: length, relocation count, checksum, and COMDAT selection.

## References

- [System V gABI, symbol table](https://www.sco.com/developers/gabi/latest/ch4.symtab.html)
- [Microsoft PE Format, COFF symbol table](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format#coff-symbol-table)
- [Apple mach-o/nlist.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/nlist.h)
- [Itanium C++ ABI, mangling](https://itanium-cxx-abi.github.io/cxx-abi/abi.html#mangling)
