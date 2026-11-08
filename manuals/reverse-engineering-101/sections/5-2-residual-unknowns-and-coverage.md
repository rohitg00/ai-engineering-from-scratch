# ResidualUnknown, record_unknown, and coverage

> An unknown is a durable record with its own id and revision chain, and an empty list in any result tells you to check coverage.

The `_percent_change` [dossier](manuals/reverse-engineering-101/capture/out/10-mcp-09-analyze-function-percent-change-O1.json) lists `"callees": []`. An agent reads that line and writes that the function calls nothing. The record supports less than that. It says which calls Ghidra resolved, and rea has a record type for what is still open. When you finish this section, you can read the fields of a ResidualUnknown, open one with `record_unknown`, and say what an empty list proves.

## What an empty list proves

The dossier has an empty `callees` array and, 840 lines later, a limitation about it. Callees hold resolved targets only. The record says that this set is complete: `relationship_coverage.status` is `complete`, and `unresolved_calls` is empty. Complete means that Ghidra returned every resolved call reference. It does not mean that Ghidra found every call the program can make at run time.

```listing
title: an empty list and the limitation that qualifies it
source: capture/out/10-mcp-09-analyze-function-percent-change-O1.json
lang: json
note: Line 1052 and line 1894 of the file. Everything between them is cut.
---
"callees": [],
…
"Resolved reference metadata identifies computed, indirect, external, call, jump, and data edges; unresolved targetless flows remain unknown, and function classifications distinguish thunks and externals.",
```

The provider documentation states the same limit: the caller and callee lists hold only functions that Ghidra resolved {{ghidra Admitted function-analysis semantics}}.

The design rule behind every rea tool is shorter still: missing coverage means unknown, not absent {{design Define the contract}}.

**Relationship coverage:** the field `relationship_coverage` of an Evidence record, which states how complete the caller and callee sets are. Its status is `complete`, `partial`, or `unknown`. A `partial` value lists its limitations and can name the limited direction. An `unknown` value gives a reason. When a provider reports no coverage for `procedure_callers` or `procedure_callees`, rea writes `unknown`. A record of any other operation that reports no coverage has `null`.

Provider caveats stay in `limitations` and do not make the coverage partial. The same contract sets the limit of `complete`. It means that rea returned the set without a known read limit. It does not claim every edge that could occur at runtime {{design Define the contract}}.

One part of the dossier does declare its coverage in numbers. The value flow reports whether it was truncated and how many operations, inputs, and edges it omitted. `inspect-evidence-bundle` repeats those numbers for every dossier in a bundle.

```listing
title: the coverage numbers of one dossier in the bundle summary
source: capture/out/11-inspect-evidence-bundle-O1.json
lang: json
note: One of the eight records. The fields before native_dossier are cut.
---
"native_dossier": {
  "available": true,
  "procedure_address": "0x100000500",
  "procedure_name": "_percent_change",
  "value_flow": {
    "status": "observed",
    "truncated": false,
    "omitted_operations_lower_bound": 0,
    "known_omitted_inputs": 0,
    "known_omitted_edges": 0
  }
}
```

A zero here is a count that rea stands behind. An empty array elsewhere is a count with no such statement. The contract says what those fields are for: `native_dossier.value_flow` reports truncation, unavailable metadata, and unknown metadata on its own {{mcp Tool results}}.

