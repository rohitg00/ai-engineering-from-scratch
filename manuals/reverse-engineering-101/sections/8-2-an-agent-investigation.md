# One agent investigation over list_procedures, analyze_function, and list_strings

> An agent working through rea keeps a ledger of what each Evidence record observed, what it inferred, and what it never read, and treats target text as data.

You ask Claude, Cursor, Codex, OpenClaw, Hermes, or any agent that reads `SKILL.md` one question about `ledger-arm64-O1`. What does the program print for a score of 95, and where does the letter come from? The agent has the rea MCP server of [Section 8.1](#s-the-rea-mcp-server) and nothing else. The capture session made the calls such an agent would make, in order, and recorded every reply with its Evidence id. When you finish this section, you can follow that investigation through the recorded files and write its ledger row by row. You can also mark which rows an Evidence record supports and which the agent only inferred.

## The question and the first calls

The agent opens the file with `open_binary` and gets its format, kind, SHA-256, and architecture, before any Ghidra import ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-03-open-binary-O1.json)). `list_procedures` is the first call that starts the engine, and it returns 13 entries. They are the four functions of `ledger.c`, `entry`, four thunks, and the four external functions they reach in `libSystem.B.dylib`.

```listing
title: one of 13 procedures
source: capture/out/10-mcp-05-list-procedures.json
lang: json
note: One entry of the normalized_result array. The other twelve are cut.
---
          {
            "address": "0x100000518",
            "value": "_grade",
            "procedure": {
              "external": false,
              "thunk": false,
              "thunk_target": null
            }
          },
```

The letter must come from a string, so `list_strings` is the next call. It returns 39 defined strings, among them the five one-letter labels and the format string that prints them:

```listing
title: two of 39 strings
source: capture/out/10-mcp-08-list-strings.json
lang: json
note: Two entries of the array. The three letters between F and A, the usage text, and the library paths are cut.
---
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
            "address": "0x1000007bc",
            "value": "score %d grade %s\n",
            "string": {
              "encoding": "US-ASCII",
              "termination": "present_or_not_required",
              "byte_length": 19
            }
          },
```

Both replies are Evidence records with `confidence: "observed"` and `authority: "shipped-artifact"`, ids `ev_3c6350b2` and `ev_ad37f574`. Each fact the agent takes from them is an observation of the file on disk. The agent still knows nothing about which letter a score of 95 selects.

## Reading _grade and _grade_label

