# analyze and the binary_overview record

> rea analyze is the CLI name of binary_overview, a derived record that counts what Ghidra found: segments, procedures, and defined strings, for one build at a time.

You have two builds of the same four functions: the arm64 executable `ledger-arm64-O1` and the x86-64 object `ledger-x86_64-O1.o`. Before you read any function, you want one screen per build that says how big it is and what Ghidra made of it. `rea analyze` is that screen.

When you finish this section, you can run `rea analyze` on both builds and read the twelve and the ten segments. You can also explain why one build has 13 procedures and the other has 4.

## One CLI verb, one composed operation

`analyze` and `inspect` are aliases of the MCP operation `binary_overview`. With Ghidra, the operation asks the bridge one question, `read_binary_inventory_summary`, and gets the segments and both counts in one reply. A provider without that question gets the older path: `list_segments`, `list_procedures`, and `list_strings` at the same time. Either way, the result is the segments with their lengths and the two counts. The output schema has six fields: `document`, `image_base`, `segments`, `segment_count`, `procedure_count`, and `string_count`. Each segment can also carry `image_base` and `address_space`.

```listing
title: the two overview commands
source: capture/out/00-commands.txt
lang: text
note: Four lines from the command index. Each call imported its target into a fresh headless project and took 7 to 9 s. The times change on every run and are cut.
---
$ rea analyze fixtures/ledger-arm64-O1 --provider ghidra --format json
[exit 0] (…) -> 05-analyze-arm64-O1.json
$ rea analyze fixtures/ledger-x86_64-O1.o --provider ghidra --format json
[exit 0] (…) -> 05-analyze-x86_64-O1.json
```

**Composed operation:** a rea operation whose result is built from other operations. Its Evidence record names the provider `rea-workflow`, carries the Ghidra profile as `upstream_analysis_profile`, and has `confidence: "derived"`. Its first limitation is "Derived by an REA composed workflow.". The Ghidra limitations follow it, and each one starts with the engine, its version, and the operation that made it, for example `Ghidra (ghidra 12.1.4) read_binary_inventory_summary:`. The profile parameter `source_limitations: "provider-operation-caveats-v1"` names that rule. A primitive operation such as `list_procedures` is `observed`.

```listing
title: the provider block of a composed record
source: capture/out/05-analyze-arm64-O1.json
lang: json
note: Cut to the provider, the start of the analysis profile, and the two workflow parameters. The remaining profile parameters are the same in every Ghidra record of this manual.
---
"provider": {
  "id": "rea-workflow",
  "name": "REA composed investigation workflow",
  "version": "1"
},
"analysis_profile": {
  …
  "parameters": {
    "upstream_analysis_profile": {
      "provider": {
        "id": "ghidra",
        "name": "Ghidra",
        "version": "12.1.4"
      },
      "parameters": {
        "target_kind": "executable",
        "target_format": "mach-o",
        "architecture": "arm64",
        …
        "import_mode": "ephemeral-source-immutable",
        …
      },
      …
    },
    "source_limitations": "provider-operation-caveats-v1",
    "workflow_revision": 4
  },
  …
},
```

## The arm64 executable

```listing
title: binary_overview of ledger-arm64-O1
source: capture/out/05-analyze-arm64-O1.json
lang: json
note: Cut to the result. Nine of the twelve segment entries and eight of the nine limitations are cut.
---
"normalized_result": {
  "document": "target-01b5d08b08fb.bin",
  "image_base": "0x100000000",
  "segments": [
    {
      "name": "__TEXT",
      "start": "0x100000000",
      "end": "0x100000500",
      "length": 1280,
      "image_base": "0x100000000",
      "address_space": "ram"
    },
    {
      "name": "__text",
      "start": "0x100000500",
      "end": "0x100000740",
      "length": 576,
      "image_base": "0x100000000",
      "address_space": "ram"
    },
    …
    {
      "name": "EXTERNAL",
      "start": "0x10000c000",
      "end": "0x10000c200",
      "length": 512,
      "image_base": "0x100000000",
      "address_space": "ram"
    }
  ],
  "segment_count": 12,
  "procedure_count": 13,
  "string_count": 39
},
"confidence": "derived",
"authority": "shipped-artifact",
"environment": null,
"limitations": [
  "Derived by an REA composed workflow.",
  …
],
```

