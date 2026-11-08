# xrefs and the jump table

> xrefs lists the addresses that refer to one address, and the single reference to _grade shows what the optimizer did to the switch and its callers.

`main` calls `grade_label`, and `grade_label` calls `grade`. You ask `xrefs` who refers to `_grade` at `0x100000518` and get one address, `0x10000811a`, which is not in any function. The answer is right, and it tells you two things about the build.

When you finish this section, you can read an `xrefs` result and find the kind of each reference in the dossier. You can also tell a jump table from a value table in two builds of `grade`.

## The call

```listing
title: xrefs for the entry of _grade
source: capture/out/10-mcp-07-xrefs-grade.json
lang: json
note: The request arguments, the result, and two of the seven limitations.
---
"name": "xrefs",
"arguments": {
  "address": "0x100000518"
}
…
"normalized_result": [
  "0x10000811a"
],
…
"limitations": [
  …
  "The direct address list projects exact Ghidra references to one address but does not expose their kinds; procedure_references and analyze_function preserve available kind metadata.",
  "Synthetic Ghidra entry-point references without actionable memory sources are omitted.",
  …
],
```

The bridge asks Ghidra's `ReferenceManager` for every reference to the address. It skips the synthetic entry-point references, collects the distinct source addresses, and sorts them. The result is addresses only. The `incoming_references` facet of the dossier keeps the kind of each reference, call, jump, or data.

## What is at 0x10000811a