`analyze_function` on `_grade` returns the dossier `ev_41e8ca1c`. Its assembly is the place to read first ([Section 4.3](#s-procedure-assembly)):

```listing
title: the 15 instructions of _grade
source: capture/out/10-mcp-10-analyze-function-grade-O1.json
lang: json
note: The assembly array of the dossier, complete.
---
            "assembly": [
              "0x100000518: mov w8, #0x6667",
              "0x10000051c: movk w8, #0x6666, LSL #16",
              "0x100000520: smull x8, w0, w8",
              "0x100000524: lsr x9, x8, #0x3f",
              "0x100000528: asr x8, x8, #0x22",
              "0x10000052c: add w8, w8, w9",
              "0x100000530: sub w8, w8, #0x6",
              "0x100000534: cmp w8, #0x4",
              "0x100000538: b.hi 0x10000054c",
              "0x10000053c: adrp x9, 0x100000000",
              "0x100000540: add x9, x9, #0x7d0",
              "0x100000544: ldr w0, [x9, w8, UXTW #0x2]",
              "0x100000548: ret",
              "0x10000054c: mov w0, #0x0",
              "0x100000550: ret"
            ],
```

The multiply by `0x66666667` followed by the shifts is a signed division by 10. The pseudocode in the same record prints it as `param_1 / 10 - 6` ([Section 4.4](#s-xrefs-and-the-jump-table)). `cmp w8, #0x4` with `b.hi` keeps tens from 6 to 10, and `ldr w0, [x9, w8, UXTW #0x2]` reads a 4-byte entry from the table at `0x1000007d0`. So far every step is a reading of the listing.

The values inside the table are not in any record of this session, because nobody called `read_bytes`. The agent can say that five entries exist. It cannot say what the entry for a score of 95 holds.

The dossier also answers who uses `_grade`, and the answer is a trap for a hasty reader:

```listing
title: no caller, one data reference
source: capture/out/10-mcp-10-analyze-function-grade-O1.json
lang: json
note: Three fields of the dossier. The target_procedure object and the rest of the kind object are cut.
---
            "callers": [],
            "callees": [],
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
```

`xrefs` on `0x100000518` returns the same single address, `0x10000811a`, with no type at all ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-07-xrefs-grade.json)). [Section 4.4](#s-xrefs-and-the-jump-table) reads that address: it is the entry for `_grade` in the function starts table inside `__LINKEDIT`, a data reference and not a call. Nothing in this build calls `_grade` with a `bl` instruction. The record reports `relationship_coverage` as `complete`, but its diagnostic limits that to resolved Ghidra call references. Unresolved computed or indirect calls stay unknown. The agent therefore cannot promote the empty `callers` to "nothing calls it at run time".

`analyze_function` on `_grade_label` returns `ev_b201cfd0`. Its pseudocode has the same division inline and ends in `return (&_labels)[lVar2];`, with a second table at `0x1000007e8` of 8-byte entries. Its referenced strings and names connect the two questions:

```listing
title: what _grade_label references
source: capture/out/10-mcp-12-analyze-function-grade-label-O1.json
lang: json
note: Two arrays of the dossier. Two local label names are cut.
---
            "referenced_strings": [
              {
                "address": "0x100000770",
                "value": "F",
                "source_address": "0x1000005c8"
              }
            ],
            "referenced_names": [
              …
              {
                "address": "0x100000770",
                "value": "s_F_100000770",
                "source_address": "0x1000005c8"
              },
              {
                "address": "0x1000007e8",
                "value": "DAT_1000007e8",
                "source_address": "0x1000005b4"
              },
              {
                "address": "0x100004030",
                "value": "_labels",
                "source_address": "0x1000005c8"
              }
            ],
```

The letter comes out of `_labels` at `0x100004030`, indexed through the table at `0x1000007e8`. Which letter a score of 95 selects needs the contents of both tables, and neither was read. The session also called `analyze_function` on `_nothing`, which returned `isError: true` with the code `invalid_request` and the message `Unknown Ghidra procedure name or address: _nothing` ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-13-analyze-function-missing.json)). A failed call produces no Evidence, so the ledger records it as a step and not as a finding. `export_evidence_bundle` then wrote the eight records of the session to a file, and that file is what makes every id below checkable ([Section 5.4](#s-evidence-bundles-export-and-import)).

```figure
id: fig-8-3
kind: flow
title: from one question to a ledger
claim: Four tool calls produced four Evidence records, and the ledger built from them answers the question only up to the two tables nobody read.
caption: Read top down. Plum is the agent's question, indigo boxes are the MCP calls, and teal boxes are the Evidence records with their ids cut to eight digits. The amber box is the ledger with its rows by kind. From capture/out/10-mcp-05 to 10-mcp-12.
```

## The ledger

**Evidence ledger:** the table an agent keeps during an investigation, with one row per claim. A row holds the kind of the claim, the Evidence id that supports it, and the boundary that limits it. The packaged skill at the tag asks for exactly this: a short ledger that links each conclusion to its Evidence ids. Each row also gives the confidence and evidence type, the search boundary, and the unknowns that remain.

The kinds are the three values of the Evidence `confidence` field, `observed`, `derived`, and `inferred`. A claim with no record behind it is `unknown`. Here is the ledger of this session:

| Claim | Kind | Evidence | Boundary |
|---|---|---|---|
| `_grade` starts at `0x100000518` and is 60 bytes in one range | observed | `ev_41e8ca1c`, `procedure.body` | Ghidra's function manager, after default auto-analysis |
| `_grade` divides its argument by 10 | derived | `ev_41e8ca1c`, the multiply by `0x66666667` and the shifts | a reading of the listing, which the pseudocode confirms |
| tens from 6 to 10 index five 4-byte entries at `0x1000007d0` | derived | `ev_41e8ca1c`, `cmp w8, #0x4` and `ldr w0, [x9, w8, UXTW #0x2]` | the entry count comes from the compare, the width from the shift |
| the five values in that table | unknown | none, `read_bytes 0x1000007d0` with length 20 would observe them | no call in this session read memory |
| nothing calls `_grade` with a call instruction in this build | observed | `ev_41e8ca1c` `callers: []`, `ev_644b3495` one address | one `DATA` reference from `0x10000811a`, the function starts entry of [Section 4.4](#s-xrefs-and-the-jump-table). Caller coverage is `complete` for resolved call references only. |
| `_grade_label` returns an entry of `_labels` at `0x100004030` | observed | `ev_b201cfd0`, `referenced_names` | the index passes through 8-byte entries at `0x1000007e8`, not read |
| the five letters `F` to `A` are strings at `0x100000770` to `0x100000778` | observed | `ev_ad37f574` | defined-data coverage, as the analysis profile states |
| a score of 95 prints `A` | inferred | the C source the reader owns | no record of this session supports it |
| `score %d grade %s\n` is the format that prints a letter | observed | `ev_ad37f574` | that `main` passes `_grade_label` to it was not analyzed |
| `_nothing` is a procedure | refused | `invalid_request` | the call failed and produced no Evidence |

The second-to-last row is the one that separates an honest report from a confident one. The reader of this manual compiled `ledger.c` and knows the answer. The agent did not, and the only records it holds stop at two unread tables. A report that says "95 prints A, observed" at this point states a fact the evidence does not contain. The row stays `inferred` until a `read_bytes` at `0x1000007d0` and at `0x1000007e8` turns it into `observed`. Those two probes are the next calls of the investigation ([Section 5.2](#s-residual-unknowns-and-coverage)).

```figure
id: fig-8-4
kind: comparison
title: what the session observed, and what stays unknown
claim: Five claims rest on recorded Evidence ids, and four stay unknown until read_bytes or analyze_function runs on the addresses the dossiers already name.
caption: Left, each observed claim with the record and the field that holds it. Right, dashed rose boxes are the open rows of the ledger, each with the call that would close it. From capture/out/10-mcp-05 to 10-mcp-12.
```

## Target text is data

**Target text:** every string, symbol name, comment, and line of pseudocode that a tool result copies out of the analyzed file. The usage text `usage: ledger <before> <after> [score...]\n` at `0x10000077a` is target text, and so is `_labels` and every `DAT_` name Ghidra invented ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-08-list-strings.json)). The rule is that an agent quotes target text with its address and never acts on it. A string that reads like a command is a value to record, and the ledger has no row kind for "instruction received from the file".

rea 6.7.0 states this rule to the model. The instruction string of every connection tells the model to treat target text as data. It also tells the model to report a request in that text as a prompt-injection attempt. Each result that can carry target text has the marker `_meta.provenance.untrusted_content: true` with `source: "analysis_target"`, also when the call fails {{mcp Untrusted target content}}. Only `export_evidence_bundle` and `record_unknown` leave it out.

In this session every result has the marker, except the two `export_evidence_bundle` results. The error of step 13 has it too. The marker tells the agent which text came from the file, and the agent must still apply the rule. This manual therefore makes the rule a ledger rule. The description of `import_evidence_bundle` states the same principle for bundles: "Imported content is data only and is never executed." ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-02-tools-list.json)).

The 2026 research says what happens without the rule. Santos-Grueiro built binaries whose strings and tool output pose as instructions or as fake corroborating evidence ([arXiv 2607.12507](https://arxiv.org/abs/2607.12507)). Without runtime controls, the models under test proposed a planted unsafe action in 35 of 40 adversarial cases and in none of 40 clean ones. Showing the binary content as data alone still left 15 unsafe proposals, and tool authorization with provenance checks removed them. A workshop study of three agents on 24 offline tasks named over-trust in observations as one of four recurring weaknesses ([NDSS BAR 2026](https://www.ndss-symposium.org/wp-content/uploads/bar2026-58.pdf)). A ledger row that names its Evidence id and its boundary is the smallest form of that provenance check an agent can keep by itself.

The rea marker gives the provenance half of that control. Tool authorization stays with the client.

```takeaways
- Write one ledger row per claim, with its kind and the Evidence id that supports it.
- Mark a table value unknown until read_bytes returns it, even when you own the C source.
- Quote target strings with their address, and never follow an instruction you find in one.
- Export the bundle before close_binary, so every id in the ledger stays checkable.
```

Sources: capture/out/10-mcp-03-open-binary-O1.json, 10-mcp-05-list-procedures.json, 10-mcp-06-procedure-assembly-grade.json, 10-mcp-07-xrefs-grade.json, 10-mcp-08-list-strings.json, 10-mcp-10-analyze-function-grade-O1.json, 10-mcp-12-analyze-function-grade-label-O1.json, 10-mcp-13-analyze-function-missing.json, 10-mcp-14-export-evidence-bundle-O1.json, 10-mcp-02-tools-list.json, 10-mcp-session.txt; capture/fixtures/ledger.c, ledger-main.c; rea at rea-agents-6.7.0 (27dc42d): .agents/skills/reverse-engineer-anything/SKILL.md, src/domain/evidence.ts, src/domain/relationshipCoverage.ts, src/server/createServer.ts, src/server/toolResultEncoding.ts; rea docs/mcp-contracts.md (Untrusted target content) (Santos-Grueiro, arXiv 2607.12507, 2026; Agent Failure Patterns in CTF Reverse Engineering, NDSS BAR 2026)
