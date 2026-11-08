# verify_reconstruction

> verify_reconstruction grades each declared claim against one comparison record, and its pass says the provider text matched, never that two functions are equal.

You have two builds of `ledger.c` on disk, the `-O1` and the `-O2` executables, and two `compare_functions` records from [Section 5.5](#s-compare-and-compare-functions). You want rea to tell you whether `total` is the same function in both. The tool for that question is `verify_reconstruction`, and the capture called it once, with four claims, and got two passes and two failures. When you finish this section, you can write a specification of structural claims and read the status rea returns for each claim. You can also say what a pass does and does not prove.

## The specification

**Specification:** the input of `verify_reconstruction`: a `name` and a list of at least one claim. Each claim has a `claim_id`, a `title`, a `kind`, a `dimension`, and a `comparison_evidence_id` ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-02-tools-list.json)). The last one is the `ev_` id of one comparison record already in the session. The kind names the producer of that record. A `behavioral` claim points at a `compare_process_captures` record, a `structural-function` claim at a `compare_functions` record, and a `structural-artifact` claim at a `compare_artifacts` record. A `structural-function` claim names one of nine dimensions: `overall`, `identity`, `pseudocode`, `assembly`, `comments`, `calls`, `references`, `strings_names`, or `cfg`.

The capture kit built four claims over the two comparison records of [Section 5.5](#s-compare-and-compare-functions): pseudocode and assembly for `percent_change`, and pseudocode and assembly for `total`.

```listing
title: the specification the capture sent
source: capture/out/10-mcp-22-verify-reconstruction.json
lang: json
note: The second and third claims are cut. The response follows the request in the same file.
---
{
  "request": {
    "jsonrpc": "2.0",
    "id": 22,
    "method": "tools/call",
    "params": {
      "name": "verify_reconstruction",
      "arguments": {
        "specification": {
          "name": "ledger functions rebuilt at -O2 against the -O1 build",
          "claims": [
            {
              "claim_id": "percent-change-pseudocode",
              "title": "percent_change: the Ghidra pseudocode is the same text in the -O1 and -O2 builds",
              "kind": "structural-function",
              "dimension": "pseudocode",
              "comparison_evidence_id": "ev_2161e17a…"
            },
            …
            {
              "claim_id": "total-assembly",
              "title": "total: the Ghidra assembly is the same text in the -O1 and -O2 builds",
              "kind": "structural-function",
              "dimension": "assembly",
              "comparison_evidence_id": "ev_40ba96d8…"
            }
          ]
        }
      }
    }
  },
  …
}
```

The tool has no CLI command. It is one of the 65 MCP tools without a CLI command, so a one-shot `rea` call cannot run it. Over MCP the handler takes the bundle of the current connection with `session.exportEvidenceBundle()` and verifies the specification against it. A claim whose comparison id is not in that bundle fails the whole call with `Missing comparison Evidence`. A comparison whose two sources are not `analyze_function` records fails the source check.

That rule explains the order of the capture. `close_binary` at step 15 cleared the retained records of the `-O1` target. The two `-O1` dossiers came back into the ledger at steps 20 and 21. `compare_functions` records its two inline inputs before it records the comparison. The `import_evidence_bundle` call at step 23 then reported `imported: 6` and `total: 15` ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-23-import-evidence-bundle-O1.json)). Bundle `O1` holds eight records, and the two comparisons had already restored two of them.

## What rea returned

The response is an Evidence record like every other result, with `subject: null`, provider `rea-reconstruction-verifier` version `1`, predicate `rea.reconstruction-verification`, `confidence: "derived"`, and `authority: "analyst-inference"`. The `parameters` hold the SHA-256 of the specification and the claim ids, so the id of the record changes when a claim changes.

```listing
title: the verification record, head and summary
source: capture/out/10-mcp-22-verify-reconstruction.json
lang: json
note: The analysis_profile, the per-claim items, the probes, and the evidence links are cut.
---
      "structuredContent": {
        "evidence_id": "ev_ccbaea4b…",
        "subject": null,
        "provider": {
          "id": "rea-reconstruction-verifier",
          "name": "REA reconstruction verifier",
          "version": "1"
        },
        …
        "normalized_result": {
          "status": "fail",
          "specification_sha256": "9e8d22fa…",
          "summary": {
            "total": 4,
            "passed": 2,
            "failed": 2,
            "unknown": 0,
            "behavioral": 0,
            "structural": 4
          },
          …
          "limitations": [
            "Pass means every declared claim passed; it does not establish global implementation equivalence."
          ]
        },
        "confidence": "derived",
        "authority": "analyst-inference",
        …
```

The overall `status` follows one rule: `fail` when any claim failed, otherwise `unknown` when any claim is unresolved, otherwise `pass`. The `summary` counts the claims by status and by kind. The record's own `limitations` add "Artifact identity is unavailable for this observation.", which `createEvidence` appends to any record without a subject.

## The status of one claim

**Claim status:** `pass`, `fail`, or `unknown`, computed from three inputs in a fixed order. First, any limitation makes the claim `unknown`. A limitation comes from the authority of the sources.

Incomplete call coverage in a source dossier is also a limitation. It applies to a `calls` claim, and to an `overall` claim with no other changed dimension. Second, an observed status of `changed`, `added`, `removed`, or `contradiction` makes the claim `fail`. Third, an observed status of `unknown` or `truncated`, or an open residual unknown on the comparison, makes the claim `unknown`. In all other cases the claim is `pass`.

For a `structural-function` claim the observed status is the `status` of the named dimension in the comparison record.

