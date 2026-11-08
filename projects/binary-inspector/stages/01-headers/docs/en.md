# Detect the format and parse the header

Stage 1 of 6. Read the [project README](../../../README.md) first. This stage applies the ELF header reader of lesson [32](../../../../../phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md). It adds COFF, PE32+, and Mach-O with the tables of lesson [40](../../../../../phases/13-tools-and-protocols/40-linking-loading-and-stripped-binaries/docs/en.md).

## What you build

You write three functions in the `formats` module:

- `detect_format(data)` reads the first bytes and returns `"elf64"`, `"coff"`, `"pe"`, or `"macho64"`.
- `parse_header(data)` returns one dictionary shape for all four formats.
- `load_commands(data)` returns the Mach-O load commands in file order.

Every later stage calls `parse_header` first. If the header is wrong, every section, symbol, and fixup after it is wrong too.

## Why it matters

A file extension does not identify a binary. A `.o` file from clang can be ELF or Mach-O. A `.obj` file is a COFF object and has no magic number at all. The inspector must decide from the bytes, and it must refuse a file it cannot read correctly. A tool that guesses and continues prints tables that look correct and are not.

All four formats in this project are little-endian. The supplied `unpack(fmt, data, offset)` helper reads one record with `struct.unpack_from` and raises `FormatError` when the record runs past the end of the file. Use it for every read, so a truncated file always fails with a message that names the offset.

## Work through one concrete case

The first 32 bytes of the stripped arm64 build are:

```text
cf fa ed fe 0c 00 00 01 00 00 00 00 02 00 00 00
12 00 00 00 a8 05 00 00 85 00 20 00 00 00 00 00
```

Read them as eight little-endian 32-bit fields (`<IiiIIIII`):

| Field | Bytes | Value | Meaning |
|---|---|---|---|
| magic | `cf fa ed fe` | `0xfeedfacf` | Mach-O 64, little-endian |
| cputype | `0c 00 00 01` | `0x0100000c` | arm64 (`CPU_TYPE_ARM` with the 64-bit flag) |
| filetype | `02 00 00 00` | 2 | `MH_EXECUTE`, so kind is `"executable"` |
| ncmds | `12 00 00 00` | 18 | 18 load commands follow |
| sizeofcmds | `a8 05 00 00` | 1448 | they occupy bytes 32 to 1480 |
| flags | `85 00 20 00` | `0x00200085` | `MH_NOUNDEFS`, `MH_DYLDLINK`, `MH_TWOLEVEL`, `MH_PIE` |

The load commands start at offset 32. Each starts with `cmd` and `cmdsize`. The first is `LC_SEGMENT_64` (`0x19`). The next starts at 32 plus its `cmdsize`. One of the 18 is `LC_MAIN` (`0x80000028`), whose `entryoff` is `0x5e8`. The `__TEXT` segment starts at virtual address `0x100000000`, so the entry point is `0x1000005e8`. That is the address of `_main` in the unstripped build.

The other formats follow the same pattern:

- ELF: `7f 45 4c 46`, then `EI_CLASS` 2 (64-bit) and `EI_DATA` 1 (little-endian). `e_type` 1 is relocatable. `e_machine` 62 (`0x3e`) is x86-64. The tally object has `e_shnum` 13 and `e_shstrndx` 1.
- COFF object: no magic. Bytes `64 86` are machine `0x8664`, then `0a 00` is 10 sections. `SizeOfOptionalHeader` is 0, which is what makes it an object.
- PE image: `MZ` at offset 0, `e_lfanew` at `0x3c` is `0x40`, and `PE\0\0` is at `0x40`. The optional header starts at `0x58` with magic `0x20b` (PE32+). `AddressOfEntryPoint` `0x1000` plus `ImageBase` `0x140000000` gives entry `0x140001000`.

```figure
pj-binary-inspector-1
```

Pick a format in the lab and change the fields. The lab computes the same decision that `detect_format` makes and shows which check fails first.

## Implement the contract

`detect_format(data: bytes) -> str`

