# compare_functions and rea compare

> compare_functions diffs two dossiers on eight dimensions and reports each as unchanged, changed, or unknown, and its assembly dimension is a text diff without relocation normalization.

You rebuilt `ledger.c` at `-O2` and want to know which functions the compiler changed before you trust a claim about the `-O1` build. The capture asked rea that question for `_percent_change` and for `_total`, with the two builds open in turn. When you finish this section, you can read a comparison record and say what each of its eight dimensions compares. You can also name the limit that keeps a byte-level proof outside rea.

## Two dossiers in, one derived record out

`compare_functions` takes two complete Evidence records as `left` and `right`. Each is parsed with `parseEvidence`, so a record with a tampered id is refused. Each must be an `analyze_function` record with predicate type `rea.analysis`, or the tool answers "Expected analyze_function Evidence". The capture passed the dossiers it had received a few calls earlier.

```listing
title: the request for _percent_change across the two builds
source: capture/out/10-mcp-20-compare-functions-percent-change.json
lang: json
note: The kit kept each evidence_id and replaced the complete dossier with a marker that names the file holding it.
---
"name": "compare_functions",
"arguments": {
  "left": {
    "evidence_id": "ev_b492c85e…",
    "record": "<cut by run.py: the complete analyze_function record, see 10-mcp-09-analyze-function-percent-change-O1.json>"
  },
  "right": {
    "evidence_id": "ev_142cc943…",
    "record": "<cut by run.py: the complete analyze_function record, see 10-mcp-17-analyze-function-percent-change-O2.json>"
  }
}
```