```listing
title: the total-assembly claim
source: capture/out/10-mcp-22-verify-reconstruction.json
lang: json
note: The evidence_links array and 28 of the 30 limitation strings are cut. The Residual unknown line is the one this claim adds to the limitations of the comparison record.
---
                "claim_id": "total-assembly",
                "kind": "structural-function",
                "dimension": "assembly",
                "status": "fail",
                "observed_status": "changed",
                "comparison_evidence_id": "ev_40ba96d8…",
                "left_evidence_ids": [
                  "ev_a1fe53ff…"
                ],
                "right_evidence_ids": [
                  "ev_bfe3275b…"
                ],
                …
                "unknown_ids": [
                  "unk_823f4184…"
                ],
                "limitations": [
                  "Artifact identity is unavailable for this observation.",
                  …
                  "Residual unknown: Function comparison is changed (comparison ev_40ba96d8…)",
                  …
                ]
```

The two `percent_change` claims pass, although the comparison record `ev_2161e17a` is `unknown` overall. Each claim reads only its own dimension, and `ev_2161e17a` reports both pseudocode and assembly `unchanged`. Its one unknown dimension is `references`. The residual unknown it opened names only `overall` and `references`, so neither claim lists it in `unknown_ids`. A claim on `references` or on `overall` would have read `unknown`.

The two `total` claims fail because `ev_40ba96d8` reports `changed` for pseudocode and assembly, and five of its eight dimensions changed in all. The `unknown_ids` entry is not something the verifier invented. `compare_functions` records a residual unknown whenever its status is not `unchanged`, with the question `Function comparison is changed (comparison ev_...)` and severity `medium` for a change. The verifier found that unknown in the bundle, listed its id on both `total` claims, and copied its question into the limitations. The claim still reads `fail`, because a changed observation outranks an open unknown in the order above.

Had a claim come out `unknown`, the call would have recorded one more unknown of its own. When the overall status is `unknown`, the handler records the question "Does the reconstruction satisfy every declared claim?" with the probes the verifier recommends. A `pass` and a `fail` record nothing new, and `recommended_probes` was empty here.

```figure
id: fig-7-1
kind: tree
title: four claims over two comparison records
claim: Each claim takes its status from one dimension of one comparison record, and the total claims also carry the unknown that compare_functions recorded.
caption: Read top down. The verification record cites four claims, each claim cites one comparison record, and each comparison record cites a left and a right dossier. Amber claims passed and dashed rose claims failed. Ids are cut to their first eight hex digits. From capture/out/10-mcp-22-verify-reconstruction.json.
```

## What a pass does not prove

The fixed limitation of every verification record says it: "Pass means every declared claim passed; it does not establish global implementation equivalence.". The claim a `structural-function` dimension can pass is "same provider text", because `compare_functions` line-diffs the pseudocode and the assembly that Ghidra printed. The pseudocode and assembly dimensions carry a caveat in every comparison record: "Exact provider text is compared without address or generated-name normalization; layout-only differences do not establish a behavior change." The assembly dimension adds: "Assembly is opaque provider text; relocation normalization is unavailable." ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-20-compare-functions-percent-change.json)). Nothing in rea 6.7.0 runs a function or compiles one. A passed claim says that two decompiler outputs matched line for line, and a failed claim says they did not.

Two consequences follow for the `ledger` fixture. The `total` claims failed although both builds came from the same source line. `-O2` unrolled the loop into 62 instructions where `-O1` had 13 ([the captures](manuals/reverse-engineering-101/capture/out)). Different text does not mean different behaviour.

The reverse holds too. A rebuild with a wrong constant in a lookup table has the same assembly text as the original. The text never shows the one data byte that differs, so a text claim can pass on a wrong function. [Section 7.2](#s-a-proof-harness-outside-rea) builds the two checks that settle both cases.

The rea repository has a wider verifier for its own use. The readiness page of the rea docs describes `npm run verify:readiness`, a nine-stage conformance run with a stage named `verify-reconstruction-closure`, and says what it is:

```rule
label: the readiness verifier is not a tool
source: readiness Reconstruction readiness conformance
---
The report evaluator belongs to the verifier of the repository. It is not a public REA tool.
```

Its aggregation rule is the one to copy into your own harness:

```rule
label: nothing weaker than pass adds up to pass
source: readiness Required stages
---
A stage result of fail, unknown, unsupported, truncated, or skipped never adds up to pass.
```

```takeaways
- Put both dossiers and the comparison record into one connection before you call verify_reconstruction.
- Read observed_status and unknown_ids of each claim before you read the overall status.
- Treat a passed structural claim as "same Ghidra text", and prove behaviour and bytes yourself.
- Export the bundle before close_binary, because the close clears the retained records.
```

Sources: capture/out/10-mcp-22-verify-reconstruction.json, 10-mcp-20-compare-functions-percent-change.json, 10-mcp-21-compare-functions-total.json, 10-mcp-11-analyze-function-total-O1.json, 10-mcp-18-analyze-function-total-O2.json, 10-mcp-23-import-evidence-bundle-O1.json, 10-mcp-02-tools-list.json, 10-mcp-session.txt; rea at rea-agents-6.7.0 (27dc42d): src/domain/reconstructionVerification.ts, src/domain/reconstructionUnknowns.ts, src/domain/functionCallCoverage.ts, src/server/registerInvestigationTools.ts, src/server/registerFunctionComparisonTool.ts, src/domain/functionComparisonDimensions.ts, src/domain/evidence.ts, src/cliCommandNames.ts; rea docs/reconstruction-readiness.md
