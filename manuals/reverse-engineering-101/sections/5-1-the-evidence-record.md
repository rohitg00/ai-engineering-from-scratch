# The Evidence record

> Every successful rea observation is one strict record of sixteen fields, and its id is a SHA-256 over the semantic content with the file path left outside.

An agent tells you that `_percent_change` returns 0 when `before` is 0. You want to know what rea observed, which engine said it, and whether the same claim from another machine would carry the same id. The capture holds the answer in [one Evidence record](manuals/reverse-engineering-101/capture/out/10-mcp-09-analyze-function-percent-change-O1.json). When you finish this section, you can read all sixteen fields of an Evidence record and say which three carry the trust decision. You can also recompute an `ev_` id from a captured record.

## One record for every successful observation

**Evidence record:** the one record type that rea returns for a successful observation. The schema is one strict object with sixteen fields. A record with an extra field is rejected, and so is a record that omits a field. An operation without caller or callee sets still writes `relationship_coverage`, with the value `null`. The MCP server returns the full canonical record twice, as `structuredContent` and as a text copy {{mcp Tool results}}.

```listing
title: the sixteen fields of the _percent_change dossier record
source: capture/out/10-mcp-09-analyze-function-percent-change-O1.json
lang: json
note: The profile parameters, the raw result, the normalized result, nine of the ten limitations, and the coverage diagnostics are cut. The kit replaced the text copy of the record with a marker.
---
"evidence_id": "ev_b492c85eb9570bd5f8e866f94523122c8600ea0106603d90e9ea5445cf757b2a",
"subject": {
  "name": "ledger-arm64-O1",
  "digest": {
    "sha256": "01b5d08b08fb94678be5919d0e753d44b505a53107c95b94634f0e5d41c9e375"
  },
  "format": "mach-o",
  "architecture": "arm64",
  "local_path": "$CAPTURE/fixtures/ledger-arm64-O1"
},
"provider": {
  "id": "ghidra",
  "name": "Ghidra",
  "version": "12.1.4"
},
"analysis_profile": {
  …
  "digest": "3fc72c9b4b78498fb992b938f8f3389dc670244a293c1d40abf5e1d10162ed3b"
},
"predicate_type": "rea.analysis",
"operation": "analyze_function",
"parameters": {
  "procedure": "_percent_change"
},
"raw_result": {
  …
},
"normalized_result": {
  …
},
"confidence": "observed",
"authority": "shipped-artifact",
"environment": null,
"limitations": [
  "The session serves operations only after Ghidra reports default auto-analysis complete; incomplete analysis does not expose partial results.",
  …
],
"relationship_coverage": {
  "status": "complete",
  …
},
"locations": [],
"evidence_links": []
```

| Field | In this record | What it holds |
|---|---|---|
| `evidence_id` | `ev_b492c85eb957` and 52 more hex digits | `ev_` and a SHA-256 |
| `subject` | `ledger-arm64-O1`, sha256 `01b5d08b08fb`, `mach-o`, `arm64`, a path | the analysed file, or `null` |
| `provider` | `ghidra`, Ghidra, `12.1.4` | the engine that produced the fact |
| `analysis_profile` | digest `3fc72c9b4b7` | the committed engine settings, or `null` |
| `predicate_type` | `rea.analysis` | the kind of claim |
| `operation` | `analyze_function` | the tool that produced the record |
| `parameters` | `{"procedure": "_percent_change"}` | the caller input, as given |
| `raw_result` | the Ghidra report | the provider form, or `null` |
| `normalized_result` | the dossier, 16 keys | the canonical result the agent reads |
| `confidence` | `observed` | `observed`, `derived`, or `inferred` |
| `authority` | `shipped-artifact` | one of five source kinds |
| `environment` | `null` | platform and isolation of a run, or `null` |
| `limitations` | 10 strings | what the fact does not cover |
| `relationship_coverage` | `complete` | whether the caller and callee sets are complete, partial, or unknown, or `null` for other operations |
| `locations` | `[]` | addresses, ranges, paths, or file offsets |
| `evidence_links` | `[]` | the `ev_` ids this record derives from |

The subject `format` is one of 28 container names, from `mach-o` and `elf` to `javascript` and `directory`. The architecture is one of ten families: `x86`, `x86_64`, `arm`, `arm64`, `mips`, `6502`, `riscv`, `powerpc`, `m68k`, and `hexagon`. Only the `raw-binary` format can have the architecture `6502` or `m68k`. A location has one of five shapes: `address`, `address-range`, `artifact-path`, `file-offset`, or `file-offset-range`.

