# Glossary

> Each term below has one meaning across the manual and names the section that defines it.

Every term is defined once, in the section the last column names, with the sources that section cites. The meanings below come from the rea source at the tag, its documentation, the specifications, and the captures.

| Term | Meaning in this manual | Defined in |
|---|---|---|
| Analysis profile | The provider's committed settings, hashed over RFC 8785 canonical JSON, so a changed contract version changes the digest | [1.2](#s-rea-function-end-to-end) |
| Analysis snapshot cache | The in-memory table of one session that holds up to 10,000 cached answers for one target identity | [5.3](#s-snapshots-and-the-answer-cache) |
| Application graph | The provider-neutral model of a JavaScript application as nodes and directed edges, built from syntax alone, with an evidence block on every edge | [6.1](#s-analyze-javascript-application) |
| Artifact graph | The inventory rea builds of one file and the files inside it: a node per distinct content by SHA-256, an occurrence per place, and an edge from container to member | [3.1](#s-inspect-artifact) |
| Authority | The kind of source behind a fact: `shipped-artifact`, `controlled-replay`, `historical-reference`, `external-service`, or `analyst-inference` | [5.1](#s-the-evidence-record) |
| Basic block | A run of instructions with one entry at the top and one exit at the bottom | [4.3](#s-procedure-assembly) |
| Basic blocks | The `basic_blocks` list of a dossier, with exclusive end addresses | [1.2](#s-rea-function-end-to-end) |
| Bridge | `ReaGhidraBridge.java`, the Ghidra post-script that serves one JSON line per request on a Unix socket | [1.1](#s-rea-providers-and-evidence) |
| Capability | One group of operations that share an `available` flag, a reason and code when unavailable, the effects that are true out of seven, and limitations | [2.3](#s-rea-capabilities) |
| Circumvention | Under 17 U.S.C. 1201(a)(3)(A), to avoid, bypass, remove, deactivate, or impair a technological measure without the authority of the copyright owner | [2.1](#s-the-readme-use-rule-and-the-law) |
| Claim status | `pass`, `fail`, or `unknown` for one claim of `verify_reconstruction`, from authority limitations, the observed status, and open unknowns, in that order | [7.1](#s-verify-reconstruction) |
| Composed operation | A rea operation built from other operations, with provider `rea-workflow` and `confidence: "derived"` | [3.4](#s-analyze-overview) |
| Confidence | One of three words, `observed`, `derived`, or `inferred`, never a number | [5.1](#s-the-evidence-record) |
| Decompiler artifact | A line of pseudocode that the decompiler needed and that no source line produced | [4.6](#s-analyze-function-and-pseudocode) |
| Dossier | The composed record of one function that `analyze_function` returns, built from five Ghidra sources | [4.6](#s-analyze-function-and-pseudocode) |
| Evidence | The one record type every successful analysis call returns, a strict object with 16 fields | [1.1](#s-rea-providers-and-evidence) |
| Evidence bundle | One JSON object with seven arrays: `artifacts`, `providers`, `environments`, `scenarios`, `captures`, `unknowns`, and `records` | [5.4](#s-evidence-bundles-export-and-import) |
| Evidence ledger | The table an agent keeps during an investigation: one row per claim with its kind, its Evidence id, and its boundary | [8.2](#s-an-agent-investigation) |
| Evidence record | The record type itself, as [Part 5](#p-5) reads it field by field | [5.1](#s-the-evidence-record) |
| File offset | The position of a byte in the file, counted from zero | [3.3](#s-address-to-file-offset) |
| Function body | The set of addresses Ghidra assigns to one function, reported as ranges with inclusive ends | [4.2](#s-list-procedures-and-function-bodies) |
| Function match | How `compare_functions` decided that two dossiers describe the same function, `matched` by `symbol` in the captures | [5.5](#s-compare-and-compare-functions) |
| Function starts | The table of LEB128 deltas in a Mach-O image that names each function entry | [4.4](#s-xrefs-and-the-jump-table) |
| Ghidra provider | The rea adapter that drives an installed Ghidra through `analyzeHeadless`, pinned to 12.1.4 and JDK 21 | [2.2](#s-rea-doctor-and-the-ghidra-provider) |
| Headless import | A Ghidra run with no window that imports one file into a project and runs the default analyzers | [4.1](#s-open-binary-and-the-headless-bridge) |
| Input grid | The list of input cells a proof harness feeds to the original and the rebuild, one class of cells per hazard | [7.2](#s-a-proof-harness-outside-rea) |
| Jump table | A table of code addresses that an indirect jump indexes | [4.4](#s-xrefs-and-the-jump-table) |
| Load command | One record after the Mach-O header, with a `cmd` type and a `cmdsize` | [3.2](#s-inspect-binary-layout-and-the-load-image) |
| Procedure | The function identity in a dossier: address, body ranges, signature, and classification | [1.2](#s-rea-function-end-to-end) |
| Provider | An analysis engine behind one interface. The binary session has four candidates at 6.7.0: `hopper`, `ghidra`, `ida`, and `kuna` | [1.1](#s-rea-providers-and-evidence) |
| Query id | `query_` and the SHA-256 of the target identity, the binding, the operation, and the parameters of one cached answer | [5.3](#s-snapshots-and-the-answer-cache) |
| References | The incoming and outgoing edges of a dossier, each with a Ghidra reference type | [1.2](#s-rea-function-end-to-end) |
| Relocation masking | Zeroing every relocation field in both functions before comparing bytes, then comparing the records and reading the bytes they point at | [7.2](#s-a-proof-harness-outside-rea) |
| Residual unknown | A question the evidence does not yet settle, kept as a record with an `unk_` id, a revision chain, a status, and the evidence that would close it | [5.2](#s-residual-unknowns-and-coverage) |
| Semantic projection | The view of a record that the id hashes, with `subject.name` and `subject.local_path` left out | [5.1](#s-the-evidence-record) |
| Snapshot file | The JSON file that `close_binary` writes and `open_binary` reads, with the target identity, the binding, the cache entries, and the Evidence bundle | [5.3](#s-snapshots-and-the-answer-cache) |
| Specification | The input of `verify_reconstruction`: a name and at least one claim with a kind, a dimension, and a comparison id | [7.1](#s-verify-reconstruction) |
| Startup deadline | The time rea allows Ghidra to import, analyze, connect, and report healthy, 330,000 ms by default | [8.1](#s-the-rea-mcp-server) |
| `Surface` | The way a caller reaches the session: the one-shot CLI or the MCP server | [1.1](#s-rea-providers-and-evidence) |
| Target snapshot | The private copy of the input that the Ghidra launcher imports with `-readOnly` and `-deleteProject` and deletes when the session closes | [5.3](#s-snapshots-and-the-answer-cache) |
| Target text | Every string, symbol name, comment, and line of pseudocode that a result copies out of the analyzed file, to be quoted and never acted on | [8.2](#s-an-agent-investigation) |
| Thunk | A small function whose only job is to jump to another function | [4.2](#s-list-procedures-and-function-bodies) |
| Tool catalog | The 207 tools the MCP server advertises in `tools/list`, available or not | [8.1](#s-the-rea-mcp-server) |
| Value table | A table of data that a load indexes, so one instruction returns one of several values | [4.4](#s-xrefs-and-the-jump-table) |
| Virtual address | The position of a byte in memory after the loader maps the segment that contains it | [3.3](#s-address-to-file-offset) |

Sources: the definition paragraphs of every file under sections/; rea at 27dc42d: src/domain/evidence.ts, src/domain/evidenceBundle.ts, src/domain/residualUnknown.ts, src/domain/reconstructionVerification.ts, src/config/providerStartupTimeout.ts, src/contracts/toolOutputSchemaPrimitives.ts; capture/out/02-capabilities.json; rea docs/mcp-contracts.md
