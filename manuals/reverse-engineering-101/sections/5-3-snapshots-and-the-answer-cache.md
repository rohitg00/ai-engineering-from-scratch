# AnalysisSnapshot and the exact-match answer cache

> A snapshot caches exact answers under a query id bound to the target digest and the profile digest, and the dispatch of one mutating call turns the cache off.

The capture ran `rea function fixtures/ledger-arm64-O1 NAME --provider ghidra` four times, once per function, and each run took between 7.9 and 9.0 seconds ([the capture](manuals/reverse-engineering-101/capture/out/00-commands.txt)). Every run imported the same 33,872 bytes into a fresh Ghidra project and threw the project away. You want the second question about the same file to be free. When you finish this section, you can say which calls a snapshot can answer and build the query id by hand. You can also predict when rea refuses to replay or to save.

## Three things called a snapshot

The word covers three things in rea, and only one of them is a cache you can keep.

**Target snapshot:** the private copy of the input that the Ghidra launcher imports with `-readOnly` and `-deleteProject`. It is deleted when the session closes, and nothing of the analysis survives it. Every new provider session imports the target again into a new temporary project {{mcp Ghidra first-query deadlines and recovery}}.

**Analysis snapshot cache:** the in-memory table of one session, `AnalysisSnapshotCache`, which holds up to 10,000 entries for one target identity. This is the cache this section is about.

**Snapshot file:** the JSON file that `close_binary` writes and `open_binary` reads. It holds the target identity, the provider binding, the cache entries, and the session's Evidence bundle. The CLI documentation says what it is and what it is not. It holds cached observations, not a saved provider database. Only an exact query that qualifies can reuse a result, and a new or live query can still start the provider {{cli Save and reuse analysis snapshots}}.

## The query id

**Query id:** `query_` followed by the SHA-256 of canonical JSON holding four things: the target, the binding, the operation, and the parameters. The target is the path-free identity, `sha256`, `kind`, `format`, and `architecture`. A `raw-binary` target also carries its `entry_point`. The binding is the provider and its analysis profile. For the capture that is the digest that starts `01b5d08b`, `executable`, `mach-o`, `arm64`, Ghidra `12.1.4`, and the profile below.

```listing
title: the Ghidra analysis profile that every cache key carries
source: capture/out/05-analyze-arm64-O1.json
lang: json
note: The profile as the binary_overview record carries it. Twenty of the twenty-five parameters are cut.
---
"upstream_analysis_profile": {
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
    "function_references": "complete-body-and-entry-reference-manager-v2",
    …
    "analyzer_preset": "ghidra-default"
  },
  "digest": "3fc72c9b…"
},
```

The parameters are version strings, one per observation contract that the Ghidra adapter makes. The digest is the SHA-256 of the canonical JSON of provider and parameters. A cache entry matches only when the binding's provider and digest equal the selected profile's. A release that moves `function_references` from `-v2` to `-v3` changes the digest. Every entry made under the old digest then stops matching. That is what exact means in the thesis of this section.

Version 6.7.0 is such a release. For this Mach-O target the parameter list kept its 25 names, and two values moved. `instruction_references` went from `exact-address-incoming-v1` to `exact-address-incoming-without-synthetic-entry-v2`. `function_boundary_observations` went from `ghidra-function-boundary-limitations-v3` to `-v4`. The digest went from `966e6016…` to `3fc72c9b…`, so no 6.5.0 snapshot entry matches a 6.7.0 session. One Ghidra session made all eight rows of the bundle summary, so all of them carry the digest `3fc72c9b…` ([export and import](#s-evidence-bundles-export-and-import)).

## Which calls the cache answers

`isSnapshotCacheable` decides, before any provider runs, whether a call can be answered from the cache. A call qualifies when all of these hold.

- The operation is not one of the stateful ones, `health`, `current_address`, `current_procedure`, `current_document`, `goto_address`, or `list_documents`.
- An operation that is scoped to a document names its `document`.
- An operation that defaults to the cursor, such as `xrefs`, names its `address`.
- The capability declares `mutatesArtifact: false`, a `cachePolicy` other than `live`, and no permission change.
- Its `cachePolicy` is `snapshot`, or it does not write to the file system.

The Ghidra adapter marks every operation except the mutating ones and `list_documents` with `cachePolicy: "snapshot"`. `prepareSessionExecution` computes the id and looks it up. `BinarySession` returns a hit without touching the provider. The replayed answer carries one extra limitation: "Loaded from a local REA analysis snapshot; this call did not re-run the provider.".

The replayed record names the path of the target that is open now. The function `rebindEvidenceToTargetPath` writes that path into the stored record. The `evidence_id` does not change, because the path is outside the hash. On Windows, Ghidra must admit the source file before a replay, so a cache hit can still start the provider.

On a miss the provider runs, and the result is bound to the profile and the target. An Evidence record is then created and recorded, and a cache entry is stored under the id.

The capture shows no replay, because no two of its 25 MCP calls had the same operation and parameters. The first Ghidra-backed call after `open_binary` was `list_procedures`, and it took between 6 and 7 seconds while the headless import ran. Every later analysis call on that target took under 100 ms ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-session.txt)). Those later calls were fast because the bridge was already running, not because of the cache. A repeat of `analyze_function` with `"procedure": "_percent_change"` would have been the first replay.