The MCP handler can run a preflight check before the engine starts. It builds the record after the engine answers. It calls `createEvidence` with the active target, the provider, and the operation. The same call passes the parameters, the result, the profile, the raw result, the limitations, the locations, and the links.

Some tools give a reduced parameter set to the record. The handler records any source records first, then this record, then returns it. Inside a Ghidra session, the binary session makes the same call.

Three defaults fill in what a producer leaves out. When the producer names no confidence or authority, the record gets `observed` and `shipped-artifact`. The subject name is the last segment of the path. When there is no target at all, the record gets the limitation "Artifact identity is unavailable for this observation.".

## Confidence and authority

**Confidence:** one of three words, `observed`, `derived`, or `inferred`. It is a category, never a number. **Authority:** the kind of source behind the fact, one of `shipped-artifact`, `controlled-replay`, `historical-reference`, `external-service`, or `analyst-inference`. The two fields are set by the producer, and the captures show four producers.

| Producer | `confidence` | `authority` | Record |
|---|---|---|---|
| `analyze_function`, provider `ghidra` | `observed` | `shipped-artifact` | `10-mcp-09-analyze-function-percent-change-O1.json` |
| `binary_overview`, provider `rea-workflow` | `derived` | `shipped-artifact` | `05-analyze-arm64-O1.json` |
| `compare_functions`, provider `rea-function-comparison` | `derived` | `analyst-inference` | `10-mcp-20-compare-functions-percent-change.json` |
| `inspect_analysis_view`, provider `rea-analysis-view` | `derived` | `shipped-artifact` | `15-js-app-view-summary.json` |
| `record_unknown`, provider `rea-unknown-registry` | `derived` | `analyst-inference` | none in the capture |

Read `observed` with care. In the dossier it means that rea recorded what Ghidra returned, with the bytes on disk as the authority. It does not mean that the pseudocode is the program's source. The provider documentation says so. The assembly is the full Ghidra Listing text, and the pseudocode is what the Ghidra decompiler produced {{ghidra Admitted function-analysis semantics}}.

The `binary_overview` record is `derived`, because a rea workflow computed it from provider calls. Its first limitation says so: "Derived by an REA composed workflow." The other eight are the Ghidra limitations it inherits. Each one starts with the provider, its version, and the operation, for example "Ghidra (ghidra 12.1.4) read_binary_inventory_summary:" (`05-analyze-arm64-O1.json`). [Lesson 35](phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns) builds a ledger in plain Python with the same three words and the same five authorities.

## Limitations, locations, and links

`limitations` is an array of plain strings, and a producer appends its own to the ones it inherits. The comparison record shows both kinds. Its first entry is the automatic one for a record without a subject. The next 26 are the dossier limitations of both sides, each prefixed with `Left:` or `Right:`.

```listing
title: the trust fields of the compare_functions record
source: capture/out/10-mcp-20-compare-functions-percent-change.json
lang: json
note: Of the 27 limitations, the first two are shown.
---
"confidence": "derived",
"authority": "analyst-inference",
"environment": null,
"limitations": [
  "Artifact identity is unavailable for this observation.",
  "Left: Cancelling an active Ghidra request terminates its ephemeral database and discards session annotations. The selected target remains open; the next provider query imports the original artifact again.",
  …
],
"locations": [],
"evidence_links": [
  "ev_b492c85eb9570bd5f8e866f94523122c8600ea0106603d90e9ea5445cf757b2a",
  "ev_142cc943d8259d42ce5d62ad5eb0417fcde4de4ee9a20afbfe1fdbc51ed3d259"
]
```

`evidence_links` names the records a derived record was computed from. The comparison links the two dossiers it compared, and a view links its parent record. `locations` says where in the artifact the fact was seen. The JavaScript record in `15-js-app.json` carries one `artifact-path` location, `artifact-root`. The Ghidra dossier carries none, because its addresses live inside `normalized_result`.

`analysis_profile` is part of the identity even when it is empty. The field is always present, as a profile object or as `null`, and both values count toward the identity of the record {{mcp Tool results}}.

A profile whose provider differs from the record's `provider` is rejected with "Analysis profile provider does not match Evidence provider". The profile digest is a SHA-256 over the canonical JSON of its provider and parameters. [The snapshot cache](#s-snapshots-and-the-answer-cache) uses the same digest as part of its key.

