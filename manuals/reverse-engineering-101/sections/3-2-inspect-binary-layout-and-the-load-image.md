# inspect-binary-layout and the load image

> On macOS, inspect-binary-layout refuses with capability_unavailable, and inspect-macho is the engine-free reader of segments, sections, load commands, imports, and exports.

You ran `rea inspect-binary-layout fixtures/ledger-x86_64-O1.o --format json` on the capture Mac. It exited 1 and printed a JSON error instead of a layout. Nothing is broken. rea 6.7.0 has two engine-free layout readers, and this one runs on Linux x64 only.

When you finish this section, you can read that error envelope and name the host rule behind it. You can also read the load image of `ledger-arm64-O1` from `inspect-macho`: four segments, 17 load commands, six imports, and six exports.

## The error envelope

```listing
title: inspect-binary-layout on macOS
source: capture/out/04-inspect-binary-layout.json
lang: json
note: The whole file. The CLI exit status was 1.
---
{
  "code": "capability_unavailable",
  "category": "unsupported_provider",
  "message": "The initial real-verified pwntools artifact profile supports Linux x64 only.",
  "retryable": false,
  "remediation": {
    "action": "The initial real-verified pwntools artifact profile supports Linux x64 only."
  },
  "details": {
    "provider_id": "pwntools-elf",
    "operation": "inspect_binary_layout",
    "reason": "The initial real-verified pwntools artifact profile supports Linux x64 only."
  }
}
```

Every failure in rea has this shape: `code`, `category`, `message`, `retryable`, `remediation.action`, and an optional `details` object. The provider is `pwntools-elf`. Its decoder throws `AnalysisCapabilityUnavailableError` when `process.platform` is not `linux` or `process.arch` is not `x64`, before it looks for Python. The message is a constant in the same file. The MCP server lists the tool as unavailable unless the host is Linux x64 and `REA_PWNTOOLS_PYTHON` is an absolute path. The exit status follows the CLI rule for an operation that could not finish {{cli §Output and exit status}}.