The answer is a new Evidence record from provider `rea-function-comparison` version `1`. Its predicate type is `rea.function-comparison`, its confidence `derived`, and its authority `analyst-inference`. Both input ids appear as parameters and as `evidence_links`. The record has no subject, so it carries the automatic limitation about artifact identity ([the Evidence record](#s-the-evidence-record)). Before it is recorded, both inputs are recorded in the session ledger, which is why [import](#s-evidence-bundles-export-and-import) later found two O1 records already present.

```listing
title: the head of the _percent_change comparison
source: capture/out/10-mcp-20-compare-functions-percent-change.json
lang: json
note: The dimensions, the changes, and the limitations are cut.
---
"normalized_result": {
  "status": "unknown",
  "function_match": {
    "status": "matched",
    "method": "symbol",
    "left_name": "_percent_change",
    "right_name": "_percent_change"
  },
  "left_subject_sha256": "01b5d08b…",
  "right_subject_sha256": "8bbbaa58…",
  "summary": {
    "unchanged": 7,
    "changed": 0,
    "unknown": 1
  },
```

**Function match:** how rea decided that the two dossiers describe the same function. `matched` by `symbol` means the two procedure names are equal. A `mismatched` or `ambiguous` match is reported with method `explicit`, and an ambiguous match makes the whole comparison `unknown`.

## The eight dimensions

`compareDimensions` runs eight comparisons in a fixed order: `identity`, `pseudocode`, `assembly`, `comments`, `calls`, `references`, `strings_names`, and `cfg`. Each dimension has a status of `unchanged`, `changed`, or `unknown`, and a left and right digest. It also has a left and right count, a `text_delta` for the two text dimensions, and a `conclusion_kind`. The overall status is `unknown` if any dimension is unknown, else `changed` if any dimension changed, else `unchanged`.

A dimension is also `unknown`, with null counts, when either dossier declares a needed facet unavailable in `facet_availability`. An empty facet with no declaration has the same effect. The call dimension also reads `relationship_coverage`.

| Dimension | What is compared | `_percent_change` | `_total` |
|---|---|---|---|
| `identity` | the normalized identity of the procedure | unchanged | unchanged |
| `pseudocode` | the decompiler text, as lines | unchanged, 272 and 272 code points | changed, 300 to 2904 code points |
| `assembly` | the listing text, as lines | unchanged, 161 and 161 | changed, 336 to 1866 |
| `comments` | comment text at normalized offsets | unchanged, 0 and 0 | unchanged, 0 and 0 |
| `calls` | the resolved callees | unchanged, 1 and 1 | unchanged, 1 and 1 |
| `references` | reference endpoints and kinds | unknown, 3 and 3 | changed, 4 to 13 |
| `strings_names` | referenced strings and names | unchanged, 1 and 1 | changed, 2 to 11 |
| `cfg` | the basic blocks and edges, address-normalized | unchanged, 3 and 3 | changed, 5 to 16 |

## One unknown dimension

The `_percent_change` comparison has seven `unchanged` dimensions and one `unknown`, so the whole record is `unknown`. The unknown dimension is `references`. Both sides have three references and the same named endpoints. One incoming reference of each dossier is a `DATA` reference with no source procedure, so that endpoint has no name.

```listing
title: the references dimension of the _percent_change comparison
source: capture/out/10-mcp-20-compare-functions-percent-change.json
lang: json
note: Nothing inside the dimension is cut.
---
{
  "dimension": "references",
  "left_count": 3,
  "right_count": 3,
  "evidence_links": [
    "ev_b492c85e…",
    "ev_142cc943…"
  ],
  "limitations": [
    "Unnamed reference endpoints have no stable identity across different artifacts, so equal named endpoints do not establish equal references."
  ],
  "status": "unknown",
  "left_digest": null,
  "right_digest": null,
  "text_delta": null,
  "conclusion_kind": "unresolved_branch"
},
```

The rule applies only when the two dossiers come from different files. Inside one file an address is a stable identity. The `-O1` and `-O2` builds are different files. So rea cannot say that the unnamed endpoint on the left is the one on the right. Edge kinds that differ still count as a change, and that is why the `_total` references dimension reads `changed`.

Read the summary before the overall status. One unknown dimension makes the whole record `unknown`, and it opens a residual unknown of severity `high` ([residual unknowns](#s-residual-unknowns-and-coverage)). The seven other dimensions keep their own status. A claim about the pseudocode or the assembly of `_percent_change` still passes ([verification](#s-verify-reconstruction)). A claim about `references` or `overall` does not.

The `calls` dimension of both comparisons carries two limitations, one for each side. Each says that only resolved Ghidra call references are returned. They qualify the `unchanged` status and do not change it.

## The text dimensions

The two text dimensions are line diffs with a budget: 100 ms and 10,000 edits. A diff that runs out of budget makes the dimension `unknown` with the limitation "Bounded line diff exceeded its time or edit-distance limit.". The counts are code points of the text. The `text_delta` reports added lines, removed lines, and hunks. Both text dimensions carry the limitation "Exact provider text is compared without address or generated-name normalization; layout-only differences do not establish a behavior change."

For `_total`, the pseudocode grew by 109 lines and lost 11 in 11 hunks (`10-mcp-21-compare-functions-total.json`). The assembly grew by 61 lines and lost 12 in 2 hunks. The `-O2` build of `_total` has 16 basic blocks where the `-O1` build has 5, and 13 references where it had 4. Those are the facts rea states, and the record stops there. Why the compiler made that change is your question to answer with the two assembly listings.

```figure
id: fig-5-6
kind: comparison
title: compare_functions on two functions across the -O1 and -O2 builds
claim: The compiler left _percent_change the same on seven dimensions with references unknown, changed _total on five, and rea reports counts without saying why.
caption: Read each table top to bottom. Amber rows are changed dimensions, and the dashed row is unknown. From capture/out/10-mcp-20-compare-functions-percent-change.json and 10-mcp-21-compare-functions-total.json.
```

## The assembly limit

Every assembly dimension carries two limitations, whether its status is `unchanged` or `changed`.

```listing
title: the assembly dimension of the _total comparison
source: capture/out/10-mcp-21-compare-functions-total.json
lang: json
note: Nothing inside the dimension is cut.
---
{
  "dimension": "assembly",
  "left_count": 336,
  "right_count": 1866,
  "evidence_links": [
    "ev_a1fe53ff…",
    "ev_bfe3275b…"
  ],
  "limitations": [
    "Exact provider text is compared without address or generated-name normalization; layout-only differences do not establish a behavior change.",
    "Assembly is opaque provider text; relocation normalization is unavailable."
  ],
  "status": "changed",
  "left_digest": "40e2d441…",
  "right_digest": "e1140153…",
  "text_delta": {
    "added_lines": 61,
    "removed_lines": 12,
    "hunks": 2
  },
  "conclusion_kind": "derived_relationship"
},
```

rea attaches these strings before any diff runs. The dossier's assembly is Ghidra's listing text, with the addresses and the resolved operands inside the text. The tool compares that text line by line. It does not decode the instructions, it does not know which operand bytes a linker will patch, and it cannot mask them. Two copies of the same code at different addresses diff as `changed`, and a relocatable object compared with its linked image diffs as `changed`. The same holds across engines: when the two dossiers come from different providers, both text dimensions become `unknown` with "Exact text comparison requires one provider identity.".

An `unchanged` assembly dimension therefore means equal text from one engine, and a `changed` one means different text. Neither is a statement about bytes. The byte-level proof zeroes the relocation fields and compares the referenced table as well. [Lesson 36](phases/13-tools-and-protocols/36-rebuild-and-prove-equal) builds that proof, and Part 7 runs it against the same fixture. The references dimension has a limit of its own, because it compares the endpoints and not the kinds: "Reference endpoints differ independently of provider reference-kind metadata.".

## rea compare on two bundles

`rea compare LEFT RIGHT`, also spelled `rea compare-bundles`, compares two bundle files without a session. It works by `evidence_id`: a record in both bundles is compared, and a record in one bundle only is an unresolved branch. The overall status is `unknown` as soon as one change is unresolved.

```listing
title: rea compare on the O1 and O2 bundles
source: capture/out/14-compare-bundles.json
lang: json
note: Nine of the ten changes are cut, and so are the closing limitations.
---
{
  "status": "unknown",
  "left_bundle_sha256": "47160c2d…",
  "right_bundle_sha256": "e0a9fe04…",
  "summary": {
    "records_unchanged": 0,
    "records_added": 0,
    "records_removed": 0,
    "records_changed": 0,
    "unknowns_unchanged": 0,
    "unknowns_added": 0,
    "unknowns_removed": 0,
    "unknowns_advanced": 0,
    "unknowns_diverged": 0,
    "unresolved": 10
  },
  "changes": [
    {
      "entity": "evidence",
      "key": "ev_142cc943…",
      "classification": "unknown",
      "conclusion_kind": "unresolved_branch",
      "left_evidence_ids": [],
      "right_evidence_ids": [
        "ev_142cc943…"
      ],
      "left_digest": null,
      "right_digest": "142cc943…",
      "limitations": [
        "EvidenceBundle has no inventory completeness marker; one-sided membership may reflect incomplete capture."
      ]
    },
```

Ten unresolved, none unchanged, none removed. The two bundles come from two different files, `ledger-arm64-O1` and `ledger-arm64-O2`. No `evidence_id` is in both, and every one of the ten records is one-sided. The tool does not call a one-sided record `removed`, because a bundle has no marker of completeness.

The digests it reports are digests of the canonical bytes. `47160c2d` is the digest of bundle O1 without the kit's trailing newline ([export and import](#s-evidence-bundles-export-and-import)). `rea compare` answers the question "what changed in this evidence set" for two bundles of one build. For two builds, `compare_functions` is the tool, one function at a time.

```takeaways
- Pass complete `analyze_function` records to `compare_functions`, never summaries or views.
- Read `summary.unknown` first, then the unknown and changed dimensions, then `limitations`.
- Treat an unchanged assembly dimension as equal text from one engine, never as equal bytes.
- Run `rea compare` on bundles of one build, or expect every record to be unresolved.
```

Sources: capture/out/10-mcp-20-compare-functions-percent-change.json, capture/out/10-mcp-21-compare-functions-total.json, capture/out/14-compare-bundles.json, capture/out/12-evidence-export.txt; phases/13-tools-and-protocols/36-rebuild-and-prove-equal; rea 6.7.0 at 27dc42d: src/domain/functionComparisonSchemas.ts, src/domain/functionComparisonDimensions.ts, src/domain/functionComparisonNormalization.ts, src/domain/functionComparisonResults.ts, src/domain/bundleComparison.ts, src/server/registerFunctionComparisonTool.ts, src/cliEvidenceCommands.ts, src/application/EvidenceBundleCommands.ts; rea docs/mcp-contracts.md