The `document` is not the file you named. It is `target-01b5d08b08fb.bin`, the private copy that rea makes under its runtime root. The name is `target-` plus the first twelve hex digits of the SHA-256. [Section 4.1](#s-open-binary-and-the-headless-bridge) shows that copy being made.

The twelve segments are Ghidra memory blocks. They are different from the four `LC_SEGMENT_64` commands of [section 3.2](#s-inspect-binary-layout-and-the-load-image). Ghidra splits `__TEXT` into the 1280-byte header range and its five sections. It splits `__DATA_CONST` into `__got`, `__const`, and the 16296 bytes after them. It splits `__LINKEDIT` into the 1104 used bytes and the padding to the next page.

The ends are exclusive: `__text` runs from `0x100000500` to `0x100000740`, and the next block starts at `0x100000740`. The last block, `EXTERNAL`, is not in the file at all. Ghidra creates it for imported functions, and [section 4.2](#s-list-procedures-and-function-bodies) shows four of them living there.

The 13 procedures are the four functions of `ledger.c`, the `entry` function that `LC_MAIN` points to, four thunks, and four external functions. The thunks are in `__stubs` and the externals are in `EXTERNAL`. The 39 strings are everything Ghidra defined as string data, and [section 4.5](#s-list-strings) places each one.

## The x86-64 relocatable object

```listing
title: binary_overview of ledger-x86_64-O1.o
source: capture/out/05-analyze-x86_64-O1.json
lang: json
note: Cut to the result. The .comment, .rela.rodata, .rela.text, .strtab, .symtab, and _elfHeader entries are cut.
---
"normalized_result": {
  "document": "target-9a4a8082ba5e.o",
  "image_base": "0x100000",
  "segments": [
    {
      "name": ".text",
      "start": "0x100000",
      "end": "0x10009f",
      "length": 159,
      "image_base": "0x100000",
      "address_space": "ram"
    },
    {
      "name": ".rodata",
      "start": "0x1000a0",
      "end": "0x1000f0",
      "length": 80,
      "image_base": "0x100000",
      "address_space": "ram"
    },
    {
      "name": ".rodata.str1.1",
      "start": "0x1000f0",
      "end": "0x1000fa",
      "length": 10,
      "image_base": "0x100000",
      "address_space": "ram"
    },
    …
    {
      "name": "_elfSectionHeaders",
      "start": "_elfSectionHeaders:0x0",
      "end": "_elfSectionHeaders:0x2c0",
      "length": 704,
      "image_base": "0x100000",
      "address_space": "_elfSectionHeaders"
    }
  ],
  "segment_count": 10,
  "procedure_count": 4,
  "string_count": 20
},
```

The object has three loaded blocks and seven others. `.text` holds 159 bytes of code for the four functions. `.rodata` holds 80 bytes, with the value table of `grade` at `0x1000b4` and the offset table of `grade_label`. `.rodata.str1.1` holds ten bytes: the five labels `F`, `D`, `C`, `B`, `A`, each with its terminator.

The other seven blocks live in their own address spaces. The record names each space in `address_space` and writes the addresses as `.comment:0x0` or `_elfSectionHeaders:0x0`. That spelling is the rule from the Ghidra limitation that every record carries: "Default-space addresses use lowercase 0x-prefixed hexadecimal; other address spaces use <percent-encoded-space>:0x<hex>."

Four procedures, not 13. An object file has no `main`, no stubs, and no imports, so there is nothing external to list. The 704 bytes of `_elfSectionHeaders` are eleven section headers of 64 bytes, the table that [lesson 32](phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch) parses first.

| | `ledger-arm64-O1` | `ledger-x86_64-O1.o` |
|---|---|---|
| `document` | `target-01b5d08b08fb.bin` | `target-9a4a8082ba5e.o` |
| `target_format`, `architecture` | `mach-o`, `arm64` | `elf`, `x86_64` |
| `segment_count` | 12 | 10 |
| code block | `__text`, 576 bytes | `.text`, 159 bytes |
| `procedure_count` | 13 | 4 |
| `string_count` | 39 | 20 |
| profile `digest` | `3fc72c9b` and 56 more digits | `769518a8` and 56 more digits |

```figure
id: fig-3-5
kind: comparison
title: the two overviews side by side
claim: The same four functions give 13 procedures in a linked executable and 4 in a relocatable object, because stubs, externals, and an entry point exist only after linking.
caption: Read each column top to bottom. The green box names the Ghidra document, the list is every block with its length, and the violet box is the record's confidence. From capture/out/05-analyze-arm64-O1.json and 05-analyze-x86_64-O1.json.
```

## What the overview does not say

The record has no function sizes and no entry point. It reports the image base: `0x100000000` for the executable and `0x100000` for the object. For the object, that base is the placement that Ghidra chose.

The counts also have a limit, and the record states it: "Counts use the complete defined-string inventory and the same local/external function inventory as list_strings and list_procedures. They do not establish discovery of undefined strings or unidentified functions." A count of 13 procedures is what Ghidra identified. Code that Ghidra did not find as a function is not in the count.

For sizes, use the `body` of each function in [section 4.2](#s-list-procedures-and-function-bodies). For the entry point, use `LC_MAIN` in [section 3.2](#s-inspect-binary-layout-and-the-load-image). The two profile digests differ, `3fc72c9b` against `769518a8`, because `target_format` and `architecture` are inside the profile parameters. [Section 5.3](#s-snapshots-and-the-answer-cache) shows that a cached answer replays only when the whole digest matches.

```takeaways
- Run `rea analyze` once per build and keep the `document` name with the record.
- Count Ghidra memory blocks separately from load commands and ELF sections.
- Expect thunks, externals, and `entry` only in a linked executable.
- Read `confidence: "derived"` as a sign that three primitive records stand behind this one.
```

Sources: capture/out/00-commands.txt, capture/out/05-analyze-arm64-O1.json, capture/out/05-analyze-x86_64-O1.json; rea 6.7.0 at 27dc42d: src/cliCommandNames.ts, src/application/InvestigationProviders.ts, src/application/EnhancedTools.ts, src/application/WorkflowEvidence.ts, src/contracts/toolOutputSchemaGroups.ts, src/contracts/toolOutputSchemaPrimitives.ts, src/ghidra/GhidraTargetSnapshot.ts, src/ghidra/GhidraInventoryValues.ts, bridge/ghidra/ReaGhidraBridge.java
