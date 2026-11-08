# analyze-javascript-application and the application graph

> rea parses the six files of ledger-desk without running them and returns one derived record whose graph has 42 nodes and 59 edges, each with its own authority.

You have a small Electron-style application, six files in `capture/fixtures/js-app/`. You want the map before you read code: which renderer talks to which main-process handler, and what leaves the machine. The analysis answers that without Ghidra and without running a line of the application. When you finish this section, you can run the analysis, read the record and its graph, and page through a large result with `inspect-analysis-view`.

## The command and the record

The CLI command is `rea analyze-javascript-application PATH`. The plain `rea analyze PATH` reaches the same code. It picks this workflow for a directory or an `.asar` file when you give neither `--provider` nor `--snapshot` {{cli Run a command}}.

The inputs are `input_path`, `format` as `auto`, `asar`, or `directory`, and `integrity_policy`. The optional `source_paths` input names exact inventoried files. rea then analyzes only those files, and the relationships of the other files stay unknown.

Four resource limits are optional. `max_heap_mb` is 1024 MiB by default, and `analysis_timeout_ms` is 300,000 ms by default. `max_semantic_nodes` is 100,000 by default, and `max_semantic_nodes_per_file` is 20,000. Over MCP, you can also set `detail` to `complete` or `summary`. The parser is `@babel/parser`. It runs with `errorRecovery` on, and it does not attach comments.

```listing
title: the head of the analyze_javascript_application record
source: capture/out/15-js-app.json
lang: json
note: The kit kept the record without graph and semantic_graph, with --filter-output. The result fields follow.
---
{
  "evidence_id": "ev_14bd1d1e…",
  "subject": {
    "name": "js-app",
    "digest": {
      "sha256": "bb9f726c…"
    },
    "local_path": "$CAPTURE/fixtures/js-app",
    "format": "directory",
    "architecture": null
  },
  "provider": {
    "id": "rea-javascript-application",
    "name": "REA JavaScript application analyzer",
    "version": "1"
  },
  "analysis_profile": null,
  "predicate_type": "rea.javascript-application-analysis",
  "operation": "analyze_javascript_application",
  "parameters": {
    "format": "auto",
    "integrity_policy": "fail"
  },
```

This is an Evidence record like the ones in Part 5, with three differences from a Ghidra dossier. The provider is rea itself, `rea-javascript-application` version `1`. The confidence is `derived`, because rea computed relationships from syntax, and the authority is `shipped-artifact`, because the six files on disk are the source. The subject is the directory, with the SHA-256 `bb9f726c…` of its inventory as the digest. The `normalized_result` has eleven fields: `input_path`, `format`, `root_artifact_sha256`, `inventory_manifest_id`, `inventory_graph_sha256`, `integrity_contradictions`, `graph`, `summary`, `statistics`, `limitations`, and `semantic_graph`. A twelfth field, `source_selection`, is present only when the request names `source_paths`.

```listing
title: the summary and the statistics of ledger-desk
source: capture/out/15-js-app.json
lang: json
note: The utility-process and native-addon counts, all zero, are cut.
---
"summary": {
  "browser_windows": 1,
  "explicit_web_preferences": 3,
  "preload_entrypoints": 1,
  "context_bridge_apis": 1,
  "exposed_api_members": 3,
  "ipc": {
    "operations": 6,
    "literal_channels": 3,
    "dynamic_channel_operations": 0,
    "renderer_transmissions": 3,
    "renderer_listeners": 0,
    "main_handlers": 3,
    "paired_renderer_transmissions": 3,
    "ambiguous_renderer_transmissions": 0,
    "unpaired_literal_renderer_transmissions": 0
  },
  …
},
"statistics": {
  "relevant_files": 6,
  "nested_asar_containers": 0,
  "text_bytes_read": 2888,
  "invalid_utf8_files": 0,
  "parsed_javascript_files": 4,
  "skipped_javascript_files": 0,
  "visited_ast_nodes": 424,
  "findings": 25,
  "modules": 0,
  "parse_failures": 0
},
```

Check the numbers against the source in `capture/fixtures/js-app/`. `main.js` creates one `BrowserWindow` with three explicit `webPreferences`, `preload`, `contextIsolation`, and `nodeIntegration`. `preload.js` exposes one `contextBridge` API, `ledger`, with three members. The six IPC operations are the two `invoke` and one `send` in `preload.js`, and the two `handle` and one `on` in `main.js`. They use three literal channels, and each channel is paired.

Four of the six files are JavaScript, 424 AST nodes were visited, and no file failed to parse. `skipped_javascript_files` is 0, so no JavaScript file was left out for size or for a resource limit. When that count is above 0, the graph is incomplete, and the count tells you by how many files. `modules` counts bundler modules, and this application has no bundle. While the command ran, rea wrote nineteen progress events to stderr, from inventory to the final hash of the record. The events also show the split between the files. rea reads `index.html` and `package.json` for metadata only, and it parses the four JavaScript files.

