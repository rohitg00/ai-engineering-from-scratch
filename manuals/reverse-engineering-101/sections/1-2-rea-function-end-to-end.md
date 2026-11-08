# rea function, end to end

> One `rea function` call opens the file, binds Ghidra, imports a private copy, asks one question over a socket, and prints one Evidence record in about eight seconds.

You typed `rea function fixtures/ledger-arm64-O1 _percent_change --provider ghidra --format json`. About eight seconds later, 1881 lines of JSON arrived on stdout, and the exit status was 0. Somewhere in there is the answer to your question about `before == 0`, next to a decompiler artifact that the source never had.

When you finish this section, you can read every top-level field of that record and say which part of the system wrote it. You can also point at the one place where Ghidra's pseudocode and your C disagree.

## The command

```listing
title: the recorded command
source: capture/out/00-commands.txt
lang: text
note: The time is cut, because it changes with every recording and stays between 7 and 9 s, as [the kit notes](manuals/reverse-engineering-101/capture/README.md) record.
---
$ rea function fixtures/ledger-arm64-O1 _percent_change --provider ghidra --format json
[exit 0] (… s) -> 06-function-percent-change.json
```

`function` takes a path and a procedure, and it runs the MCP operation `analyze_function` with `{ procedure }` as its parameters. `--provider ghidra` names the engine, and `--format json` and `--filter-output` are read at the executable boundary before the command runs. Without `--format`, the terminal output is TOON, and exit `0` means that the operation finished. The result can still hold partial evidence, warnings, or open questions {{cli Output and exit status}}. [Figure](#fig-1-2) follows the call through the system.

```figure
id: fig-1-2
kind: sequence
title: one rea function run, step by step
claim: One command opens the file, binds Ghidra, launches a headless JVM on a private copy, asks one question on a socket, and returns one Evidence record.
caption: Read top to bottom, one numbered row per step. Rows 1 and 12 come from the command record, and the names and the digest from the function capture. The file copy name comes from the overview capture. The deadlines come from the source at the tag.
```

## From the command to the bridge

1. The session parses the Mach-O header, reads the architecture, and hashes the file. The record's `subject` carries the result: `mach-o`, `arm64`, and the SHA-256 that `00-fixtures.txt` lists for `ledger-arm64-O1`.
2. The registry selects `ghidra`, because the command asked for it, and records `selection_source: "request"`.
3. The provider builds the analysis profile, a list of versioned contract names such as `function_body_evidence: "complete-inclusive-ranges-v1"`, and hashes it. The digest `3fc72c9b…` in the record is this hash.
4. The client makes a private runtime root and allocates `bridge.sock`. It copies the file as `target-<sha256[0:12]>.bin` while hashing it again. Then it launches `java` with `ghidra.Ghidra ghidra.app.util.headless.AnalyzeHeadless`, `-import`, `-readOnly`, and `-deleteProject`. The copy is `target-01b5d08b08fb.bin`, and the overview record shows that name as its `document` ([the capture](manuals/reverse-engineering-101/capture/out/05-analyze-arm64-O1.json)). The startup deadline is 330,000 ms.
5. The client sends `ping`. It accepts the session only when `run_id`, the token, the profile digest, the target SHA-256, and `analysis_complete` all match.
6. The client writes one JSON line that asks for `analyze_function`. Ghidra runs the analysis and writes one JSON line back.
7. rea adds the operation's limitation sentences to the answer and stores the result as one Evidence record.
8. The client sends `shutdown` with a 10 s deadline, and Ghidra deletes the project.

## The record, field by field

```listing
title: the head of the record
source: capture/out/06-function-percent-change.json
lang: json
note: Cut after the provider. The analysis profile and the results follow in the next listings.
---
{
  "evidence_id": "ev_b492c85e…",
  "subject": {
    "name": "ledger-arm64-O1",
    "digest": {
      "sha256": "01b5d08b…"
    },
    "local_path": "$CAPTURE/fixtures/ledger-arm64-O1",
    "format": "mach-o",
    "architecture": "arm64"
  },
  "provider": {
    "id": "ghidra",
    "name": "Ghidra",
    "version": "12.1.4"
  },
…
```

`evidence_id` hashes the semantic content and leaves out `subject.name` and `subject.local_path`, so the same bytes under another path give the same id. `provider` names the engine and its version. The next field binds the answer to the engine's settings:

```listing
title: the analysis profile
source: capture/out/06-function-percent-change.json
lang: json
note: Cut to five of the 25 parameters and the digest.
---
  "analysis_profile": {
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
      "loader": "auto-from-header",
      …
    },
    "digest": "3fc72c9b…"
  },
  "predicate_type": "rea.analysis",
  "operation": "analyze_function",
  "parameters": {
    "procedure": "_percent_change"
  },
```

**Analysis profile:** the provider's committed settings, hashed over RFC 8785 canonical JSON. Change one contract version and the digest changes, which is how rea refuses an old snapshot ([section 5.3](#s-snapshots-and-the-answer-cache)). `predicate_type` is the default tag `rea.analysis`, and `operation` is the MCP name. `parameters` is the caller's input, and it is part of the identity.

`raw_result` holds the provider-native dossier under `value` with its own empty `limitations`, and `normalized_result` holds the same dossier as the canonical result. `confidence` is `observed` and `authority` is `shipped-artifact`, the defaults for a static read of the file on disk. `environment` is `null`, because nothing ran.

`limitations` has ten strings: four that every Ghidra operation carries, five for `analyze_function`, and one for macOS about the native decompiler ([the captures](manuals/reverse-engineering-101/capture/out)). `locations` and `evidence_links` are empty. `relationship_coverage` has the status `complete`, and its one diagnostic says that only resolved Ghidra call references are returned. [Figure](#fig-1-3) lays the 16 fields out.

```figure
id: fig-1-3
kind: structure
title: the 16 fields of one Evidence record
claim: Every field of the record is either identity, provenance, the answer, or a limit on the answer, and the id covers all of them except the display names.
caption: Read the field, its value in this record, and the note. From capture/out/06-function-percent-change.json, with the field list from src/domain/evidence.ts at the tag.
```

## Inside normalized_result

**Procedure:** the function identity. `_percent_change` is at `0x100000500`, its body is one range from `0x100000500` to `0x100000517` inclusive, 24 bytes, and `contains_entry` is true. The FunctionManager signature reads `undefined _percent_change()`, because Ghidra's symbol carries no types. The decompiler's view under `native_api` reads `ulong _percent_change(ulong param_1,int param_2)` with `confidence: "low"` on each parameter. Your source says `int percent_change(int before, int after)`. Both are observations, as the limitation says: "Types and calling conventions are Ghidra decompiler observations, not source declarations."

```listing
title: the six instructions
source: capture/out/06-function-percent-change.json
lang: json
note: Nothing is cut from the assembly array.
---
    "assembly": [
      "0x100000500: cbz w0, 0x100000514",
      "0x100000504: sub w8, w1, w0",
      "0x100000508: mov w9, #0x64",
      "0x10000050c: mul w8, w8, w9",
      "0x100000510: sdiv w0, w8, w0",
      "0x100000514: ret"
    ],
```

Six instructions of four bytes each make the 24 bytes. `cbz w0` is your `if (before == 0) return 0;`, with `before` in `w0`, and `mov w9, #0x64` is the 100. The pseudocode tells a longer story:

```listing
title: the pseudocode, with its newlines expanded
source: capture/out/06-function-percent-change.json
lang: text
note: The pseudocode field is one JSON string. This listing shows it line by line, and every line is a substring of that string.
---
ulong _percent_change(ulong param_1,int param_2)
{
  uint uVar1;
  int iVar2;
  iVar2 = (int)param_1;
  if (iVar2 != 0) {
    uVar1 = 0;
    if (iVar2 != 0) {
      uVar1 = ((param_2 - iVar2) * 100) / iVar2;
    }
    param_1 = (ulong)uVar1;
  }
  return param_1;
}
```

The outer `if` is your guard. The inner `if` is not in your source. `native_value_flow` shows where it comes from. The operations `0x100000510#7`, `#8`, `#9`, and `#10` are a `COPY` of the constant 0, an `INT_NOTEQUAL`, a `CBRANCH`, and an `INT_SDIV`. All four carry the address of the `sdiv` instruction. Ghidra's model of `sdiv` gives 0 when the divisor is 0, and the decompiler printed that model as a second check.

Both checks are correct, and one is redundant, and only the source tells you which. [Section 4.6](#s-analyze-function-and-pseudocode) and [the lifting lesson](phases/13-tools-and-protocols/34-lifting-to-pseudocode) go deeper.

**References:** the dossier lists two incoming references. One is an `UNCONDITIONAL_CALL` from `0x1000006a0` inside the function Ghidra names `entry` at `0x1000005d0`, 368 bytes long. The other is a `DATA` reference from `0x100008118` with no owning procedure, inside the `__LINKEDIT` segment that the overview lists from `0x100008000` ([the capture](manuals/reverse-engineering-101/capture/out/05-analyze-arm64-O1.json)). The one outgoing reference is the `CONDITIONAL_JUMP` of `cbz`. `callers` names `entry`, and `callees` is empty, because the function calls nothing. `unresolved_calls` is empty, and `facet_availability` marks all eight facets of the dossier as available.

**Basic blocks:** three, at `0x100000500`, `0x100000504`, and `0x100000514`, with exclusive `end` values. The body range uses inclusive ends, as its contract name `complete-inclusive-ranges-v1` says. Keep the two conventions apart when you compare addresses.

`native_value_flow` holds 13 p-code operations and 13 def-use edges with `truncated: false`. Every operation carries `is_dead: true`, and the limitation explains that the flag mirrors the Java AST and that `block_membership` reports the real membership. Read the limitations before the numbers, every time.

```takeaways
- Run `rea function PATH NAME --provider ghidra --format json` and save the whole record.
- Check `subject.digest.sha256` against your own `shasum -a 256` before you trust anything else.
- Read `confidence`, `authority`, and `limitations` before `normalized_result`.
- Compare the pseudocode with the assembly, and expect decompiler checks that the source never had.
```

Sources: cli Output and exit status (rea docs/cli.md); rea at 27dc42d: src/cli/coreBinaryCommands.ts, src/cliCommandNames.ts, src/cliOutput.ts, src/domain/binaryTarget.ts, src/application/BinaryTargetResolver.ts, src/application/binary/AnalysisProviderRegistry.ts, src/ghidra/GhidraAnalysisProfile.ts, src/ghidra/GhidraClient.ts, src/ghidra/GhidraTargetSnapshot.ts, src/ghidra/GhidraJavaLaunch.ts, src/ghidra/GhidraLauncher.ts, src/config/providerStartupTimeout.ts, src/ghidra/GhidraClientStartup.ts, src/ghidra/GhidraSessionValues.ts, src/ghidra/GhidraClientWire.ts, bridge/ghidra/ReaGhidraBridge.java, src/ghidra/GhidraProviderClient.ts, src/server/registerEvidenceTools.ts, src/domain/evidence.ts, src/domain/analysisProfile.ts, src/domain/relationshipCoverage.ts; capture/README.md; capture/fixtures/ledger.c; capture/out/00-commands.txt, 00-fixtures.txt, 02-capabilities.json, 05-analyze-arm64-O1.json, 06-function-percent-change.json
