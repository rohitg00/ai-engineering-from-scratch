# Evidence fields

> The 16 fields of every Evidence record at 6.7.0, with their types, their allowed values, and one value each from the captured dossier of _percent_change.

The Evidence schema is one strict Zod object with 16 fields. The schema rejects a record with an unknown field. `relationship_coverage` is the sixteenth field. A record must carry it, as an object or as `null`, and the id hash covers it in both cases.

The dossier column takes its values from the `analyze_function` record of `_percent_change` in `ledger-arm64-O1`, `ev_b492c85e` ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-09-analyze-function-percent-change-O1.json)). The derived column takes them from the `verify_reconstruction` record `ev_ccbaea4b` ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-22-verify-reconstruction.json)). [Section 5.1](#s-the-evidence-record) reads the record in prose.

## The 16 fields

| Field | Type | In the dossier of _percent_change | In the verification record |
|---|---|---|---|
| `evidence_id` | `ev_` and 64 hex digits, the SHA-256 of the semantic projection | `ev_b492c85eb9570bd5f8e866f94523122c8600ea0106603d90e9ea5445cf757b2a` | `ev_ccbaea4b45697017422c68a0dcabbe574c7e1b498aa3f0f3a0b47e351b389e23` |
| `subject` | the analyzed file, `{ name, digest.sha256, format, architecture, local_path }`, or `null` | `ledger-arm64-O1`, `01b5d08b…`, `mach-o`, `arm64`, `$CAPTURE/fixtures/ledger-arm64-O1` | `null` |
| `provider` | `{ id, name, version }`, version nullable | `ghidra`, `Ghidra`, `12.1.4` | `rea-reconstruction-verifier`, `REA reconstruction verifier`, `1` |
| `analysis_profile` | `{ provider, parameters, digest }` or `null`, always present | 25 parameters, digest `3fc72c9b…` | `null` |
| `predicate_type` | a non-empty string | `rea.analysis` | `rea.reconstruction-verification` |
| `operation` | the tool name | `analyze_function` | `verify_reconstruction` |
| `parameters` | the caller's input object | `{ "procedure": "_percent_change" }` | `specification_sha256` and four `claim_ids` |
| `raw_result` | a provider-native value or `null` | the bridge value with `procedure`, `pseudocode`, and the rest | `null` |
| `normalized_result` | the canonical result the reader uses | 16 keys from `procedure` to `limitations` | `status`, `specification_sha256`, `summary`, `claims`, `recommended_probes`, `evidence_links`, `limitations` |
| `confidence` | `observed`, `derived`, or `inferred` | `observed` | `derived` |
| `authority` | one of five values, listed below | `shipped-artifact` | `analyst-inference` |
| `environment` | `{ id, platform, architecture, isolation }` or `null` | `null` | `null` |
| `limitations` | an array of strings | ten strings, from auto-analysis to the macOS decompiler | two strings, artifact identity and the pass rule |
| `relationship_coverage` | `{ status, ... }` with status `complete`, `partial`, or `unknown`, or `null` | `complete`, with one diagnostic about resolved call references | `null` |
| `locations` | an array of five location shapes, listed below | `[]` | `[]` |
| `evidence_links` | `ev_` ids this record was derived from | `[]` | six ids: four dossiers and two comparisons |

The `normalized_result` of a dossier has the keys `procedure`, `pseudocode`, `assembly`, `comments`, `callers`, `callees`, `incoming_references`, `outgoing_references`, `unresolved_calls`, `referenced_strings`, `referenced_names`, `basic_blocks`, `native_api`, `native_value_flow`, `facet_availability`, and `limitations`. `facet_availability` tells which of eight facets the provider supplied. Those inner limitations describe the facets, and the record's own `limitations` describe the provider session.

## The enumerations

| Field | Allowed values |
| --- | --- |
| `confidence` | `observed`, `derived`, `inferred` |
| `authority` | `shipped-artifact`, `controlled-replay`, `historical-reference`, `external-service`, `analyst-inference` |
| `environment.isolation` | `none`, `process`, `container`, `virtual-machine` |
| `locations[].kind` | `address` with `address`, `address-range` with `start` and `end`, `artifact-path` with `path`, `file-offset` with `offset`, `file-offset-range` with `start` and `end` |
| `subject.format` | `hopper`, `analysis-database`, `mach-o`, `elf`, `pe`, `dos-mz`, `dos-com`, `raw-binary`, `zip`, `ipa`, `apk`, `msix`, `appx`, `hap`, `hsp`, `app-pack`, `asar`, `dmg`, `pkg`, `plist`, `javascript`, `source-map`, `directory`, `file`, `unknown`, `mach-o-universal`, `javascript-bundle`, `entitlements` |
| `subject.architecture` | `x86`, `x86_64`, `arm`, `arm64`, `mips`, `riscv`, `powerpc`, `hexagon`, or `null`, and `6502` or `m68k` for a `raw-binary` subject only |

The format owns the architecture claim. rea knows ten families. `6502` and `m68k` are raw-only, because header detection never reports them. A `raw-binary` subject can have any of the ten, and every other format excludes those two. `hexagon` comes from an ELF header.

## The id

The id hashes the semantic projection of the record. That projection keeps the subject's `digest`, `format`, and `architecture` and every other field except `evidence_id`, and leaves out the subject's `name` and `local_path`. The same observation of the same bytes therefore gets the same id in any directory on any machine. The capture check compares ids unmasked ([the capture](manuals/reverse-engineering-101/capture/README.md)). `parseEvidence` recomputes the hash of every record it reads and rejects a mismatch. A record without a subject gets the limitation "Artifact identity is unavailable for this observation." appended at creation.

The projection keeps `relationship_coverage` also when it is `null`. An earlier release left a `null` coverage out of the hash, so its records fail this check. `evidence-import` refuses such a bundle with `evidence_integrity_mismatch` ([the capture](manuals/reverse-engineering-101/capture/out/13-evidence-import-rea-6.5.0.json)). Regenerate saved Evidence with the release you run.

Two other id prefixes appear in the captures. `unk_` ids name residual unknowns and hash `{ domain, question, scope_digest }`, and `comparison_conclusion_scope` when the unknown has one ([Section 5.2](#s-residual-unknowns-and-coverage)). The `analysis_profile.digest` is the SHA-256 of the canonical JSON of the provider and its parameters. Two records with different digests are not comparable in `compare_functions`.

Sources: capture/out/10-mcp-09-analyze-function-percent-change-O1.json, 10-mcp-22-verify-reconstruction.json, 13-evidence-import-rea-6.5.0.json; capture/README.md; rea at 27dc42d: src/domain/evidence.ts, src/domain/relationshipCoverage.ts, src/domain/binaryTargetTypes.ts, src/domain/elfFixedHeader.ts, src/domain/residualUnknown.ts, src/domain/analysisProfile.ts