- Fewer than 4 bytes: raise `FormatError`.
- `\x7fELF`: require `EI_CLASS` 2 and `EI_DATA` 1, else raise `FormatError` that says "ELF64" or "little-endian". Return `"elf64"`.
- `MZ`: read `e_lfanew` at `0x3c` and require `PE\0\0` there. Return `"pe"`.
- `0xfeedfacf` read as a little-endian word: return `"macho64"`. Raise for `0xfeedface` ("32-bit") and for `ca fe ba be` ("universal").
- Otherwise, if the first 20 bytes parse as a COFF file header with a machine in `COFF_MACHINES`, `SizeOfOptionalHeader` 0, and 1 to 96 sections, return `"coff"`.
- Anything else: raise `FormatError("unknown format: ...")`.

`parse_header(data: bytes) -> dict` returns:

```python
{
    "format": "elf64" | "coff" | "pe" | "macho64",
    "arch": "x86_64" | "arm64" | ...,
    "bits": 64,
    "endian": "little",
    "kind": "relocatable" | "executable" | "shared" | ...,
    "entry": int | None,
    "fields": {...},
}
```

Required `fields` keys, which later stages and the tests read:

- ELF: `e_type`, `e_machine`, `e_flags`, `e_phoff`, `e_phnum`, `e_shoff`, `e_shnum`, `e_shstrndx`. Raise when a header table runs past the end of the file. Also raise when an entry size is not 64 (sections) or 56 (program headers), or when `e_shstrndx` is not below `e_shnum`. `entry` is `None` for a relocatable file.
- COFF and PE: `machine`, `number_of_sections`, `time_date_stamp`, `pointer_to_symbol_table`, `number_of_symbols`, `size_of_optional_header`, `characteristics`, and `section_table` (the file offset of the first section entry).
- PE adds `magic`, `entry_rva`, `image_base`, `section_alignment`, `file_alignment`, `size_of_image`, `size_of_headers`, `subsystem`, `dll_characteristics`, `dll_flags` (names from `DLL_CHARACTERISTICS`), and `data_directories`, a dictionary from the names in `PE_DIRECTORIES` to `{"rva", "size"}` for nonzero entries only. Refuse magic `0x10b` (PE32). `kind` is `"shared"` when characteristics bit `0x2000` (DLL) is set.
- Mach-O: `cputype`, `filetype`, `ncmds`, `sizeofcmds`, `flags`, `flag_names`, and `load_commands` (the list of names).

`load_commands(data: bytes) -> list[dict]` returns one `{"cmd", "name", "offset", "size"}` per command. Use `LOAD_COMMANDS` for names and `LC_0x...` for unknown values. Raise when `sizeofcmds` runs past the file, or when a `cmdsize` is below 8, not a multiple of 8, or runs past `sizeofcmds`.

## Verify and inspect

From the repository root, initialize once, then grade:

```bash
python3 scripts/project_test.py binary-inspector --init learning-artifacts/binary-inspector
python3 scripts/project_test.py binary-inspector --stage 1 --path learning-artifacts/binary-inspector --strict
```

A fresh workspace fails with `not implemented yet: stage 1: implement parse_header`. The tests check all four formats, the 18 Mach-O load commands in `otool -l` order, the PE fields that `llvm-objdump -p` prints, five rejected variants, and the held-out program.

## Investigate the failure boundary

- Set the ELF `e_shoff` to a value near the end of the file. `parse_header` must raise before any section is read.
- Set the first `cmdsize` of the Mach-O file to 0. Without the size check, the loop reads the same command forever.
- Set `e_lfanew` past the end of the PE file. The `unpack` bounds check must name the offset.
- Feed a C source file. The last COFF check must refuse it, because the machine field does not match.

## Extensions

- Add ELF32 and PE32 by reading the 32-bit field layouts. Keep the output shape the same.
- Read one slice of a universal Mach-O: the fat header lists each architecture with an offset and a size.
- Decode `LC_BUILD_VERSION` into a platform and minimum OS version.

## References

- [System V gABI, ELF header](https://www.sco.com/developers/gabi/latest/ch4.eheader.html)
- [Microsoft PE Format](https://learn.microsoft.com/en-us/windows/win32/debug/pe-format)
- [Apple mach-o/loader.h](https://github.com/apple-oss-distributions/xnu/blob/main/EXTERNAL_HEADERS/mach-o/loader.h)
- [Python struct module](https://docs.python.org/3/library/struct.html)
