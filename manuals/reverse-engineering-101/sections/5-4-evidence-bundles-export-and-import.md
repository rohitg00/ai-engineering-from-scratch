# export_evidence_bundle, evidence-export, and evidence-import

> An Evidence bundle is seven sorted arrays in canonical JSON, so the same records give the same bytes from the MCP server and from the CLI.

Your agent's MCP connection closes tonight, and with it the eight records it collected on `ledger-arm64-O1`. Tomorrow a colleague wants to check them on another Mac, without Ghidra. When you finish this section, you can export a session to a bundle and read its summary without an engine. You can also import it into a new session or a CLI check.

## export_evidence_bundle

**Evidence bundle:** one JSON object with seven arrays. They are `artifacts`, `providers`, `environments`, `scenarios`, `captures`, `unknowns`, and `records`. The first five are built from the records themselves. They hold the distinct subjects as digest, format, and architecture, the distinct providers, and the distinct environments. Then come the controlled-replay records and the process-capture records. Records are sorted by `evidence_id`, and the order carries no meaning.

The MCP tool takes a `path` and an `overwrite` flag. It answers with the path, the byte count, and the record and unknown counts.

```listing
title: export_evidence_bundle after eight calls on ledger-arm64-O1
source: capture/out/10-mcp-14-export-evidence-bundle-O1.json
lang: json
note: The request and the text copy of the result are cut.
---
"structuredContent": {
  "result": {
    "path": "$WORK/bundle-O1.json",
    "bytes": 178853,
    "records": 8,
    "unknowns": 0
  }
}
```

The write is canonical and atomic. `writeEvidenceBundle` validates the bundle again and streams canonical JSON parts. `writeTextParts` creates a staging file with `wx` and mode `0600` and syncs it. It then renames the file over the destination when `overwrite` is true, or hard-links it when the destination must not exist. The contract says the same: a complete bundle export streams canonical JSON into a file that appears in one atomic step {{mcp Tool results}}.

The capture copied the file the server wrote to `11-bundle-O1.json`, with the capture directory masked and a newline added. Its seven arrays hold one artifact, one provider, no environments, no scenarios, no captures, no unknowns, and eight records.

```listing
title: the two bundle files of the capture
source: capture/out/11-bundles.txt
lang: text
note: Nothing is cut.
---
94fca3db…  178398  11-bundle-O1.json (the bytes export_evidence_bundle wrote, with the capture path masked and a newline added)
6130b135…  286433  11-bundle-O2.json (the bytes export_evidence_bundle wrote, with the capture path masked and a newline added)
```

## inspect-evidence-bundle

You do not need rea's engine, or a session, to read a bundle. `rea inspect-evidence-bundle` takes a JSON argument with `path`, `detail`, and optional `filters` and prints one row per record without the payloads. The MCP tool `get_evidence_bundle` shares the projection for the records of a live session.

```listing
title: the summary of bundle O1, the first row and the first dossier row
source: capture/out/11-inspect-evidence-bundle-O1.json
lang: json
note: The subject and provider of each row, the second row, and the last five rows are cut.
---
{
  "kind": "evidence-bundle-summary",
  "filters": {},
  "total_retained_records": 8,
  "matching_records": 8,
  "unknown_revisions": 0,
  "records": [
    {
      "evidence_id": "ev_2c883c7b…",
      …
      "operation": "procedure_assembly",
      …
      "limitation_count": 6,
      "native_dossier": {
        "available": false,
        "reason": "different-operation"
      }
    },
    …
    {
      "evidence_id": "ev_41e8ca1c…",
      …
      "operation": "analyze_function",
      "confidence": "observed",
      "authority": "shipped-artifact",
      "analysis_profile_digest": "3fc72c9b…",
      "retention": "complete-record",
      "limitation_count": 10,
      "native_dossier": {
        "available": true,
        "procedure_address": "0x100000518",
        "procedure_name": "_grade",
        …
```

The rows are in `evidence_id` order, so the first row is the `procedure_assembly` record and the `_grade` dossier is the third. A row that is not a dossier reports `native_dossier` as unavailable, with the reason `different-operation`. The eight rows name four `analyze_function` dossiers, `_percent_change`, `_grade`, `_total`, and `_grade_label`, and one record each for `list_procedures`, `procedure_assembly`, `xrefs`, and `list_strings`. Every row carries the same profile digest, `3fc72c9b…`, because one Ghidra session produced them all. The O2 bundle has two rows, the `_total` and `_percent_change` dossiers of the -O2 build (`11-inspect-evidence-bundle-O2.json`).

The contract names the filters a summary accepts. The optional `filters` match an exact `evidence_id`, `operation`, `target_sha256`, `analysis_profile_digest`, or `procedure_address` {{mcp Tool results}}.

## evidence-export and evidence-import on the CLI

`rea evidence-export SOURCE OUTPUT` reads a bundle, validates it, and writes it again in canonical form. The answer is the path, the byte count, and the record count. The capture exported `11-bundle-O1.json` to a work file and compared the digests.

```listing
title: the MCP export and the CLI export of the same records
source: capture/out/12-evidence-export.txt
lang: text
note: Nothing is cut.
---
94fca3db…  178398  export_evidence_bundle over MCP, out/11-bundle-O1.json
47160c2d…  178397  evidence-export over the CLI, $WORK/canonical-O1.json
same bytes as the MCP export: no
same JSON content as the MCP export: yes
```