The address is in `__LINKEDIT`, which starts at `0x100008000` and maps file offset 32768. The difference `0x11a` is 282, so the byte is at file offset 33050. [Section 3.2](#s-inspect-binary-layout-and-the-load-image) lists `LC_FUNCTION_STARTS` at offset 33048 with 8 bytes. The reference points into the function starts table.

**Function starts:** a table of unsigned LEB128 deltas, one per function, that dyld and debuggers use to find function entries in a stripped image. The eight bytes in the fixture are `80 0a 18 3c 34 48 00 00`. The first delta is `0x500`, which gives `0x100000500`, `_percent_change`. The second, at offset 33050, is `0x18`, which gives `0x100000518`, `_grade`. Then `0x3c` gives `_total`, `0x34` gives `_grade_label`, and `0x48` gives `entry`. Ghidra's Mach-O loader marks each entry as a data reference to the function it names, and the dossier shows exactly that.

```listing
title: the one incoming reference of _grade
source: capture/out/06-function-grade.json
lang: json
note: Cut from incoming_references. The target_procedure block repeats the procedure block of section 4.2 and is cut.
---
"incoming_references": [
  {
    "source_address": "0x10000811a",
    "target_address": "0x100000518",
    "source_procedure": null,
    …
    "kind": {
      "available": true,
      "provenance": "ghidra-reference-manager",
      "type": "DATA",
      "flow": false,
      "call": false,
      "jump": false,
      "data": true,
      …
    }
  }
],
```

`source_procedure` is `null` because no function owns the table. The kind is `DATA`, and `call` is false. So nothing in the code calls `_grade`. Compare `_grade_label`, whose dossier lists two incoming references. One is an `UNCONDITIONAL_CALL` from `0x1000006ec` inside `entry`. The other is a `DATA` reference from `0x10000811c`, the fourth entry of the same table.

```listing
title: the two incoming references of _grade_label
source: capture/out/10-mcp-12-analyze-function-grade-label-O1.json
lang: json
note: Cut from incoming_references to the addresses and the reference types.
---
"source_address": "0x1000006ec",
"target_address": "0x100000588",
…
"type": "UNCONDITIONAL_CALL",
…
"source_address": "0x10000811c",
"target_address": "0x100000588",
"source_procedure": null,
…
"type": "DATA",
```

The call that the source makes, `grade_label` to `grade`, is gone. At `-O1` clang inlined `grade` into `grade_label`. The assembly of `_grade_label` repeats the whole multiply and compare sequence of [section 4.3](#s-procedure-assembly) at `0x100000588` to `0x1000005a4`. The dossier of `_grade` says the same from the other side: `callers` is an empty list, and `relationship_coverage.status` is `complete`. Ghidra returned every resolved call reference, and none of them targets `_grade`. `_grade` still exists as a function because it is exported, and the only thing that refers to it is a table the linker wrote.

```figure
id: fig-4-6
kind: tree
title: every reference to the four ledger functions
claim: entry calls three of the four functions, the function starts table refers to all four, and nothing calls _grade because its body was inlined.
caption: Read across each row. Green boxes on the left are call sites inside entry, violet boxes are the functions, green boxes on the right are entries of LC_FUNCTION_STARTS. From the four analyze_function dossiers and capture/fixtures/ledger-arm64-O1.
```

## The jump table that is not there

Every dossier in the captures has `"jump_tables": []` in its `native_api` facet, and the profile names the contract `jump_table_evidence: "typed-case-default-blocks-v1"`. Ghidra would fill the field if it found one. It found none, because at `-O1` neither compiler emitted a jump table for the switch in `grade`. Both turned the five cases into a table of the five return values and one bounds check.

| Build | Transfer | Table | Blocks in `grade` |
|---|---|---|---|
| `ledger-x86_64-O0.o`, lesson 33 fixture | `jmpq *%rax` | `.rodata+0x0`, five `R_X86_64_PC32` relocations, targets `0x91`, `0x88`, `0x7f`, `0x76`, `0x76` | 8 with the table, 3 without |
| `ledger-x86_64-O1.o`, this capture | none, one `JA` | `DAT_001000b4`, `.rodata+0x14`, values `1, 2, 3, 4, 4` | 3 |
| `ledger-arm64-O1`, this capture | none, one `b.hi` | `0x1000007d0` in `__TEXT,__const`, values `1, 2, 3, 4, 4` | 3 |

**Jump table:** a table of code addresses that an indirect jump indexes, so one instruction reaches one of several blocks. **Value table:** a table of data that a load indexes, so one instruction returns one of several values. The first changes the control-flow graph. The second changes one load. At `-O0` the x86-64 object has the first, and in the object file its five entries are zero bytes with five relocations in `.rela.rodata`. At `-O1` both builds have the second.

The `outgoing_references` of `_grade` name the two edges the dossier does see. One is a `CONDITIONAL_JUMP` from `0x100000538` to `0x10000054c`. The other is a `DATA` read from `0x100000544` to `0x1000007d0`. The `referenced_names` facet labels the targets `LAB_10000054c` and `DAT_1000007d0`. The decompiler in [section 4.6](#s-analyze-function-and-pseudocode) keeps the second as a byte address and never lists the five values.

```figure
id: fig-4-5
kind: comparison
title: a jump table at -O0 and a value table at -O1
claim: At -O0 an indirect jump through five relocated entries reaches five case blocks, and at -O1 one load from five values replaces all of them.
caption: Read each column top to bottom. The left column comes from the lesson 33 fixture ledger-x86_64-O0.o, the right from the arm64 dossier. The green boxes are data in the file, the violet boxes are what Ghidra saw. From phases/13-tools-and-protocols/33-disassembly-and-control-flow/code/fixtures and capture/out/06-function-grade.json.
```

[Lesson 33](phases/13-tools-and-protocols/33-disassembly-and-control-flow) recovers the `-O0` table from the relocations with the rule `S + A - P`. It shows the control-flow graph with and without the table: 8 blocks and 11 edges against 3 blocks and one unresolved jump.

When Ghidra does not resolve a jump table, the case blocks are missing from `callers`, `callees`, and `basic_blocks`. The dossier limitation says that unresolved computed flows are not represented as edges. The `unresolved_calls` facet lists each call site whose destination has no known procedure. An unresolved indirect jump through a table is not a call, so it does not appear in that facet. An empty `jump_tables` list does not prove the function has no switch. Read the transfer instruction and the table bytes, as you did here.

```takeaways
- Resolve an `xrefs` address to its segment and load command before you call it a caller.
- Use `incoming_references` in the dossier to learn whether a reference is a call or data.
- Read `callers: []` on an exported function as a sign of inlining, then check the caller's body.
- Name what the bytes show: a jump table changes the graph, a value table changes a load.
```

Sources: capture/out/10-mcp-07-xrefs-grade.json, capture/out/06-function-grade.json, capture/out/10-mcp-12-analyze-function-grade-label-O1.json, capture/out/10-mcp-09-analyze-function-percent-change-O1.json, capture/out/10-mcp-11-analyze-function-total-O1.json, capture/out/06-function-grade-x86_64-O1.json, capture/out/04-inspect-macho.json, capture/fixtures/ledger-arm64-O1; phases/13-tools-and-protocols/33-disassembly-and-control-flow/code/fixtures/ledger-x86_64-O0.objdump.txt; rea 6.7.0 at 27dc42d: bridge/ghidra/ReaGhidraBridge.java, src/ghidra/GhidraProviderCapabilities.ts