The capture kit gave the tool the ELF object because `inspect_binary_layout` is written for ELF. On a Linux x64 host with pwntools 4.15.0 it returns sections, segments, symbols, and relocations. [Section 2.3](#s-rea-capabilities) shows how each operation declares its availability before you call it, and [the reference](#s-ref-errors) lists every error code the captures produced.

## inspect-macho and the tools it runs

`inspect-macho` is the macOS reader, from the provider `native-macos`, "macOS native inspection utilities". It runs seven host commands and records each one as provenance.

```listing
title: the provenance of one inspect-macho run
source: capture/out/04-inspect-macho.json
lang: json
note: Cut to the tool names and three of the commands. Each entry also records the executable SHA-256, the exit code, and the output sizes.
---
"provenance": [
  {
    "tool": "lipo",
    "command": [
      "/Library/Developer/CommandLineTools/usr/bin/lipo",
      "-detailed_info",
      "$ARTIFACT"
    ],
    …
  },
  {
    "tool": "otool",
    "command": [
      "/Library/Developer/CommandLineTools/usr/bin/llvm-otool",
      "-h",
      "-l",
      "$ARTIFACT"
    ],
    …
  },
  {
    "tool": "nm",
    …
  },
  {
    "tool": "dyld_info",
    "command": [
      "/Library/Developer/CommandLineTools/usr/bin/dyld_info",
      "-imports",
      "$ARTIFACT"
    ],
    …
  },
  {
    "tool": "dyld_info",
    …
  },
  {
    "tool": "dwarfdump",
    …
  },
  {
    "tool": "vtool",
    …
  }
],
```

The command list is fixed in the provider. It runs `lipo -detailed_info` to discover the slices. For each slice it runs `otool -h -l`, `nm -gjU --no-dyldinfo`, `dyld_info -imports`, `dyld_info -exports`, and `dwarfdump --uuid`. It runs `vtool -show-build` as an optional extra. The run starts no Java and takes a few seconds. Keep one limitation of the record in mind when a name you expect is missing: "Imports and exports combine dyld_info and nm; stripped or toolchain-hidden symbols may be absent."

```figure
id: fig-3-2
kind: comparison
title: two layout commands on the capture Mac
claim: The same host refuses one layout reader on platform and answers the other with 17 load commands, because each reader names its own prerequisites.
caption: Left to right in each column. Solid arrows are calls, the dashed rose arrow is the failure, the dashed ink arrow is a reply. From capture/out/04-inspect-binary-layout.json and 04-inspect-macho.json.
```

## The load image

```listing
title: header facts and the entry point
source: capture/out/04-inspect-macho.json
lang: json
note: Cut from normalized_result to the header, the entry point, and the build metadata. rea names the build platform and tool codes from loader.h.
---
"format": "mach-o",
"selected_architecture": {
  "name": "arm64",
  "container_file_offset": 0
},
"endian": "little",
"word_size": 64,
"file_type": "2",
"flags": [
  "0x00200085"
],
"uuid": "59A1CCA5-97D1-3661-99DA-666BC2BB38D7",
"entrypoints": {
  "items": [
    {
      "file_offset": 1488
    }
  ],
  …
},
…
"build_metadata": {
  "items": [
    {
      "platform": "MACOS",
      "minimum_os": "26.0",
      "sdk": "26.2",
      …
```

**Load command:** one record in the list that follows the Mach-O header, with a `cmd` type and a `cmdsize`. Apple publishes no prose specification, so the `loader.h` header in the XNU source is the reference. `file_type` 2 is `MH_EXECUTE`. The flags `0x00200085` are `MH_NOUNDEFS` 0x1, `MH_DYLDLINK` 0x4, `MH_TWOLEVEL` 0x80, and `MH_PIE` 0x200000 added together. The entry point comes from `LC_MAIN`, whose `entryoff` is 1488, or 0x5d0. Add it to the `__TEXT` address below and you get `0x1000005d0`, the `_main` export.

The four `LC_SEGMENT_64` commands are the load image. Each `segment_command_64` names a `vmaddr`, a `vmsize`, a `fileoff`, a `filesize`, two protection fields, and `nsects`, and its `section_64` records follow inside the same command.

| Segment | `vmaddr` | `vmsize` | `fileoff` | `filesize` | `initprot` | `nsects` |
|---|---|---|---|---|---|---|
| `__PAGEZERO` | `0x0` | 4294967296 | 0 | 0 | 0 | 0 |
| `__TEXT` | `0x100000000` | 16384 | 0 | 16384 | 5, read and execute | 5 |
| `__DATA_CONST` | `0x100004000` | 16384 | 16384 | 16384 | 3, read and write | 2 |
| `__LINKEDIT` | `0x100008000` | 16384 | 32768 | 1104 | 1, read | 0 |

```listing
title: the __TEXT segment and its five sections
source: capture/out/04-inspect-macho.json
lang: json
note: Cut from the segments collection. Permissions, alignment, and flags are cut from each section.
---
{
  "name": "__TEXT",
  "vm_address": "0x100000000",
  "vm_size": 16384,
  "file_offset": 0,
  "file_size": 16384,
  …
  "sections": {
    "items": [
      {
        "segment": "__TEXT",
        "name": "__text",
        "address": "0x100000500",
        "size": 576,
        "file_offset": 1280,
        …
      },
      {
        "segment": "__TEXT",
        "name": "__stubs",
        "address": "0x100000740",
        "size": 48,
        "file_offset": 1856,
        …
      },
      {
        "segment": "__TEXT",
        "name": "__cstring",
        "address": "0x100000770",
        "size": 95,
        "file_offset": 1904,
        …
      },
      {
        "segment": "__TEXT",
        "name": "__const",
        "address": "0x1000007d0",
        "size": 64,
        "file_offset": 2000,
        …
      },
      {
        "segment": "__TEXT",
        "name": "__unwind_info",
        "address": "0x100000810",
        "size": 96,
        "file_offset": 2064,
        …
      }
    ],
```

`__PAGEZERO` reserves the first 4 GiB of the address space with no file bytes, so a null pointer never reaches mapped memory. `__TEXT` starts at `0x100000000` and maps the first 16384 bytes of the file. Its code section `__text` holds 576 bytes at `0x100000500`, and [Part 4](#s-list-procedures-and-function-bodies) accounts for every one of them. `__cstring` holds the format strings and the five labels, and `__const` holds the two lookup tables that [the jump table section](#s-xrefs-and-the-jump-table) reads.

The `__LINKEDIT` segment has no sections. Other load commands point into it by file offset.

| Command | Offset in the file | Size |
|---|---|---|
| `LC_DYLD_CHAINED_FIXUPS` | 32768 | 176 |
| `LC_DYLD_EXPORTS_TRIE` | 32944 | 104 |
| `LC_FUNCTION_STARTS` | 33048 | 8 |
| `LC_SYMTAB`, 13 symbols | `symoff` 33056, `stroff` 33304 | `strsize` 152 |
| `LC_CODE_SIGNATURE` | 33456 | 416 |

The last command ends at 33872, the file size. In ELF the loader reads a program header table and the linker reads a section header table, two tables that the ELF header points to. In Mach-O there is one list, and `LC_SEGMENT_64` carries its sections inside the command. [Lesson 32](phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch) builds a reader for both formats from the specifications and lines up each load command with its ELF idea.

```figure
id: fig-3-3
kind: layers
title: the load image of ledger-arm64-O1
claim: Four segments map 33872 file bytes into three address ranges, and every other load command points into the last one by file offset.
caption: Read from the lowest address at the top. The left column is the address, the right column is the file offset. The dashed box has no file bytes. From capture/out/04-inspect-macho.json.
```

## Imports and exports

```listing
title: the exported functions
source: capture/out/04-inspect-macho.json
lang: json
note: Cut from the exports collection. The __mh_execute_header entry and the weak and reexport fields are cut.
---
"exports": {
  "items": [
    …
    {
      "name": "_grade",
      "address": "0x100000518",
      …
    },
    {
      "name": "_grade_label",
      "address": "0x100000588",
      …
    },
    {
      "name": "_main",
      "address": "0x1000005d0",
      …
    },
    {
      "name": "_percent_change",
      "address": "0x100000500",
      …
    },
    {
      "name": "_total",
      "address": "0x100000554",
      …
    }
  ],
  "total": null,
  "exhaustive": false,
  "limitations": [
    "Merged nm/dyld_info results may be incomplete for stripped binaries."
  ]
},
```

Six exports: the five functions and `__mh_execute_header` at `0x100000000`. Six imports from `libSystem`: `___stack_chk_fail`, `___stack_chk_guard`, `___stderrp`, `_atoi`, `_fwrite`, and `_printf`.

One dependency: `/usr/lib/libSystem.B.dylib`. rea lists only dylib load commands as dependencies. The dynamic linker `/usr/lib/dyld` stays in the `LC_LOAD_DYLINKER` row of the load commands.

Both the imports and the exports collections say `exhaustive: false`, because each merges the text of two tools. The record does not promise that the list is complete, and you should not promise it either. [Section 4.2](#s-list-procedures-and-function-bodies) shows the same names as Ghidra sees them, and [the next section](#s-address-to-file-offset) turns `0x100000518` into a file offset.

```takeaways
- Expect `capability_unavailable` from `inspect-binary-layout` on any host that is not Linux x64.
- Read `code`, `category`, and `details.provider_id` before you retry anything.
- On macOS run `inspect-macho` and read the four `LC_SEGMENT_64` rows first.
- Check `exhaustive` on each collection before you say a symbol is absent.
```

Sources: capture/out/00-commands.txt, capture/out/04-inspect-binary-layout.json, capture/out/04-inspect-macho.json; rea 6.7.0 at 27dc42d: src/contracts/errorSchemas.ts, src/native/pwntools/PwntoolsDecoder.ts, src/server/createServer.ts, src/native/NativeMachoInspection.ts, src/native/parsers/otool.ts; rea docs/cli.md