The one byte of difference is the newline the kit appended to its copy. Strip it, and the copy has 178,397 bytes and the digest `47160c2d`, the digest of the CLI file. The MCP server and the CLI write the same canonical bytes for the same records, which is what the thesis of this section promised.

`rea evidence-import PATH` validates a bundle and reports its counts. On the CLI there is no session, so `imported` and `total` are both the number of records in the file: `{"imported": 8, "unknowns_added": 0, "total": 8}` in `13-evidence-import.json`. The CLI documentation draws the line: separate CLI calls read the full saved records {{cli Import, export and compare Evidence}}.

## import_evidence_bundle into a live session

In MCP the same verb merges into the connection's ledger. The handler reads and validates the file, calls `importEvidenceBundle`, and answers with the records added, the unknown revisions added, and the new total. The ledger adds each record it does not hold and keeps a record it already holds. It refuses a record whose id it holds with different content: "Conflicting evidence record".

```listing
title: bundle O1 imported into the session that analysed O2
source: capture/out/10-mcp-23-import-evidence-bundle-O1.json
lang: json
note: The request and the text copy of the result are cut.
---
"result": {
  "imported": 6,
  "unknowns_added": 0,
  "total": 15
}
```

Six of eight, and a total of fifteen. The session had closed O1 before, and `close_binary` empties the ledger, even when no binary is open {{mcp Retained application Evidence inputs}}. Opening another target or restarting the current target keeps the records.

So the O1 records were gone when O2 opened. Then `compare_functions` ran twice, with the O1 dossiers of `_percent_change` and `_total` passed inline. The tool records both sides before its own result. Those two O1 records were back in the ledger, so the import added the other six.

The fifteen are the six new records and nine that were already there:

- The two O2 dossiers, from calls 17 and 18.
- The two O1 dossiers that the comparisons recorded as their sources.
- The two comparison records, from calls 20 and 21.
- The `verify_reconstruction` record, from call 22.
- The two mutation records of the unknowns that the two comparisons opened ([residual unknowns](#s-residual-unknowns-and-coverage)).

[Figure](#fig-5-5) follows the bundle from the session to its four readers.

```figure
id: fig-5-5
kind: flow
title: one bundle from the MCP session to four readers
claim: One canonical file leaves the session, and the CLI summary, the CLI export, the CLI import, and a second MCP session all read it without Ghidra.
caption: Read left to right. Solid teal is a durable write, solid ink a call. From capture/out/10-mcp-14-export-evidence-bundle-O1.json, 11-bundles.txt, 11-inspect-evidence-bundle-O1.json, 12-evidence-export.txt, 13-evidence-import.json, and 10-mcp-23-import-evidence-bundle-O1.json.
```

## A bundle from an earlier release

The release that reads a bundle checks every id with its own hash rule. The kit kept the O1 bundle that rea 6.5.0 wrote for this manual, and gave it to `rea evidence-import` at 6.7.0. The import stopped with exit code 1.

```listing
title: rea 6.7.0 refuses the O1 bundle of rea 6.5.0
source: capture/out/13-evidence-import-rea-6.5.0.json
lang: json
note: The remediation and the details are cut.
---
{
  "error": "Analysis failed",
  "code": "evidence_integrity_mismatch",
  "category": "integrity_mismatch",
  "message": "Evidence bundle does not match the bundle schema at records.3.evidence_id: Evidence semantic identifier does not match its record. Supply an unmodified bundle written by export_evidence_bundle or rea evidence-export.",
  "retryable": false,
  …
}
```

The bundle bytes are the bytes that 6.5.0 wrote. Release 6.5.0 left a `null` `relationship_coverage` out of the semantic projection, and 6.7.0 hashes it as `null` ([the Evidence record](#s-the-evidence-record)). Records 0 to 2 of the old bundle are `analyze_function` dossiers with coverage, and their ids still verify. Record 3 is the `list_procedures` record, the first one with `null` coverage, so it is the first id that fails.

The error is not retryable, and rea does not migrate saved Evidence. Keep the rea version with every bundle you archive, so that you can read the bundle again with that version. To use old evidence with a new release, run the analysis again with that release and export a new bundle.

```takeaways
- Export a bundle before `close_binary`, because closing empties the ledger.
- Read a bundle with `rea inspect-evidence-bundle` before you import it anywhere.
- Compare bundle digests, never file names, when two people exchange evidence.
- Expect `imported` below the record count when the session already holds some of the records.
- Archive the rea version with each bundle, and regenerate evidence after an upgrade.
```

Sources: capture/README.md; capture/out/10-mcp-14-export-evidence-bundle-O1.json, capture/out/10-mcp-23-import-evidence-bundle-O1.json, capture/out/11-bundle-O1.json, capture/out/11-bundles.txt, capture/out/11-inspect-evidence-bundle-O1.json, capture/out/11-inspect-evidence-bundle-O2.json, capture/out/12-evidence-export.json, capture/out/12-evidence-export.txt, capture/out/13-evidence-import.json, capture/out/13-evidence-import-rea-6.5.0.json, capture/fixtures/bundle-rea-6.5.0-O1.json; rea 6.7.0 at 27dc42d: src/domain/evidenceBundle.ts, src/server/registerSessionRecordTools.ts, src/application/EvidenceBundleFiles.ts, src/application/EvidenceBundleCommands.ts, src/application/JsonFiles.ts, src/cliEvidenceCommands.ts, src/cli/analysisViewCommands.ts, src/application/investigation/EvidenceLedger.ts, src/server/registerFunctionComparisonTool.ts, src/server/sessionEvidence.ts; rea docs/mcp-contracts.md, rea docs/cli.md