Two other empty lists in the capture carry the same lesson. `rea compare` in `14-compare-bundles.json` lists ten records that are in one bundle only. It classifies every one as `unknown` with the conclusion kind `unresolved_branch`, because a bundle has no marker that says it is complete ([compare](#s-compare-and-compare-functions)). The JavaScript summary view in `15-js-app-view-summary.json` reports `"semantic_unknowns": 118` for a six-file application. It marks the semantic coverage `unknown` ([the application graph](#s-analyze-javascript-application)). [Figure](#fig-5-3) puts the three lists side by side.

```figure
id: fig-5-3
kind: comparison
title: three empty lists and what each one proves
claim: An empty callees array with complete coverage, a zero unknown count, and a one-sided bundle record each prove that nothing was observed, never that nothing exists.
caption: Read each column top to bottom, from the captured value to the record's own words to what you can say. From capture/out/10-mcp-09-analyze-function-percent-change-O1.json, 10-mcp-14-export-evidence-bundle-O1.json, and 14-compare-bundles.json.
```

## The ResidualUnknown record

**Residual unknown:** a question that the evidence does not yet settle. It is kept as a record with an `unk_` id, a revision chain, a status, and the evidence that would close it. A residual unknown has these fields.

| Field | Values |
| --- | --- |
| `unknown_id` | `unk_` and a SHA-256 of `domain`, `question`, `scope_digest`, and `comparison_conclusion_scope` when present |
| `revision` | an integer from 1 |
| `previous_revision_digest` | the digest of the revision before, or `null` for revision 1 |
| `revision_digest` | SHA-256 of the record without this field |
| `scope_digest` | the SHA-256 of the subject artifact, or `null` |
| `question` | non-empty text, whitespace collapsed |
| `status` | `open`, `investigating`, `blocked`, `contradicted`, or `resolved` |
| `severity` | `low`, `medium`, `high`, or `critical` |
| `domain` | free text, `function-comparison` for rea's own comparisons |
| `comparison_conclusion_scope` | optional: the comparison `ev_` id and the dimensions that the unknown is about, only in the `function-comparison` domain |
| `supporting_evidence_ids`, `contradicting_evidence_ids` | `ev_` ids, with no id in both lists |
| `required_authority`, `required_confidence`, `required_environment` | what evidence would settle the question |
| `recommended_probes` | `operation` and `rationale` pairs |
| `relationships` | `depends-on`, `related-to`, or `contradicts` another `unk_` id |
| `resolution` | `null`, or `verified` with at least one `ev_` id, or `withdrawn`, or `out-of-scope` |
| `mutation_evidence_ids` | the `ev_` ids of the records that changed this unknown, at least one |

The schema refuses a record that breaks one of eleven rules. Four of them keep the identity and the revision chain sound. The unknown id must match the hash of its own fields. The revision digest must match. Only revision 1 has no predecessor. Only a resolved unknown carries a resolution.

The other seven check the evidence and the links. A contradicted unknown needs contradicting evidence. An unknown cannot relate to itself, and no relationship can appear twice. No evidence id can appear twice in one list, and no id can both support and contradict the unknown. A comparison scope must name a comparison that supports or contradicts the unknown. It is allowed only in the `function-comparison` domain.

The id makes the question the identity. `createResidualUnknown` collapses whitespace in the question, then hashes canonical JSON of `domain`, `question`, `scope_digest`, and the comparison scope when the unknown has one. The same question in the same domain about the same target always has the same `unk_` id. A second `record_unknown` with that question therefore answers `already-exists`. The first status is `contradicted` when the input names contradicting evidence, and `open` otherwise.

A change is a new revision, never an edit. `update_unknown` takes `expected_revision` and the complete new state. The ledger answers `not-found` for an unknown id and `revision-conflict` when the expected revision is stale. The new revision has `revision` plus one and the old `revision_digest` as its `previous_revision_digest`.

`list_unknowns` filters by `status`, `severity`, and `domain`, and returns the current heads in id order. It returns all of them by default. Give `offset` and `limit` to get one page. The result gives `total` and `next_offset`, which is `null` on the last page.

Every mutation is itself an Evidence record. Its provider is `rea-unknown-registry` version `1` and its predicate type is `rea.residual-unknown-mutation`. Its confidence is `derived` and its authority is `analyst-inference`. It carries one limitation: "Registry mutation evidence records analyst intent, not proof of the answer." The unknown's `mutation_evidence_ids` name those records, so the two ledgers share one hash-linked history.

```figure
id: fig-5-2
kind: structure
title: a ResidualUnknown and its revision chain
claim: An unknown keeps its id across revisions, each revision names the digest of the one before, and each change writes its own Evidence record.
caption: Read left to right. Revision 1 is the unknown that registerFunctionComparisonTool.ts records for the _total comparison in the comparison capture. The right column shows the fields that an update_unknown call changes.
```

## Unknowns that rea opens itself

Agents open unknowns with `record_unknown`, and rea opens some on its own. `compare_functions` records one whenever its status is not `unchanged`. The domain is `function-comparison`. A `changed` comparison gets severity `medium`. Its supporting evidence is the left dossier and the comparison record, and its contradicting evidence is the right dossier, so its first status is `contradicted`.

An `unknown` comparison gets severity `high`, and all three records support it. Each unknown names the comparison in `comparison_conclusion_scope`. A `changed` comparison names its changed dimensions there. An `unknown` comparison names its unknown dimensions and adds the dimension `overall`. Both ask for `shipped-artifact` authority and `observed` confidence, and both recommend one probe: `analyze_function`, with the rationale "Capture complete dossiers for both functions under the same target context."

The capture ran into this rule twice. The `_total` comparison in `10-mcp-21-compare-functions-total.json` was `changed`, so it opened a `medium` unknown with status `contradicted`. The `_percent_change` comparison in `10-mcp-20-compare-functions-percent-change.json` was `unknown` on its references dimension. It opened a `high` unknown with status `open`, scoped to `overall` and `references`.

No file shows either record, because both bundle exports ran before any comparison. Every count in the capture therefore reads `"unknowns": 0` or `"unknown_revisions": 0`. The `rea compare` summary keeps separate counters for unknown history, `unknowns_added`, `unknowns_advanced`, and `unknowns_diverged` (`14-compare-bundles.json`), and all of them are zero for the same reason.

Workflow tools do the same when they cannot finish. The user-visible error catalog at the tag lists the question each one records, for example "Does the reconstruction satisfy every declared claim?" for reconstruction verification. [Lesson 35](phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns) builds the same ledger in Python, with the question as the identity and the required authority as the closing condition.

```takeaways
- Read `relationship_coverage` and `limitations` before you call an empty list "none".
- Record an open question with `record_unknown`, and name the authority that would close it.
- Pass `expected_revision` to `update_unknown`, and reread the unknown after a `revision-conflict`.
- Close an unknown only with `evidence_ids` of observed records, never with a sentence.
```

Sources: capture/out/10-mcp-09-analyze-function-percent-change-O1.json, capture/out/11-inspect-evidence-bundle-O1.json, capture/out/10-mcp-14-export-evidence-bundle-O1.json, capture/out/10-mcp-20-compare-functions-percent-change.json, capture/out/10-mcp-21-compare-functions-total.json, capture/out/14-compare-bundles.json, capture/out/15-js-app-view-summary.json; phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns; rea 6.7.0 at 27dc42d: src/domain/residualUnknown.ts, src/domain/relationshipCoverage.ts, src/domain/evidence.ts, src/application/binary/BinarySession.ts, src/application/investigation/EvidenceLedger.ts, src/application/investigation/UnknownEvidence.ts, src/server/registerSessionRecordTools.ts, src/server/registerFunctionComparisonTool.ts, src/server/recordDerivedEvidence.ts, docs/user-visible-errors.csv; rea docs/ghidra-provider.md, rea docs/tool-design.md, rea docs/mcp-contracts.md
