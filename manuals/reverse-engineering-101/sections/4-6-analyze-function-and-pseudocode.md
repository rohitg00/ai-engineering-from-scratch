# analyze_function and pseudocode

> analyze_function returns one dossier with sixteen facets, and its pseudocode is a decompiler's reading that you check against the assembly and the bytes in the same record.

You asked for `percent_change` and got a function that returns `ulong` and tests `iVar2 != 0` twice. The source returns `int` and tests once. The instructions in the same record are right, and the text around them is a reading of those instructions. Learning to tell the two apart is what this section is for.

When you finish this section, you can read the sixteen facets of a dossier. You can mark which lines of pseudocode follow from an instruction and which are a guess. You can also read the error for a name that does not exist.

## The dossier

`rea function` is the CLI name of `analyze_function`. The CLI run on `_grade` and the MCP call in the same session produced the same `evidence_id`, `ev_41e8ca1c` and 56 more digits. The id is a hash of the record's semantic content, and the file path and the display name are left out of it. [Section 5.1](#s-the-evidence-record) reads every field of the record. This section reads its `normalized_result`, which has sixteen facets.

```listing
title: the pseudocode, the blocks, and the signature facts of _grade
source: capture/out/06-function-grade.json
lang: json
note: Cut from normalized_result. The procedure, assembly, reference, and value-flow facets are cut, and so are the parameter entries of native_api.
---
"pseudocode": "\nundefined4 _grade(int param_1)\n\n{\n  uint uVar1;\n  \n  uVar1 = param_1 / 10 - 6;\n  if (uVar1 < 5) {\n    return *(undefined4 *)(&DAT_1000007d0 + (ulong)uVar1 * 4);\n  }\n  return 0;\n}\n\n",
…
"basic_blocks": [
  {
    "start": "0x100000518",
    "end": "0x10000053c",
    "successors": [
      "0x10000053c",
      "0x10000054c"
    ]
  },
  …
],
"native_api": {
  "available": true,
  "provenance": "ghidra-high-function",
  "signature_source": "default",
  "calling_convention": "__cdecl",
  …
      "data_type": "undefined4",
      "size_bytes": 4,
      "storage": "w0:4",
      "confidence": "low",
  …
  "jump_tables": [],
  "pseudocode": {
    "classification": "decompiler-generated-non-source",
    "compilable": false
  },
  …
  "limitations": [
    "Types and calling conventions are Ghidra decompiler observations, not source declarations.",
    "Register variables, compiler-generated blocks, and pointer arithmetic remain decompiler artifacts.",
    "Pseudocode is neither original source nor guaranteed to compile."
  ]
},
```

The pseudocode is one JSON string. Decoded, it reads:

```c
undefined4 _grade(int param_1)

{
  uint uVar1;
  
  uVar1 = param_1 / 10 - 6;
  if (uVar1 < 5) {
    return *(undefined4 *)(&DAT_1000007d0 + (ulong)uVar1 * 4);
  }
  return 0;
}
```

