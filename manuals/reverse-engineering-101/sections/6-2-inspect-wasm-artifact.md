# inspect-wasm-artifact and the WABT provider

> rea 6.7.0 runs three WABT 1.0.42 programs on a private copy of the module and returns one observed Evidence record with sections, a typed interface, and decoded WAT.

You wrote `capture/fixtures/wasm/ledger.wat` by hand, with the same four functions as `ledger.c`, and assembled it to `ledger.wasm` with `wat2wasm`. You ask rea 6.7.0 to inspect the module, on the CLI and over MCP, and both entry points return the same Evidence record. When you finish this section, you can set up the WABT provider and read the record. You can also say what the record does not prove.

## Setup

WebAssembly is not a native target. `open_binary` on a module returns `target_unavailable` with the constraint `wasm_requires_static_inspection`, and the error names the `inspect_wasm_artifact` call to make. The tool needs three WABT programs that you install yourself. Set `REA_WABT_BIN_DIRECTORY` to the absolute directory that holds `wasm-validate`, `wasm-objdump`, and `wasm2wat`. The tool is available only when that variable is absolute, and `binary_session` reports that availability.

```listing
title: the WABT block of the version record
source: capture/out/00-versions.txt
lang: text
note: The fourth program, wat2wasm, built the fixture. rea does not run it.
---
REA_WABT_BIN_DIRECTORY=/opt/homebrew/bin
$ /opt/homebrew/bin/wasm-validate --version
1.0.42
[exit 0]
$ /opt/homebrew/bin/wasm-objdump --version
1.0.42
[exit 0]
$ /opt/homebrew/bin/wasm2wat --version
1.0.42
[exit 0]
```

## The command and the record

The CLI command is `rea inspect-wasm-artifact PATH`. In the capture it exited 0 after about two seconds and printed one Evidence record.

```listing
title: the CLI call
source: capture/out/00-commands.txt
lang: text
note: The time is cut, because it changes with every recording.
---
$ rea inspect-wasm-artifact fixtures/wasm/ledger.wasm --format json
[exit 0] (… s) -> 16-inspect-wasm-artifact.json
```

```listing
title: the head of the inspect_wasm_artifact record
source: capture/out/16-inspect-wasm-artifact.json
lang: json
note: The ids and digests are cut to eight characters. The normalized_result follows.
---
{
  "evidence_id": "ev_3a09e4b0…",
  "subject": {
    "name": "ledger.wasm",
    "digest": {
      "sha256": "699f6ff7…"
    },
    "local_path": "$CAPTURE/fixtures/wasm/ledger.wasm",
    "format": "file",
    "architecture": null
  },
  "provider": {
    "id": "wabt-artifact",
    "name": "REA WABT artifact adapter",
    "version": "wabt@1.0.42"
  },
  "analysis_profile": null,
  "predicate_type": "rea.analysis",
  "operation": "inspect_wasm_artifact",
  "parameters": {
    "path": "$CAPTURE/fixtures/wasm/ledger.wasm",
    "glue_paths": [],
    "candidate_paths": []
  },
```

The subject format is `file` and the architecture is `null`, because no native format applies. The provider version names the WABT release. The record is `observed`, with `shipped-artifact` as its authority, because the bytes on disk are the source. The two empty arrays are optional inputs. `glue_paths` names JavaScript files whose `.wasm` string literals rea links to candidate modules, and `candidate_paths` names those modules.

## What rea ran

rea copies the module into a private workspace as a read-only `module.wasm`. It then runs three programs from the directory that `REA_WABT_BIN_DIRECTORY` names. Each program must print exactly `1.0.42` as its version. If one does not, rea does not run it. The `tool_profile` records what ran.

```listing
title: the tool profile, first command
source: capture/out/16-inspect-wasm-artifact.json
lang: json
note: The source commit, the digests, and the wasm-objdump and wasm2wat entries are cut. They have the arguments -h -x and --enable-all.
---
"tool_profile": {
  "source": "https://github.com/WebAssembly/wabt",
  "release": "1.0.42",
  …
  "commands": [
    {
      "tool": "wasm-validate",
      "path": "/opt/homebrew/Cellar/wabt/1.0.42_1/bin/wasm-validate",
      "sha256": "99a52c78…",
      "version_banner": "1.0.42\n",
      "arguments": [
        "--enable-all",
        "module.wasm"
      ]
    },
    …
  ],
  "timeout_ms": 30000,
  "output_budget_bytes": 33554432
},
```