```listing
title: five of the nineteen progress events
source: capture/out/00-commands.txt
lang: text
note: Events 1, 3, 4, 5, and 19 of the first analyze-javascript-application call. The other fourteen are cut.
---
[stderr] {"rea_progress":{"phase":"analyze_javascript_application","completed":0,"total":1,"message":"Inventorying and parsing application artifacts","sequence":1}}
…
[stderr] {"rea_progress":{"phase":"parse_javascript_sources","completed":0,"total":1,"message":"Processing 6 selected application files","sequence":3}}
[stderr] {"rea_progress":{"phase":"process_javascript_artifact_metadata","completed":0,"total":1,"message":"Processing metadata for index.html (1/6)","sequence":4}}
[stderr] {"rea_progress":{"phase":"parse_javascript_source","completed":0,"total":1,"message":"Parsing and projecting ledger.js (2/6)","sequence":5}}
…
[stderr] {"rea_progress":{"phase":"analyze_javascript_application","completed":1,"total":1,"message":"Application graph and Electron boundaries reconstructed","terminal":true,"sequence":19}}
```

## The graph

**Application graph:** the provider-neutral model of an application as nodes and directed edges, with an evidence block on every edge. The documentation fixes two rules. The graph is built from syntax alone. It reads no files and makes no CDP calls, it does not run JavaScript, and it has no node kinds for one application {{jsgraph JavaScript Application Graph}}.

The edges use a fixed set of directed relations: `contains`, `loads`, `imports`, `maps_to`, `exposes`, `sends`, `invokes`, `handles`, `calls`, `persists_to`, `observed_as`, and `changed_from` {{jsgraph Entities and relationships}}.

The graph for ledger-desk in `15-js-app-graph.json` has 42 nodes and 59 edges. Its own coverage is `complete`, and it omits nothing. Each of the four source modules records the SHA-256 of its own file as `source_sha256`. That digest is the one `00-fixtures.txt` lists for the file, so you can match a module to its bytes without the directory digest.

| Node kind | Count | In ledger-desk |
|---|---|---|
| `javascript-module` | 11 | the four files as modules, plus `electron`, `node:path`, and `./ledger` as they are required |
| `javascript-expression` | 9 | three steps (exposure, closure, terminal call) for each of the three bridge members `ledger.percentChange`, `ledger.gradeLabel`, and `ledger.log` |
| `javascript-asset` | 4 | `main.js`, `preload.js`, `renderer.js`, `ledger.js` by content digest |
| `artifact` | 3 | the root directory, `package.json`, `index.html` |
| `ipc-channel` | 3 | `ledger:percent-change`, `ledger:grade-label`, `ledger:log` |
| `ipc-handler` | 3 | the two `ipcMain.handle` and the one `ipcMain.on` in `main.js` |
| `electron-renderer` | 2 | `index.html`, seen from `loadFile` and from the HTML reference |
| `package`, `electron-main`, `browser-window`, `electron-preload`, `context-bridge-api`, `endpoint`, `storage` | 1 each | `ledger-desk`, `main.js`, `BrowserWindow@8:17-16:4`, `preload.js`, `ledger`, `/api/ledger/latest`, `ledger:latest` |

| Relation | Count | Evidence on the edges |
|---|---|---|
| `contains` | 19 | 7 observed from artifact bytes, 8 observed from the AST, 4 inferred |
| `imports` | 11 | inferred |
| `maps_to` | 8 | inferred |
| `loads` | 5 | inferred |
| `calls` | 4 | inferred: one `fetch` to the endpoint, and one step edge in each of the three bridge call paths |
| `invokes` | 4 | inferred |
| `handles` | 3 | inferred |
| `sends`, `exposes` | 2 each | inferred |
| `persists_to` | 1 | inferred, `localStorage.setItem` |

Every edge says how it was obtained. An AST fact has authority `ast-static-analysis`, state `observed`, confidence `exact`, and a source range. A relationship has authority `static-relationship-inference`, state `inferred`, and confidence `high` by default. It always carries the limitation `Static syntax does not prove that this relationship executes at runtime.` The documentation states the rule for the Electron edges: `loads`, `exposes`, `invokes`, `handles`, and `imports` stay static inferences {{jsgraph Entities and relationships}}.

```listing
title: one invokes edge, from preload.js to the handler in main.js
source: capture/out/15-js-app-graph.json
lang: json
note: The artifact reference, the extractor, the coverage, and the limitations of the edge are cut.
---
{
  "source_node_id": "jag_node_c239425e…",
  "target_node_id": "jag_node_36721459…",
  "relation": "invokes",
  "properties": {
    "channel": "ledger:grade-label",
    "pairing_basis": "unique-exact-literal-channel",
    "handler_path": "main.js",
    "handler_operation": "handle"
  },
  "evidence": {
    "authority": "static-relationship-inference",
    "state": "inferred",
    "confidence": "high",
    …
    "location": {
      "available": true,
      "value": {
        "kind": "source-range",
        "source": "preload.js",
        "start": {
          "line": 7,
          "column": 25
        },
        "end": {
          "line": 7,
          "column": 72
        }
      }
    },
    …
```