| Facet | For `_grade` | What it holds |
|---|---|---|
| `procedure` | entry `0x100000518`, body 60 bytes | the identity and body of [section 4.2](#s-list-procedures-and-function-bodies) |
| `pseudocode` | one string | the decompiler text |
| `assembly` | 15 lines | the Listing text of [section 4.3](#s-procedure-assembly) |
| `comments` | empty | database comments at the entry |
| `callers`, `callees` | empty, empty | resolved functions only |
| `incoming_references`, `outgoing_references` | 1, 2 | typed edges, as in [section 4.4](#s-xrefs-and-the-jump-table) |
| `unresolved_calls` | empty | call sites whose destination has no known procedure |
| `referenced_strings`, `referenced_names` | empty, 2 | `LAB_10000054c`, `DAT_1000007d0` |
| `basic_blocks` | 3 | starts, exclusive ends, successors |
| `native_api` | `__cdecl`, `signature_source` default | types, storage, confidence, `jump_tables` |
| `native_value_flow` | 14 operations, 12 def-use edges | high p-code, `truncated: false` |
| `facet_availability` | eight facets, all `available: true` | whether each facet was observed |
| `limitations` | 4 | the facet's own limits |

**Dossier:** rea's name for the composed record of one function. The bridge builds it from five Ghidra sources: the FunctionManager, the Listing, the ReferenceManager, the BasicBlockModel, and the decompiler. The record-level limitation names all five. The record carries ten limitations, the result four more, `native_api` three, and `native_value_flow` five. Read them once. They say in rea's words what this section shows with examples.

The signature facts are the first thing to read. `signature_source` is `default`, which means no analyzer or user set the prototype, and every parameter and the return value carry `confidence: "low"`. The bridge gives `medium` only when the source is `analysis`. `native_api.pseudocode.compilable` is `false`, and the third `native_api` limitation is written into the Java source itself.

```figure
id: fig-4-8
kind: structure
title: the sixteen facets of the _grade dossier
claim: One record holds the identity, the text, the edges, the blocks, the signature facts, and the value flow of one function, each with its own limits.
caption: Read top to bottom. The left column is the facet name, the middle column is its value for _grade, the right column says what the facet holds. From capture/out/06-function-grade.json.
```

## procedure_pseudo_code: the text alone

`rea decompile` is the CLI name of `procedure_pseudo_code`. It returns the text and nothing else.

```listing
title: the pseudocode of _total
source: capture/out/07-decompile-total.json
lang: json
note: Cut to the operation, the start of the text, and the two decompiler limitations of the seven.
---
"operation": "procedure_pseudo_code",
"parameters": {
  "procedure": "_total"
},
"raw_result": {
  "value": "\nint _total(int *param_1,uint param_2)\n\n{\n  int iVar1;\n  ulong uVar2;\n  \n  if (0 < (int)param_2) {\n…
  "limitations": []
},
…
"limitations": [
  …
  "Pseudocode is Ghidra decompiler output, not original source and not text-equivalent to Hopper output.",
  "External functions and functions without an analyzable body return null; other decompiler failures remain explicit.",
  …
],
```

```c
int _total(int *param_1,uint param_2)

{
  int iVar1;
  ulong uVar2;
  
  if (0 < (int)param_2) {
    iVar1 = 0;
    uVar2 = (ulong)param_2;
    do {
      iVar1 = *param_1 + iVar1;
      uVar2 = uVar2 - 1;
      param_1 = param_1 + 1;
    } while (uVar2 != 0);
    return iVar1;
  }
  return 0;
}
```

The bridge opens one `DecompInterface` per program with C output, the syntax tree, and jump loads on, and no instruction limit. Each call is `decompileFunction(function, 0, monitor)`, with no timeout, and an external or bodyless function returns `null`. The text is the `getC()` output of the result.

`_total` reads well. The `do` loop with `uVar2 - 1` is the rotated loop that `subs x9, x9, #0x1` and `b.ne` make in the assembly. The pointer type `int *param_1` follows from the load `ldr w10, [x0], #0x4`. The one open question is `uint param_2`. The source says `int count`. The instructions compare `w1` as signed once and then count it down in `x9`, so both types fit, and Ghidra picked one.

## Where the text is incomplete or wrong

**Decompiler artifact:** a line of pseudocode that the decompiler needed to express the machine code and that no source line produced. The `native_api` limitations name three kinds: register variables, compiler-generated blocks, and pointer arithmetic. Three records in the captures show three kinds of gap between the text and the instructions.

```listing
title: _percent_change, text and instructions
source: capture/out/10-mcp-09-analyze-function-percent-change-O1.json
lang: json
note: The pseudocode string and the complete assembly array of the dossier.
---
"pseudocode": "\nulong _percent_change(ulong param_1,int param_2)\n\n{\n  uint uVar1;\n  int iVar2;\n  \n  iVar2 = (int)param_1;\n  if (iVar2 != 0) {\n    uVar1 = 0;\n    if (iVar2 != 0) {\n      uVar1 = ((param_2 - iVar2) * 100) / iVar2;\n    }\n    param_1 = (ulong)uVar1;\n  }\n  return param_1;\n}\n\n",
"assembly": [
  "0x100000500: cbz w0, 0x100000514",
  "0x100000504: sub w8, w1, w0",
  "0x100000508: mov w9, #0x64",
  "0x10000050c: mul w8, w8, w9",
  "0x100000510: sdiv w0, w8, w0",
  "0x100000514: ret"
],
```

Six instructions. `cbz w0, 0x100000514` jumps to the `ret` when `before` is zero, and on that path `w0` is zero and the function returns it. The other path computes `(w1 - w0) * 100` and divides with `sdiv w0, w8, w0`. Both paths return 32 bits in `w0`.

The pseudocode says the function returns `ulong`, eight bytes, and returns `param_1`, the whole of `x0`. The ABI and the source say four bytes. Nothing in the text marks the difference. The record does: `return_type.data_type` is `ulong`, `confidence` is `low`, and `signature_source` is `default`. The second `if (iVar2 != 0)` repeats a test that one instruction made once. It changes no value, and it is not in the instructions.

```figure
id: fig-4-9
kind: comparison
title: percent_change as written and as decompiled
claim: Four source lines became fourteen lines of pseudocode, and the three marked lines describe only the registers.
caption: Read the source first, then the pseudocode. The rose marks name the return width, the repeated test, and the return of the whole register. From capture/fixtures/ledger.c and capture/out/10-mcp-09-analyze-function-percent-change-O1.json.
```

`_grade` shows the second kind of gap. The decompiled text keeps the table as `*(undefined4 *)(&DAT_1000007d0 + (ulong)uVar1 * 4)`. The address is right, the element size is right, and the five values are not there. [Section 3.3](#s-address-to-file-offset) turns `0x1000007d0` into file offset 2000, and the 20 bytes there are `1, 2, 3, 4, 4`. The return type is `undefined4`, four bytes of unknown meaning. The text is incomplete, and you complete it from the bytes.

The x86-64 build of `grade` shows the third kind. Its pseudocode has the line `uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);` for the default return value.

```listing
title: grade on x86-64, the default value as an expression
source: capture/out/07-decompile-grade-x86_64-O1.json
lang: json
note: The start of the pseudocode string, cut after the line that writes the default value.
---
"value": "\nuint grade(int param_1)\n\n{\n  uint uVar1;\n  uint uVar2;\n  \n  uVar2 = param_1 / 10 - 6;\n  uVar1 = -(param_1 >> 0x1f) ^ (uint)((ulong)((long)param_1 * 0x66666667) >> 0x3f);\n…
```

The instruction behind that line is `XOR EAX, EAX` at `0x10002a` in [section 4.3](#s-procedure-assembly). The register is zero. Ghidra wrote it as the sign of `param_1` exclusive-or the sign bit of the product. Those are two spellings of the same bit, and the decompiler did not cancel them. The value is 0 for every `int`, so the text is not false. A reader who trusts the text believes the default depends on the score, which is false.

[Lesson 34](phases/13-tools-and-protocols/34-lifting-to-pseudocode) compiles this text and tests it against the source over a grid. It then puts its own lifter output beside Ghidra's and accounts for every difference in `percent_change`, `grade`, and `total`.

The rule from the three cases is short. The assembly facet is observed. The pseudocode is observed text about a derived reading. Check a type against the storage, a constant against the bytes, and a branch against the blocks before you repeat what the text says.

## A name that does not exist

```listing
title: analyze_function for a procedure that is not there
source: capture/out/10-mcp-13-analyze-function-missing.json
lang: json
note: The request arguments, the error flag, and the decoded error. The text content is the same JSON on one line. The `diagnostics` object in `details` is cut. It holds the run id, the temporary paths, the process id, the Ghidra output, and `remote_code: "not_found"`.
---
"name": "analyze_function",
"arguments": {
  "procedure": "_nothing"
}
…
"isError": true
…
"decoded_text": {
  "error": {
    "code": "invalid_request",
    "category": "invalid_input",
    "message": "Analysis input is invalid. Check the arguments and try again.",
    "retryable": true,
    "remediation": {
      "action": "Correct the listed arguments and retry."
    },
    "details": {
      "operation": "analyze_function",
      "issues": [
        {
          "path": [],
          "reason": "invalid_value",
          "message": "Unknown Ghidra procedure name or address: _nothing"
        }
      ],
      …
    }
  }
}
```

The bridge tried `_nothing` as a symbol name, then as an address, and failed with `not_found`. The `diagnostics` object in the error shows the remote code `not_found` that the bridge sent. The client maps the remote codes `invalid_request`, `not_found`, and `ambiguous` to `AnalysisInputError`. That error projects to the code `invalid_request`. An error reaches the MCP client as text with `isError: true` and no result. The server log shows where the time went.

```listing
title: the failed call in the server log
source: capture/out/10-mcp-server.log
lang: jsonl
note: Lines 10 and 11. The first is the bridge layer, the second is the server layer. The time and durationMs values change on every run and are cut.
---
{"level":40,"time":…,"application":"rea","mode":"mcp","layer":"ghidra-bridge","method":"analyze_function","status":"error","msg":"Ghidra bridge request completed"}
{"level":40,"time":…,"application":"rea","mode":"mcp","layer":"server","tool":"analyze_function","durationMs":…,"status":"error","msg":"MCP tool execution completed"}
```

The lookup was a round trip on the socket to Ghidra, a couple of milliseconds in all. `retryable` is `true`: correct the name from [section 4.2](#s-list-procedures-and-function-bodies) and call again. The session stays open and the Ghidra project stays imported.

## What to do with a dossier

Read the sixteen facets in this order. Start with `procedure` for the body and `assembly` for what the processor does. Then read `basic_blocks` for the shape and the references for the edges, and `pseudocode` last. [Section 5.5](#s-compare-and-compare-functions) compares two dossiers of the same function from two builds. [Section 7.2](#s-a-proof-harness-outside-rea) shows the test that decides whether a rebuild from this text is equal to the original.

To see where each line of pseudocode comes from, run the [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler) machine. It decompiles `percent_change` from the x86-64 fixture object in nine stations, from the header to the pseudocode. The instructions, IR and pseudocode on the page are the ones that the course lifter in lesson 34 prints. Switch the build to `-O0` to see stack slots become locals, and switch the symbols off to see the name become an unknown.

```takeaways
- Read `signature_source` and the parameter `confidence` before you trust a type in the pseudocode.
- Check every constant and table address in the text against the assembly and the bytes.
- Treat `compilable: false` as a fact about the pseudocode text, and do not report it as a defect.
- Expect `invalid_request` with `retryable: true` for an unknown name, then fix the name.
```

Sources: capture/out/06-function-grade.json, capture/out/10-mcp-10-analyze-function-grade-O1.json, capture/out/07-decompile-total.json, capture/out/07-decompile-grade-x86_64-O1.json, capture/out/10-mcp-09-analyze-function-percent-change-O1.json, capture/out/10-mcp-11-analyze-function-total-O1.json, capture/out/10-mcp-12-analyze-function-grade-label-O1.json, capture/out/10-mcp-13-analyze-function-missing.json, capture/out/10-mcp-server.log, capture/fixtures/ledger.c, capture/fixtures/ledger-arm64-O1; rea 6.7.0 at 27dc42d: src/cliCommandNames.ts, src/domain/evidence.ts, src/ghidra/GhidraProviderCapabilities.ts, src/ghidra/GhidraProviderClient.ts, src/domain/analysisErrorProjection.ts, src/server/toolResult.ts, bridge/ghidra/ReaGhidraBridge.java; the Inside a Decompiler machine: scripts/decompiler-machine/fixture.mjs, scripts/decompiler-machine/model.mjs