```figure
id: fig-5-4
kind: decision
title: one analyze_function call through the snapshot cache
claim: A cacheable call becomes a query id over target, binding, operation, and parameters, and a mutating call turns the cache off before it reaches Ghidra.
caption: Read top to bottom. The dashed reply is a replay, and the solid call is a provider run. The dashed amber arrow is the state change that a mutating call makes before its dispatch. Values are from the function capture and the session capture.
```

## Save and load

`close_binary` takes `snapshot_path` and `overwrite`. `closeWithSnapshot` drains the calls in progress, exports the snapshot, writes the file, and closes the provider. Its receipt adds `primitive_entries`, `workflow_entries`, and `evidence_records`. `open_binary` takes `snapshot_path` too, reads the file before it opens the target, and imports the entries into the new session. The capture closed both targets without a path, so its two `close_binary` results are `null` (`10-mcp-15-close-binary-O1.json`, `10-mcp-25-close-binary-O2.json`). On the CLI the flag is `--snapshot`.

An exact cache hit is normally read before rea starts a provider process {{cli Save and reuse analysis snapshots}}. On Windows the Ghidra provider can start first, because it must admit the source file.

Loading a file is a full check. The entries must be in canonical id order, and every query id is recomputed and must match. No id appears twice. Every entry must have an Evidence record in the bundle with the same profile and the same result. A bundle record for another target fails the whole file.

Writing is atomic: the file is staged with mode `0600`, synced, and renamed or hard-linked into place. Importing into a session whose target or profile differs fails with "Analysis snapshot profile_mismatch: target, provider, or analysis profile does not match the active binary".

## Invalidation before a mutating call

Some Ghidra operations write to the session database, such as `annotate_native_function`, which renames a function or adds a comment. Each of them lists `mutates_artifact` in its `effects`, and each carries a limitation that names the consequence.

```listing
title: a mutating operation as binary_session describes it
source: capture/out/10-mcp-04-binary-session.json
lang: json
note: Two of the three limitations are cut.
---
{
  "operations": [
    "annotate_native_function"
  ],
  "effects": [
    "mutates_artifact",
    "launches_process",
    "may_write_filesystem"
  ],
  "limitations": [
    …
    "Metadata edits invalidate immutable analysis snapshots and are discarded on close. CLI returns the updated dossier before session cleanup; this is not a saved Ghidra project."
  ],
  "available": true,
  "reason": null,
  "availability_code": null
}
```

Before rea sends such a call to the provider, `BinarySession` calls `invalidateSnapshot`. The cache is emptied and a flag is set. From then on every lookup returns nothing, every new result is not stored, and an export fails with "Analysis snapshots are unavailable because analysis metadata may have changed". The error adds the way out: export the Evidence with `export_evidence_bundle`, close the target without a snapshot, and reopen it. An import after a mutation is refused the same way.

At 6.7.0 the order is: invalidate, then call the provider. A failed reply cannot prove that the write did not reach Ghidra. So a mutating call that fails also turns the cache off. The 6.4.0 release used the other order and invalidated only after a successful call.

The CLI documentation states the rule. A metadata write clears the snapshot cache of the active session, even when its reply fails. The provider can already have applied the write {{cli Save and reuse analysis snapshots}}.

```takeaways
- Repeat a query with the same parameters to get the cached answer, and read the added limitation.
- Save a snapshot with `close_binary` and `snapshot_path` before you annotate anything.
- Expect a `profile_mismatch` refusal after a rea upgrade, and run the analysis again.
- Treat a snapshot as answers to past questions, never as a saved Ghidra project.
```

Sources: capture/README.md; capture/out/00-commands.txt, capture/out/05-analyze-arm64-O1.json, capture/out/10-mcp-04-binary-session.json, capture/out/10-mcp-09-analyze-function-percent-change-O1.json, capture/out/10-mcp-15-close-binary-O1.json, capture/out/10-mcp-25-close-binary-O2.json, capture/out/10-mcp-session.txt, capture/fixtures/bundle-rea-6.5.0-O1.json; rea 6.7.0 at 27dc42d: src/domain/analysisSnapshot.ts, src/domain/analysisProfile.ts, src/domain/evidence.ts, src/application/binary/AnalysisSnapshotCache.ts, src/application/binary/BinarySession.ts, src/application/binary/BinarySessionExecution.ts, src/application/binary/BinarySessionRecords.ts, src/application/JsonFiles.ts, src/server/registerCloseLifecycleTool.ts, src/server/registerSessionTools.ts, src/ghidra/GhidraLauncher.ts, src/ghidra/GhidraAnalysisProfile.ts, src/ghidra/GhidraProviderCapabilities.ts; rea docs/cli.md, rea docs/mcp-contracts.md
