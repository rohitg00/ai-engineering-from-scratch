# Errors seen in the captures

> Three error envelopes, two unavailability codes, one setup refusal, and two refused conclusions appear in the captures, and every rea error has the same five fields.

The capture kit recorded three calls that failed and kept each reply whole. All three came from rea's own error projection, two from the CLI and one from the MCP server. Other files hold codes that are not errors. They show providers that are not installed, a setup plan that needs a person, and a comparison without a conclusion. This section lists all of them, then the schema they follow.

## The three error envelopes

The CLI printed its envelope to stdout and exited 1 when `inspect-binary-layout` met a Mach-O file on macOS:

```listing
title: capability_unavailable from the CLI
source: capture/out/04-inspect-binary-layout.json
lang: json
note: Nothing is cut. The exit status 1 is in [the command record](manuals/reverse-engineering-101/capture/out/00-commands.txt).
---
{
  "code": "capability_unavailable",
  "category": "unsupported_provider",
  "message": "The initial real-verified pwntools artifact profile supports Linux x64 only.",
  "retryable": false,
  "remediation": {
    "action": "The initial real-verified pwntools artifact profile supports Linux x64 only."
  },
  "details": {
    "provider_id": "pwntools-elf",
    "operation": "inspect_binary_layout",
    "reason": "The initial real-verified pwntools artifact profile supports Linux x64 only."
  }
}
```

Over MCP the same projection travels as text. A failed `tools/call` returns `isError: true` and the `{ "error":... }` object as JSON in `content[0].text`, with no `structuredContent`, because the advertised output schema describes success only {{mcp Tool results}}. The capture kit decoded that text into `decoded_text` beside the raw reply:

```listing
title: invalid_request for a procedure that does not exist
source: capture/out/10-mcp-13-analyze-function-missing.json
lang: json
note: The request and the raw response are cut, and so are most fields of details.diagnostics. The raw response holds the same object as one JSON string. The cut diagnostics hold the Ghidra run id, the bridge endpoint, the launch output, and the remote failure message.
---
  "decoded_text": {
    "error": {
      "code": "invalid_request",
      "category": "invalid_input",
      "message": "Analysis input is invalid. Check the arguments and try again.",
      "retryable": true,
      "remediation": {
        "action": "Correct the listed arguments and retry."
      },
      "details": {
        "operation": "analyze_function",
        "issues": [
          {
            "path": [],
            "reason": "invalid_value",
            "message": "Unknown Ghidra procedure name or address: _nothing"
          }
        ],
        "diagnostics": {
          …
          "configured_jvm_max_heap": "2G",
          …
          "output_incomplete": false,
          …
          "failure_output": {
            …
            "complete": true
          },
          …
          "remote_code": "not_found",
          …
```

The bridge raised `not_found` with the message in `issues[0].message`, and rea mapped a remote `not_found` to `AnalysisInputError`, whose code is `invalid_request`. The server log recorded the failure twice, once for the bridge layer and once for the server layer, both at level 40 ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-server.log)).

The diagnostics tell you whether the Ghidra side can explain a failure. `configured_jvm_max_heap` is the heap that rea gave the JVM, `2G` when neither `GHIDRA_HEADLESS_MAXMEM` nor `GHIDRA_MAXMEM` is set. `failure_output` holds the stdout and stderr that Ghidra wrote during the failed request, empty here, and `complete: true` says that nothing was lost. `output_incomplete: false` says the same for the whole process output. With empty output and a remote code, the failure is in your input and not in the engine.

The CLI refused a bundle that rea 6.5.0 wrote, before it read any record into a session:

```listing
title: evidence_integrity_mismatch for an older bundle
source: capture/out/13-evidence-import-rea-6.5.0.json
lang: json
note: Cut to the head of the envelope. The remediation repeats the message, and the details are cut.
---
{
  "error": "Analysis failed",
  "code": "evidence_integrity_mismatch",
  "category": "integrity_mismatch",
  "message": "Evidence bundle does not match the bundle schema at records.3.evidence_id: Evidence semantic identifier does not match its record. Supply an unmodified bundle written by export_evidence_bundle or rea evidence-export.",
  "retryable": false,
…
```

