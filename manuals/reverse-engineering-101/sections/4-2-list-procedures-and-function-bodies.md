# list_procedures and function bodies

> list_procedures returns every function Ghidra defined, internal and external, with thunks kept distinct, and the dossier body tells you how many bytes each one owns.

You wrote four functions and a `main`. Ghidra lists 13 procedures, four of them at addresses like `EXTERNAL:0x1`, and the one you called `main` is named `entry`. Each of those facts has a reason in the file, and the list is the place to learn them.

When you finish this section, you can account for all 13 procedures and tell a thunk from its external target. You can also read a function body as inclusive address ranges.

## The inventory

```listing
title: five of the thirteen procedures
source: capture/out/10-mcp-05-list-procedures.json
lang: json
note: Cut from normalized_result: one external function, two internal functions, and one thunk. The other nine entries have the same shape.
---
"normalized_result": [
  {
    "address": "EXTERNAL:0x1",
    "value": "/usr/lib/libSystem.B.dylib::___stack_chk_fail",
    "procedure": {
      "external": true,
      "thunk": false,
      "thunk_target": null
    }
  },
  …
  {
    "address": "0x100000518",
    "value": "_grade",
    "procedure": {
      "external": false,
      "thunk": false,
      "thunk_target": null
    }
  },
  …
  {
    "address": "0x1000005d0",
    "value": "entry",
    "procedure": {
      "external": false,
      "thunk": false,
      "thunk_target": null
    }
  },
  {
    "address": "0x100000740",
    "value": "___stack_chk_fail",
    "procedure": {
      "external": false,
      "thunk": true,
      "thunk_target": "EXTERNAL:0x1"
    }
  },
  …
],
```

The bridge builds the list once per program from two Ghidra iterators, the internal functions and the external functions. It drops duplicates by entry address. For each function it records `external`, `thunk`, and the resolved `thunk_target` when there is one. The value is the qualified symbol name, which is why the external entries carry their library path. The record's limitation states the rule: "External functions and local thunks are distinct; procedure metadata identifies both and preserves a thunk target when Ghidra resolves one.".

| Address | Name | Kind | Where it comes from |
|---|---|---|---|
| `EXTERNAL:0x1` to `EXTERNAL:0x4` | `___stack_chk_fail`, `_atoi`, `_fwrite`, `_printf` | external | four of the six `libSystem` imports in section 3.2 |
| `0x100000500` | `_percent_change` | internal, 24 bytes | `ledger.c` |
| `0x100000518` | `_grade` | internal, 60 bytes | `ledger.c` |
| `0x100000554` | `_total` | internal, 52 bytes | `ledger.c` |
| `0x100000588` | `_grade_label` | internal, 72 bytes | `ledger.c` |
| `0x1000005d0` | `entry` | internal, 368 bytes | `main` in `ledger-main.c`, named by `LC_MAIN` |
| `0x100000740` to `0x100000764` | the same four names | thunk, 12 bytes each | the `__stubs` section, 48 bytes |

**Thunk:** a small function whose only job is to transfer control to another function. The four thunks sit in `__stubs`, the 48-byte section at `0x100000740` from [section 3.2](#s-inspect-binary-layout-and-the-load-image). Each one is a 12-byte stub that reaches the real `libSystem` function. Ghidra represents that function as an entry in its `EXTERNAL` block, the last segment in [section 3.4](#s-analyze-overview). The two imports that are not functions, `___stack_chk_guard` and `___stderrp`, do not appear here, because they are data.

`entry` is `_main`. `inspect-macho` exports `_main` at `0x1000005d0`, and `LC_MAIN` points there with `entryoff` 1488. Ghidra names the entry point `entry` and keeps `_main` as a second symbol at the same address. The docs say that a secondary symbol at a function entry, such as an imported `_main` label, is accepted as a selector {{native §Exact CLI selectors}}, so `rea function fixtures/ledger-arm64-O1 _main` works.

```figure
id: fig-4-3
kind: structure
title: the thirteen procedures of ledger-arm64-O1
claim: Five internal functions fill the 576 bytes of __text without a gap, four thunks fill __stubs, and four externals live in a block Ghidra made.
caption: Read top to bottom by address. Grey rows are outside the file, green rows are code in __text, violet rows are the thunks Ghidra resolved. From capture/out/10-mcp-05-list-procedures.json and the five dossiers.
```

## Function bodies

The inventory has no sizes. The size of a function is in the `procedure.body` of its `analyze_function` dossier, and [section 4.6](#s-analyze-function-and-pseudocode) reads the rest of that record.

```listing
title: the procedure block of the _grade dossier
source: capture/out/06-function-grade.json
lang: json
note: Cut from normalized_result. The pseudocode and every later facet are cut.
---
"procedure": {
  "address": "0x100000518",
  "name": "_grade",
  "classification": {
    "external": false,
    "thunk": false,
    "thunk_target": null,
    "provenance": "ghidra-function-manager"
  },
  "body": {
    "available": true,
    "provenance": "ghidra-function-body-address-set",
    "ranges": [
      {
        "start": "0x100000518",
        "end": "0x100000553"
      }
    ],
    "total_bytes": 60,
    "span_bytes": 60,
    "non_contiguous": false,
    "contains_entry": true
  },
  "signature": "undefined _grade()",
  "locals": []
},
```

**Function body:** the set of addresses Ghidra assigns to one function, reported as ranges with inclusive ends. `_grade` owns `0x100000518` to `0x100000553`, 60 bytes, and `_total` starts at `0x100000554`. The profile names this contract `function_body_evidence: "complete-inclusive-ranges-v1"`. Three other fields in the record use exclusive ends: the segments of `binary_overview`, the `basic_blocks` of a dossier, and the memory blocks of `list_segments`. Read the field name before you add one.

The five internal bodies add up: 24 + 60 + 52 + 72 + 368 is 576, the size of `__text`. No byte of the code section belongs to two functions, and no byte belongs to none. `span_bytes` equals `total_bytes` and `non_contiguous` is false for all five. When they differ, the function has a gap, and the bytes in the gap are not owned by that function. The research notes a 16-bit case where a body of 503 bytes spans 517.

## Selecting a procedure

Every function operation takes a `procedure` string. The rule for reading it:

```rule
label: names before addresses
source: native §Exact CLI selectors
---
When a selector matches an exact symbol name in the database, the name wins over a bare hexadecimal address.
```

A string with a `0x` prefix or an address-space prefix is an address. Any other string is tried as a symbol name first. A name that matches more than one function fails with `ambiguous` and the list of entry addresses. A name that matches nothing fails with `not_found`, which [section 4.6](#s-analyze-function-and-pseudocode) shows as the MCP error `invalid_request`.

```takeaways
- Count procedures as internal, thunk, and external before you compare two builds.
- Read the `__stubs` size and divide by the thunk count to find the stub size.
- Add the `total_bytes` of the internal bodies and compare with the code section size.
- Treat `end` in `body.ranges` as inclusive and every other `end` as exclusive.
```

Sources: capture/out/10-mcp-05-list-procedures.json, capture/out/06-function-grade.json, capture/out/10-mcp-09-analyze-function-percent-change-O1.json, capture/out/10-mcp-11-analyze-function-total-O1.json, capture/out/10-mcp-12-analyze-function-grade-label-O1.json, capture/out/04-inspect-macho.json; rea 6.7.0 at 27dc42d: bridge/ghidra/ReaGhidraBridge.java, src/ghidra/GhidraProviderCapabilities.ts; rea docs/native-investigation.md