The limits are 8 MiB of input, 30 s for each program, and 32 MiB of output.

rea checks the digest of the copy before and after each program. It also checks the digest of each program again after the command. A digest identifies the bytes of a program. It does not prove who published the program.

## Sections

The `sections` array holds the seven sections with their byte ranges and the count of entries in each.

```listing
title: the seven sections of ledger.wasm
source: capture/out/16-inspect-wasm-artifact.json
lang: json
note: The Function, Memory, Export, and Code entries are cut. They start at 41, 48, 53, and 113.
---
"artifact": {
  "path": "$CAPTURE/fixtures/wasm/ledger.wasm",
  "sha256": "699f6ff7…",
  "bytes": 290
},
"validation": "valid",
"sections": [
  {
    "kind": "Type",
    "start": 10,
    "end": 26,
    "bytes": 16,
    "description": "count: 3"
  },
  {
    "kind": "Import",
    "start": 28,
    "end": 39,
    "bytes": 11,
    "description": "count: 1"
  },
  …
  {
    "kind": "Data",
    "start": 273,
    "end": 290,
    "bytes": 17,
    "description": "count: 1"
  }
],
```

The file is 290 bytes. Eight bytes of magic and version come first. Each section starts with a one-byte id and a length, and the payload follows. The Type payload therefore starts at offset `0x0a`, which is 10. The data segment holds the five grade labels at address 1024, two bytes apart.

## The typed interface

The record holds the imports and exports two times. The `imports` and `exports` arrays keep the exact WAT forms. The `interface` entries add the direction, the index, and a resolved signature for each one.

```listing
title: two interface entries
source: capture/out/16-inspect-wasm-artifact.json
lang: json
note: The memory export and three function exports are cut.
---
"interface": {
  "state": "complete",
  "entries": [
    {
      "direction": "import",
      "module": "env",
      "name": "log",
      "kind": "func",
      "index": 0,
      "signature": {
        "kind": "func",
        "params": [
          "i32"
        ],
        "results": []
      },
      "wat_form": "(import \"env\" \"log\" (func (;0;) (type 0)))",
      "issue": null
    },
    …
    {
      "direction": "export",
      "module": null,
      "name": "percent_change",
      "kind": "func",
      "index": 1,
      "signature": {
        "kind": "func",
        "params": [
          "i32",
          "i32"
        ],
        "results": [
          "i32"
        ]
      },
      "wat_form": "(export \"percent_change\" (func 1))",
      "issue": null
    },
    …
```

`percent_change` takes two `i32` values and returns one, the same shape as the C function. The import `env.log` is function 0, so the four functions of the module are 1 to 4. A second tool, `compare_wasm_interfaces`, reads two of these records and reports each import and export as added, removed, changed, or unchanged. It reads no files and runs no WABT program.

## The WAT

The `wat` field holds the text that `wasm2wat` printed, its SHA-256 `37eab56a…`, and the representation `decoded-wat`. The body of `percent_change` is the C function in stack form. It tests the first parameter for zero. It then pushes 0, or it computes the subtraction, the multiplication by 100, and the signed division.

```listing
title: percent_change in the text form
source: capture/out/16-inspect-wasm-artifact.json
lang: text
note: Cut from normalized_result.wat.text. The other three function bodies are cut.
---
  (func (;1;) (type 1) (param i32 i32) (result i32)
    local.get 0
    i32.eqz
    if (result i32)  ;; label = @1
      i32.const 0
    else
      local.get 1
      local.get 0
      i32.sub
      i32.const 100
      i32.mul
      local.get 0
      i32.div_s
    end)
```

Two things in the text form echo Part 4. The `grade` body is a `br_table` with twelve targets, the WebAssembly form of the jump table that clang built for the same `switch` in `ledger-x86_64-O1.o`. The `grade_label` body calls function 2, then function 0, which is the imported `env.log`. It then adds twice the grade to 1024, the address of the data segment, two bytes per label. You can read that from the WAT without a decompiler, because the module has no stripped symbols and no relocations.

## Limitations