Line 7 of `preload.js`, columns 25 to 72, is `ipcRenderer.invoke("ledger:grade-label", score)`. The edge pairs this call with the `ipcMain.handle` in `main.js`, because the channel is one exact literal that appears once on each side. It is `inferred`, not `observed`, because nothing ran. The same pairing would be `ambiguous` if two handlers used the channel, and dynamic channel names get no pairing edge at all. [Figure](#fig-6-1) draws the graph with the file names and channel names from the capture.

```figure
id: fig-6-1
kind: tree
title: the application graph of ledger-desk
claim: The graph links the package entry point to three IPC handlers and one network endpoint, and each edge names whether it was observed or inferred.
caption: Read from the top left. Olive boxes are the application's own code, the grey box is the network endpoint outside it, and the teal box is browser storage. Relation names sit on the arrows. The nine `javascript-expression` step nodes of the three bridge call paths are not drawn. From capture/out/15-js-app-graph.json.
```

## Views over a large record

Six files give a record of about 200 KB. The documentation warns that for a real application the complete Evidence can reach hundreds of megabytes {{cli Run a command}}.

`inspect-analysis-view` reads a view out of a record that already exists, without running the analysis again. Its input is a `source` and a `view`. The source is the complete record inline, or a reference to a record the MCP session retains. The view is a summary, a page of a collection, or one module. The capture asked for the summary and for the first 32 items of the `modules` collection.

Each view is an Evidence record of its own, from provider `rea-analysis-view`. The parent id is in `parameters.parent_evidence_id` and in `evidence_links`, so the chain from view to analysis is explicit.

```listing
title: the coverage block of the summary view
source: capture/out/15-js-app-view-summary.json
lang: json
note: The twelve semantic families, all partial, are cut.
---
"coverage": {
  "application": {
    "status": "complete",
    "truncated": false,
    "omitted_count": 0,
    "limits": []
  },
  …
  "application_unknowns": 0,
  "semantic_unknowns": 118
},
"limitation_count": 7
```

The application graph is complete. The semantic graph, the second graph in the record, is not. Its coverage status is `unknown`, each of its twelve families is `partial`, and 118 semantic unknowns remain. The view lists that fact among its `unknowns` as `semantic_graph.coverage.status is unknown`. This is the rule from [residual unknowns](#s-residual-unknowns-and-coverage) in a second shape. A graph that says it is partial is more useful than a graph that says nothing.

```listing
title: the modules page, items and coverage
source: capture/out/15-js-app-view-modules.json
lang: json
note: Thirteen of the fifteen items are cut.
---
"items": [
  {
    "node_id": "jag_node_0fc7e361…",
    "kind": "javascript-asset",
    "path": "main.js"
  },
  {
    "node_id": "jag_node_19e7e901…",
    "kind": "javascript-module",
    "path": "main.js"
  },
  …
"coverage": {
  "status": "page",
  "examined": 15,
  "total": 15,
  "next_offset": null,
  "exhausted": true
},
```

A page says how much of the collection it covers: 15 of 15 items here, with no next offset. For a record with thousands of modules you would read `next_offset` and ask again. One last detail ties this section to [the Evidence record](#s-the-evidence-record). Both view records carry the application path inside `normalized_result` and `locations`. The masked `$CAPTURE` in the capture therefore changes their ids, and your own run will show different ids for the same views.

```takeaways
- Run `rea analyze-javascript-application PATH --format json` and save the complete record to a file.
- Read `summary.ipc` and the `invokes` and `handles` edges before you open a source file.
- Treat every `inferred` edge as a hypothesis until a run or a test confirms it.
- Page a large record with `inspect-analysis-view` instead of reading it whole.
```

Sources: src/cli/electronCommands.ts, src/domain/javascript/javascriptApplicationAnalysis.ts, src/domain/javascript/javascriptAnalysisResourceControls.ts, src/domain/javascript/javascriptSourceParser.ts, src/contracts/javascript/electronToolContracts.ts, src/contracts/analysisViewToolContracts.ts, src/application/javascript/JavaScriptArtifactGraphEvidence.ts, src/domain/javascript/javascriptSourceSelection.ts at rea-agents-6.7.0 (27dc42d); rea docs/cli.md, docs/javascript-application-graph.md, docs/javascript-artifact-reconstruction.md (Select sources before analysis, What is reconstructed), docs/mcp-contracts.md; capture/README.md; capture/fixtures/js-app/main.js, preload.js, renderer.js, ledger.js, index.html, package.json; capture/out/00-commands.txt, 15-js-app.json, 15-js-app-graph.json, 15-js-app-view-summary.json, 15-js-app-view-modules.json
