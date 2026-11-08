# list_strings

> list_strings returns every string that Ghidra defined as Data, which includes loader metadata and symbol fragments, and excludes any text Ghidra did not define.

You expect five labels and three format strings. `list_strings` returns 39 items, among them `/usr/lib/dyld`, `_label`, `_`, and an empty string. Each one is a real run of bytes in the file. The list is complete for what Ghidra defined, and it is only that.

When you finish this section, you can place each of the 39 strings in its load command. You can also say what an empty result does and does not prove.

## The call

```listing
title: list_strings and three of its items
source: capture/out/10-mcp-08-list-strings.json
lang: json
note: The request arguments, three items cut from the 39, and the two string limitations of the seven.
---
"name": "list_strings",
"arguments": {}
…
{
  "address": "0x100000770",
  "value": "F",
  "string": {
    "encoding": "US-ASCII",
    "termination": "present_or_not_required",
    "byte_length": 2
  }
},
…
{
  "address": "0x1000007cf",
  "value": "",
  "string": {
    "encoding": "US-ASCII",
    "termination": "present_or_not_required",
    "byte_length": 1
  }
},
…
{
  "address": "0x1000080c7",
  "value": "_label",
  "string": {
    "encoding": "US-ASCII",
    "termination": "present_or_not_required",
    "byte_length": 7
  }
},
…
"limitations": [
  …
  "Only Ghidra-defined string Data is observed; packed or undefined string bytes may be absent. Completeness applies to that inventory, and an empty search does not establish that text is absent from the artifact. If an address is known, use read_bytes and xrefs to inspect bytes and references.",
  "Charset is reported, while a non-missing terminator cannot distinguish a present terminator from a fixed or Pascal layout.",
  …
],
```

The bridge walks every defined data item in the program and keeps the ones with a string value. For each it records the charset, whether a required terminator is missing, and the byte length. Each item is a `Data` object that Ghidra's loader or analyzers created. A run of printable bytes that no analyzer turned into `Data` is not in the list. The first limitation is fixed in rea, and the docs say the same:

```rule
label: what an empty result proves
source: ghidra §Admitted inventory semantics
---
Packed or undefined literals, Rust strings among them, can be missing from the list. An empty result does not prove that the text is not in the file.
```

`termination` has two values. `missing` means a string type that needs a null byte has none. `present_or_not_required` covers everything else, because Ghidra cannot tell a present terminator from a layout that needs none. `byte_length` counts the terminator: `F` is two bytes.

## Thirty-nine strings in six places

Sort the 39 addresses and they fall into six runs. Each run is one load command from [section 3.2](#s-inspect-binary-layout-and-the-load-image).

| Where | Addresses | Count | Examples |
|---|---|---|---|
| load command strings in the header | `0x100000404`, `0x100000490` | 2 | `/usr/lib/dyld`, `/usr/lib/libSystem.B.dylib` |
| `__TEXT,__cstring`, file 1904 | `0x100000770` to `0x1000007cf` | 10 | `F`, `D`, `C`, `B`, `A`, `usage: ledger <before> <after> [score...]\n`, `change %d%%\n`, `total %d\n`, `score %d grade %s\n`, and one empty string |
| `LC_DYLD_CHAINED_FIXUPS` import names, file 32768 | `0x100008069` to `0x1000080a7` | 6 | `___stack_chk_fail`, `_atoi`, `_printf` |
| `LC_DYLD_EXPORTS_TRIE` edge labels, file 32944 | `0x1000080b2` to `0x100008111` | 7 | `_`, `_label`, `grade`, `main`, `percent_change`, `total` |
| `LC_SYMTAB` string table, file 33304 | `0x10000821a` to `0x1000082a5` | 13 | `__mh_execute_header`, `_grade_label`, `_labels` |
| `LC_CODE_SIGNATURE` identifier, file 33456 | `0x10000831c` | 1 | `ledger-arm64-O1` |

The ten in `__cstring` are the program's own text. The section is 95 bytes, and Ghidra's block for it in [section 3.4](#s-analyze-overview) is 96. The block runs to the start of `__const` at `0x1000007d0`. The extra byte at `0x1000007cf` is the alignment pad, and Ghidra defined it as an empty string of length 1. That item is real and harmless, and you will see pads like it in every linked image.

The export trie is a prefix tree of the exported names. Its edges carry shared prefixes once. Ghidra's string data therefore holds seven fragments, `_`, `_label`, `_mh_execute_header`, `grade`, `main`, `percent_change`, and `total`, and not the six export names. The string table of `LC_SYMTAB` holds the thirteen full names, which match the `nsyms` of 13. The last string is the code signature's identifier, the output file name that the linker embedded. That is why the capture kit warns that a different output name gives different bytes.

```figure
id: fig-4-7
kind: structure
title: the 39 strings of ledger-arm64-O1 by load command
claim: Ten of the 39 strings are the program's text, and the other 29 are names and paths that the loader and the linker keep in the file.
caption: Read top to bottom by address. Each row names the load command, the address range, the count, and one example. From capture/out/10-mcp-08-list-strings.json and 04-inspect-macho.json.
```

## Strings a function refers to

The dossier of `_grade_label` has a `referenced_strings` facet with one item, `F` at `0x100000770`, from the load at `0x1000005c8`. The function does not load `F`. It loads a pointer from `_labels` at `0x100004030`, the 40-byte `__const` in `__DATA_CONST` that holds five pointers to the five labels. Ghidra followed the first pointer and recorded the string behind it, and its `referenced_names` facet lists both `_labels` and `s_F_100000770` from the same instruction. Read a referenced string as a string the function can reach, not as the only one.

In the x86-64 object the same five labels sit in `.rodata.str1.1`, the ten-byte block in [section 3.4](#s-analyze-overview), and `string_count` is 20. [Lesson 32](phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch) reads the ELF string tables that hold the other ten.

## What the inventory cannot prove

The limit is in the first word of the rule: `defined`. Three kinds of text are not `Data`. A compiler can pack a string into a struct. The analyzer can skip a string without a terminator. A program can build a string at run time. The list has none of them.

The capture target has none of those, so the 39 items are the whole file. For a target you did not build, treat an absent string as unknown. When you know an address, `read_bytes` returns the bytes and `xrefs` returns who uses them, as the limitation says. [Section 5.2](#s-residual-unknowns-and-coverage) shows how rea records that kind of unknown.

```takeaways
- Sort the string addresses and map each run to a load command before you read the values.
- Expect symbol names, library paths, trie fragments, and pads in every linked image.
- Treat an absent string as unknown, then use `read_bytes` on an address you know.
- Read `referenced_strings` as the text a function reaches through a load. Expect the function to use more.
```

Sources: capture/out/10-mcp-08-list-strings.json, capture/out/04-inspect-macho.json, capture/out/05-analyze-arm64-O1.json, capture/out/10-mcp-12-analyze-function-grade-label-O1.json, capture/fixtures/ledger-arm64-O1, capture/README.md; rea 6.7.0 at 27dc42d: bridge/ghidra/ReaGhidraBridge.java, src/ghidra/GhidraProviderCapabilities.ts; rea docs/ghidra-provider.md