## The id is a hash of the semantic content

**Semantic projection:** the view of the record that the id hashes. It keeps `subject.digest`, `subject.format`, and `subject.architecture`, and it drops `subject.name` and `subject.local_path`. Every other field enters as it is, `relationship_coverage` too when its value is `null`. Release 6.5.0 left a `null` coverage field out of the hash. Release 6.7.0 therefore refuses the id of such a record in a 6.5.0 bundle ([export and import](#s-evidence-bundles-export-and-import)).

The id is `ev_` followed by the SHA-256 of that projection in canonical JSON. Object keys are sorted as RFC 8785 requires. `parseEvidence` recomputes the hash on every record it reads and rejects a mismatch with "Evidence semantic identifier does not match its record".

You can do the same check with a few lines of Node. The script below sorts keys, serializes without spaces, drops the two display fields, and hashes. Give it a bundle file and a record index to check one record of a bundle.

```javascript
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const canonical = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
};

const file = JSON.parse(readFileSync(process.argv[2], "utf8"));
const pick = (value, index) => {
  if (value.response) return value.response.result.structuredContent;
  if (value.records) return value.records[index];
  return value;
};
const record = pick(file, Number(process.argv[3] ?? 0));
const { evidence_id, subject, ...rest } = record;
const projection = {
  subject: subject === null ? null : { digest: subject.digest, format: subject.format, architecture: subject.architecture },
  ...rest,
};
const digest = createHash("sha256").update(canonical(projection)).digest("hex");
console.log(evidence_id, evidence_id === `ev_${digest}` ? "match" : "mismatch");
```

Run on `05-analyze-arm64-O1.json`, it prints `ev_91bddcdbd53ddd56996c6009458495bbd91fdc8c885238b33432e67691cf1f06 match`, the id on line 2 of that file. Run on `10-mcp-09-analyze-function-percent-change-O1.json`, it matches `ev_b492c85eb9570bd5f8e866f94523122c8600ea0106603d90e9ea5445cf757b2a`. It also matches the comparison record in `10-mcp-20` and, with the index 0, the first record inside `11-bundle-O1.json`. The masked `$CAPTURE` path in `subject.local_path` changes nothing, because that field is outside the hash.

Two files in the capture do not match, and both teach the same rule. `15-js-app.json` fails because the kit cut `graph` and `semantic_graph` out of `normalized_result` with `--filter-output`. `15-js-app-view-summary.json` fails because the kit masked the capture directory as `$CAPTURE` inside `normalized_result.summary.input_path` and inside `locations`. A path in `subject` is outside the hash. A path anywhere else is inside it, and a record that carries one gets a different id on every machine.

```figure
id: fig-5-1
kind: structure
title: the sixteen fields of one Evidence record
claim: The id hashes every field of the record except subject.name and subject.local_path, so the same observation of the same bytes gets the same id anywhere.
caption: Read top to bottom. Solid rows enter the hash and dashed rows are display fields. Values are from the function capture, digests shown by their first hex digits.
```

The [Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler?symbols=off) machine files each stage of one decompilation in an evidence ledger. The ledger uses the same three confidence words and adds a tray for unknowns. This link opens the run with the symbol table switched off, so you can watch which facts move from observed to unknown.

```takeaways
- Read `confidence`, `authority`, and `limitations` before `normalized_result`, and copy all three into your notes.
- Treat `observed` as "rea recorded the engine output", never as "the source was recovered".
- Recompute the `ev_` id of every record you receive from another machine.
- Keep paths out of `normalized_result` and `locations` in your own records, or the id changes per machine.
```

Sources: capture/out/10-mcp-09-analyze-function-percent-change-O1.json, capture/out/10-mcp-20-compare-functions-percent-change.json, capture/out/05-analyze-arm64-O1.json, capture/out/15-js-app.json, capture/out/15-js-app-view-summary.json, capture/out/11-bundle-O1.json; phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns; rea 6.7.0 at 27dc42d: src/domain/evidence.ts, src/domain/relationshipCoverage.ts, src/domain/canonicalDigest.ts, src/domain/analysisProfile.ts, src/domain/binaryTargetTypes.ts, src/server/registerEvidenceTools.ts, src/application/binary/BinarySession.ts, src/application/investigation/UnknownEvidence.ts; rea docs/mcp-contracts.md, rea docs/ghidra-provider.md; the Inside a Decompiler machine: scripts/decompiler-machine/model.mjs