The bundle was not modified. The id rule changed: the hash now covers `relationship_coverage` also when it is `null`. Records 0 to 2 are `analyze_function` dossiers with a coverage object. Record 3 is a `list_procedures` record with `null` coverage, so its id is the first that fails ([R.2](#s-ref-evidence-fields)). The CLI exited 1. Saved Evidence is not migrated, so regenerate it with the release you run.

A call to a tool that the server does not have never reaches rea's projection. The MCP SDK answers with a JSON-RPC error `-32602` and the message `Tool <name> not found`, with no tool result. The 6.7.0 capture has no such call.

A misspelt CLI command gets the parser envelope `COMMAND_NOT_FOUND` with a `cta` object that suggests the nearest command. `analysisErrorProjectionSchema` does not define them. A script that reads rea errors needs a branch for a misspelt or missing command before it reads `category`. The 6.7.0 capture has no such call either.

## Codes that are not errors

`rea capabilities` lists every provider with an `availability` object. Three providers were absent on the capture host, and their codes name the cause without failing the command:

```listing
title: two unavailable providers
source: capture/out/02-capabilities.json
lang: json
note: The availability objects of hopper and ida. The diagnostics that follow each one are cut, and so is the kuna object, which has the same code as ida.
---
      "availability": {
        "status": "unavailable",
        "code": "executable_missing",
        "reason": "Hopper launcher is missing or not executable: /Applications/Hopper Disassembler.app/Contents/MacOS/hopper",
…
      "availability": {
        "status": "unavailable",
        "code": "not_configured",
        "reason": "Set REA_IDA_MCP_CONFIG to an upstream IDA MCP JSON registration; see docs/ida-provider.md.",
```

`rea setup` on a Claude Code file with a comment returned `status: "needs_human"` and exit 1 ([the capture](manuals/reverse-engineering-101/capture/out/18-setup-claude-jsonc.json), [Section 8.1](#s-the-rea-mcp-server)). It planned no action and reported the registration state `invalid`. It is a setup result and not an error envelope, so a script reads `status` and `remediation`, not `code`.

Two results in the captures refused a conclusion and exited 0. `rea compare` over the two bundles returned `status: "unknown"` with ten unresolved records ([the capture](manuals/reverse-engineering-101/capture/out/14-compare-bundles.json), [Section 5.5](#s-compare-and-compare-functions)). No record is a member of both bundles, and a bundle carries no completeness marker. `verify_reconstruction` returned `status: "fail"` with two failed claims ([the capture](manuals/reverse-engineering-101/capture/out/10-mcp-22-verify-reconstruction.json), [Section 7.1](#s-verify-reconstruction)). Neither is an error envelope, and both are results that say the question stays open or the claim is false. A script that treats a non-zero exit as the only failure signal misses both.

## The shape every rea error has

| Field | Meaning |
| --- | --- |
| `code` | the discriminator, one of 20 codes listed below |
| `category` | one of ten: `invalid_input`, `unsupported_provider`, `unsupported_target`, `integrity_mismatch`, `truncated`, `cancelled`, `timeout`, `resource_constraint`, `unavailable`, `execution_failure` |
| `message` | one plain sentence for a person, with provider names and internal reasons removed |
| `retryable` | true for `artifact_changed`, `invalid_request`, `provider_timeout`, `cancelled`, `revision_conflict`, and `provider_unavailable`, for a `capability_unavailable` error that the provider marks retryable, and for a `resource_constraint` error that is marked retryable, or that is about capacity when it has no mark |
| `remediation.action` | one sentence that says what to do |
| `details` | optional, free JSON for generic codes, and a fixed object with `logical_path`, `declared_sha256`, `calculated_sha256`, and `unpacked` for `artifact_integrity_mismatch` |

The 20 codes are `invalid_request`, `access_denied`, `artifact_changed`, `unreadable_output`, `capability_unavailable`, `unsupported_target`, `provider_unavailable`, `provider_timeout`, `resource_constraint`, `cancelled`, `artifact_integrity_mismatch`, `artifact_operation_failed`, `evidence_integrity_mismatch`, `truncated`, `process_capture_failed`, `cleanup_incomplete`, `revision_conflict`, `configuration_invalid`, `target_unavailable`, and `execution_failure`. Each internal error class maps to one code. `AnalysisInputError` maps to `invalid_request`, `AnalysisCapabilityUnavailableError` to `capability_unavailable`, `AnalysisTimeoutError` to `provider_timeout`, and `ConfigurationError` to `configuration_invalid`. `NoBinaryOpenError` maps to `target_unavailable`, and `ProviderAdapterError` to `execution_failure`. A failure whose cleanup left owned resources behind takes the code `cleanup_incomplete` whatever the underlying code was, and lists them in `details`. The rea docs publish the same union as a JSON Schema, `error-contract.schema.json`.

Two codes deserve a note for the Ghidra provider. `provider_timeout` is what the first Ghidra-backed call returns when the startup deadline of [Section 8.1](#s-the-rea-mcp-server) passes. `target_unavailable` is what every provider tool returns before `open_binary`, with the message "No app is open. Ask the user which app to investigate, then call open_binary with its local path.". Neither appeared in the captures, because the kit set a long client deadline and opened a target first.

Sources: capture/out/04-inspect-binary-layout.json, 10-mcp-13-analyze-function-missing.json, 13-evidence-import-rea-6.5.0.json, 18-setup-claude-jsonc.json, 02-capabilities.json, 14-compare-bundles.json, 10-mcp-22-verify-reconstruction.json, 10-mcp-server.log, 00-commands.txt; rea docs/mcp-contracts.md (Tool results); rea at 27dc42d: src/contracts/errorSchemas.ts, src/domain/analysisErrorProjection.ts, src/domain/analysisErrorPresentation.ts, src/domain/configurationErrors.ts, src/ghidra/GhidraProviderClient.ts, src/ghidra/GhidraDiagnostics.ts, src/ghidra/GhidraClient.ts, src/ghidra/GhidraJavaLaunch.ts, src/domain/evidence.ts, bridge/ghidra/ReaGhidraBridge.java, docs/user-visible-errors.csv, docs/error-contract.schema.json