The record has everything [Part 5](#s-the-evidence-record) described: an `evidence_id`, a `confidence`, an `authority`, and five `limitations`. The record does not decompile the functions. It gives the WAT text, and the reading of that text is your work.

```listing
title: the five limitations of the record
source: capture/out/16-inspect-wasm-artifact.json
lang: json
note: Nothing is cut.
---
"limitations": [
  "WAT is a decoded representation, not original source or proof of runtime behavior. Custom annotations may retain payloads, but WAT does not establish original binary layout or round-trip byte identity. Original bytes and objdump output remain authoritative.",
  "Imports and exports retain exact top-level WABT WAT forms. Names remain escaped producer text; unescaped objdump display names are not parsed as unambiguous identifiers.",
  "JavaScript references are AST-observed static literals only. Candidate matches are associations, not proven data flow, URL-to-file identity or runtime loading. Computed references and aliases are not resolved.",
  "No target execution or implicit fetch. WABT tools are trusted caller-supplied executables; SHA-256 identifies their bytes, not publisher authenticity. No OS memory sandbox is claimed.",
  "Each subprocess has a 30-second deadline and 32 MiB combined output budget. Oversized output fails instead of producing truncated success."
],
```

The first limitation says that the WAT is a decoded representation. The WAT does not show the original source, and it does not prove runtime behaviour. The record is `observed` for the bytes and the tool output only. The fields `runtime_execution` and `network_fetch` both read `not-performed`, because rea never runs the module.

## Over MCP

Over MCP the tool is `inspect_wasm_artifact` with the same `path`. Step 24 of the session returned `ok` after 404 ms. The reply is a tool result. Its `structuredContent` is the same Evidence record, with the same id `ev_3a09e4b0…`. Its `_meta` carries the untrusted-content marker of [Section 8.1](#s-the-rea-mcp-server).

```listing
title: the head of the MCP result
source: capture/out/10-mcp-24-inspect-wasm-artifact.json
lang: json
note: The text copy and the rest of the record are cut.
---
"result": {
  "_meta": {
    "provenance": {
      "untrusted_content": true,
      "source": "analysis_target"
    }
  },
  …
  "structuredContent": {
    "evidence_id": "ev_3a09e4b0…",
```

The session retains the record, so `export_evidence_bundle` writes it to a bundle with the other records. For a large module, pass `detail: "summary"` on the first call. rea then keeps the complete record. It returns counts, the validation result, and the WAT identity, without the WAT text. You read pages of the full record with `inspect_analysis_view`.

## A cross-check with wabt

The capture also ran `wasm-objdump -h -x` on the module without rea, in `16-wabt.txt`. The section table there has the same seven rows as the `headers` text in the record. Type starts at `0x0000000a`, and Data ends at `0x00000122`, which is 290. The offsets agree with `sections`. [Figure](#fig-6-2) draws the path from the two entry points to the one record.

```figure
id: fig-6-2
kind: flow
title: inspect_wasm_artifact on ledger.wasm
claim: rea copies the module, runs three WABT programs with checked versions, and returns one observed record that the CLI and MCP share.
caption: Read top to bottom. Solid arrows are calls, and dashed arrows are the program outputs that rea parses. Grey boxes are the WABT programs outside rea. From capture/out/16-inspect-wasm-artifact.json and 10-mcp-24-inspect-wasm-artifact.json.
```

```takeaways
- Set `REA_WABT_BIN_DIRECTORY` to an absolute directory with WABT 1.0.42 before you call the tool.
- Run `rea inspect-wasm-artifact PATH --format json`, or call `inspect_wasm_artifact` over MCP.
- Read `sections`, then `interface`, then one function body in `wat.text`.
- Read the five limitations before you report anything from the WAT.
```

Sources: src/cliCommandNames.ts, src/contracts/wasm/wasmToolContracts.ts, src/wasm/WabtArtifactProvider.ts, src/wasm/WabtRelease.ts, src/server/createServer.ts, src/application/BinaryTargetResolver.ts at rea-agents-6.7.0 (27dc42d); rea docs/wasm-artifacts.md (Offline WebAssembly artifacts, Compare core-module interfaces); capture/fixtures/wasm/ledger.wat, capture/fixtures/ledger.c; capture/out/16-inspect-wasm-artifact.json, 10-mcp-24-inspect-wasm-artifact.json, 10-mcp-session.txt, 16-wabt.txt, 00-commands.txt, 00-fixtures.txt, 00-versions.txt
