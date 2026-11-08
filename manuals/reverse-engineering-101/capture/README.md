# Reverse Engineering 101 capture kit

Every listing in the manual is cut from a file in `out/`. This kit drives the real `rea` 6.7.0 command line and its MCP server on the host that runs it, with the Ghidra 12.1.4 provider, and records what they return. It uses the Python standard library only.

```bash
python3 run.py                   # writes out/
python3 run.py --check           # captures again into a temporary directory and compares with out/ after masking
python3 run.py --build-fixtures  # rebuilds the fixture binaries and the WASM module, then prints their SHA-256
```

The subject needs Ghidra, a JDK, and Node, so it cannot run in the repository CI. `--check` prints `skipped: <reason>` and exits 0 when rea 6.7.0, Ghidra 12.1.4, or JDK 21 is absent. A plain run prints the reason and exits 1. A run removes every file in `out/` first, so `out/` always holds one complete capture.

## Recorded with

| Item | Value |
|---|---|
| Host | Apple silicon laptop, macOS 26.2 (build 25C56), arm64 |
| rea | rea-agents 6.7.0 from the npx cache, started as `node .../node_modules/rea-agents/scripts/rea.mjs`, Node 22.22.0 |
| Ghidra | 12.1.4 PUBLIC (build 2026-Sep-21) from Homebrew, `GHIDRA_INSTALL_DIR=/opt/homebrew/Cellar/ghidra/12.1.4/libexec` |
| JDK | OpenJDK 21.0.12.1 from Homebrew, `JAVA_HOME=/opt/homebrew/opt/openjdk@21` |
| clang | Apple clang 17.0.0 (clang-1700.6.3.2), target arm64-apple-darwin25.2.0 |
| WABT | 1.0.42 (Homebrew formula `wabt` 1.0.42_1), `REA_WABT_BIN_DIRECTORY=/opt/homebrew/bin` |
| Recorded on | 2026-10-18 |

`00-versions.txt` holds the version output of each tool as printed on the recording host.

How `run.py` finds the tools, in order: `REA_COMMAND` (an argv string) when set, then `rea` on `PATH` when its `--version` prints 6.7.0, then the npx cache `~/.npm/_npx/*/node_modules/rea-agents` with version 6.7.0. Ghidra comes from `GHIDRA_INSTALL_DIR` or the Homebrew path, and `Ghidra/application.properties` must say `application.version=12.1.4`. The JDK comes from `JAVA_HOME` or `/opt/homebrew/opt/openjdk@21`. WABT comes from `REA_WABT_BIN_DIRECTORY` or `/opt/homebrew/bin`. Without WABT, `inspect-wasm-artifact` cannot run its tools.

Every rea command runs with this directory as its working directory, with `GHIDRA_INSTALL_DIR`, `JAVA_HOME`, and `REA_WABT_BIN_DIRECTORY` set, and with `PWD` and `JAVA_TOOL_OPTIONS` removed from the environment. Paths are passed absolute and shown relative in `00-commands.txt`.

## Timings

A full run takes about 125 s on the recording host. Each one-shot CLI call that needs Ghidra imports the target into a fresh headless project and takes 7 to 9 s. `00-commands.txt` holds the time of each call. Inside the MCP session, the first Ghidra-backed call after `open_binary` takes 5 to 7 s, and every later call on the same target takes under 100 ms (`10-mcp-session.txt`). `--check` runs the whole capture again, so give it time in `manual.json`:

```json
"capture": {
  "run": ["python3", "capture/run.py"],
  "check": ["python3", "capture/run.py", "--check"],
  "timeoutSeconds": 900
}
```

## Files in out/

| File | Holds |
|---|---|
| `00-commands.txt` | every CLI command in order, with its exit code, its time, its stderr, and the file it wrote |
| `00-versions.txt` | the versions of rea, node, clang, llvm-objdump, macOS, Ghidra, the JDK, and WABT |
| `00-fixtures.txt` | SHA-256 and size of every fixture file |
| `01-doctor-ghidra.json` | `rea doctor --provider ghidra`, filtered to `healthy`, `environment_healthy`, `scope`, and `scope_checks`. The informational checks name this user's agent registrations and are left out by the filter |
| `02-capabilities.json` | `rea capabilities`: every operation with its availability, effects, and limitations |
| `03-inspect-artifact.json` | `inspect-artifact` on the arm64 executable |
| `04-inspect-binary-layout.json` | the error envelope on macOS: `capability_unavailable`, the pwntools profile supports Linux x64 only |
| `04-inspect-macho.json` | `inspect-macho` on the arm64 executable, the layout tool that works on macOS |
| `05-analyze-arm64-O1.json`, `05-analyze-x86_64-O1.json` | `binary_overview` Evidence for the Mach-O executable and for the ELF relocatable object |
| `06-function-*.json` | `analyze_function` dossiers for `_percent_change`, `_grade`, `_total`, and `_grade_label` in the arm64 -O1 executable, and for `grade` in the x86-64 -O1 object |
| `07-decompile-total.json`, `07-decompile-grade-x86_64-O1.json` | `procedure_pseudo_code` for `_total` (arm64) and `grade` (x86-64) |
| `08-address-to-file-offset.json` | `0x100000518`, the entry of `_grade`, resolved to file offset 1304 |
| `10-mcp-NN-<tool>.json` | one MCP exchange each: `request`, `response`, `notifications` when the server sent any, and `decoded_text` (the parsed `content[0].text`) when the result is an error |
| `10-mcp-session.txt` | the order of the exchanges with method, tool, status, file, and time |
| `10-mcp-server.log` | the stderr of `rea mcp`: one pino JSON line per tool call |
| `11-bundle-O1.json`, `11-bundle-O2.json` | the bundles `export_evidence_bundle` wrote, bytes as written, with the capture path masked and a newline added |
| `11-inspect-evidence-bundle-O1.json`, `-O2.json` | `rea inspect-evidence-bundle` summary of each bundle: one row per record |
| `11-bundles.txt` | SHA-256 and size of the two bundle files |
| `12-evidence-export.json`, `12-evidence-export.txt` | `rea evidence-export` of bundle O1 to a canonical file, and the digests of both files |
| `13-evidence-import.json` | `rea evidence-import` of bundle O1 |
| `13-evidence-import-rea-6.5.0.json` | `rea evidence-import` of `fixtures/bundle-rea-6.5.0-O1.json`, the bundle O1 that rea 6.5.0 wrote: the `evidence_integrity_mismatch` refusal |
| `14-compare-bundles.json` | `rea compare` of bundle O1 and bundle O2 |
| `15-js-app.json` | the `analyze_javascript_application` record without `graph` and `semantic_graph`, selected with `--filter-output` |
| `15-js-app-graph.json` | `normalized_result.graph` of the same record: 42 nodes and 59 edges |
| `15-js-app-view-summary.json`, `15-js-app-view-modules.json` | `rea inspect-analysis-view` summary and modules page over the complete record |
| `16-inspect-wasm-artifact.json` | `inspect-wasm-artifact` on `wasm/ledger.wasm`: the Evidence record of the provider `wabt-artifact` |
| `16-wabt.txt` | the three WABT commands that rea runs on the module, run directly |
| `17-harness-grid.json` | the 92 input cells of the lesson 36 harness: the `percent_change` pairs, the `grade` scores, the hazard class counts, and the ten naive cases |
| `17-harness-execute-plausible.json`, `17-harness-execute-equal.json` | execute-and-compare runs: the original and a candidate compiled into one program and run over the grid, with every row, the mismatches, and the model disagreements. Plausible is `percent_change_wide.c` with `grade_thresholds.c`, equal is `percent_change_mul_first.c` with `grade_switch.c` |
| `17-harness-bytes.json` | recompile-and-compare for eight candidates against `ledger-x86_64-O1.o`: function bytes, relocation records, masked ranges, the referenced table, status, and reasons |
| `17-harness.txt` | what the harness is, where it was loaded from, and the host and compiler that ran it |
| `18-setup-claude-jsonc.json` | `rea setup --client claude_code --skill=false --dry-run` on a Claude Code configuration with a comment and a trailing comma: `needs_human`, registration `invalid` |
| `18-setup-claude-duplicate.json` | `rea setup --client claude_code --skill=false --yes` on a configuration with two `rea` members: `ready` |
| `18-setup-configs.txt` | both configuration files as they were after setup |

## The MCP session

`Mcp` in `run.py` is a small JSON-RPC 2.0 client over newline-delimited stdio. It starts `rea mcp`, sends `initialize` with protocol version 2025-06-18, the `notifications/initialized` notification, then the calls below. The session records every call in order:

1. `tools/list`, 207 tools.
2. `open_binary` on `fixtures/ledger-arm64-O1` with `provider_id: "ghidra"`, then `binary_session`.
3. `list_procedures`, `procedure_assembly` for `_grade`, `xrefs` for the entry of `_grade`, `list_strings`.
4. `analyze_function` for the four ledger functions, then for `_nothing`, which fails with `invalid_request`.
5. `export_evidence_bundle` to a work file, copied to `11-bundle-O1.json`, then `close_binary`.
6. `open_binary` on `fixtures/ledger-arm64-O2`, `analyze_function` for `_percent_change` and `_total`, `export_evidence_bundle` to `11-bundle-O2.json`.
7. `compare_functions` for `_percent_change` (all eight dimensions unchanged) and for `_total` (five dimensions changed).
8. `verify_reconstruction` with four `structural-function` claims over those two comparison records: the two `percent_change` claims pass, the two `total` claims fail.
9. `import_evidence_bundle` of bundle O1, `inspect_wasm_artifact` on `wasm/ledger.wasm`, `close_binary`.

## The setup step

`step_setup` runs `rea setup` for Claude Code against two copies of the files in `fixtures/setup/`. Each run gets its own `HOME` and `CLAUDE_CONFIG_DIR` inside the work directory, so setup never reads or writes a configuration of the host user. `--skill=false` keeps the skill install out of the run. The JSONC case is a dry run. The duplicate case applies the edit with `--yes`, and `18-setup-configs.txt` shows that setup wrote the last `rea` member and left the first one as it was.

## The lesson 36 harness

The `17-*` files are not rea output. `run.py` loads `phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code/main.py` from this repository and runs its two proofs over `fixtures/ledger-x86_64-O1.o`, the same bytes as the lesson's copy. Leg one compiles `fixtures/ledger.c` and one candidate per function with the host clang at `-O1`, renames the candidates with `-Dpercent_change=cand_percent_change -Dgrade=cand_grade`, links them with the lesson's `driver.c`, and runs the 92 cells. On this arm64 host the original is the source compiled natively (`original_kind: fixture-source`), so the trap cell returns `-2147483648` instead of a divide trap. Leg two compiles each of the eight candidate sources with `clang -target x86_64-unknown-linux-gnu -O1 -fno-asynchronous-unwind-tables -c`, reads both objects with the lesson's ELF reader, zeroes the relocation fields, compares the bytes, the relocation records, and the five table entries the `grade` relocation points at. The step needs clang and takes about two seconds. When clang or the lesson code is absent, `17-harness.txt` says so and no other `17-*` file is written.

## Cuts made by run.py

Each cut is marked in place with a string that starts `<cut by run.py:`.

- `tools/list`: `inputSchema` and `outputSchema` are kept only for the twelve tools the session calls. The other 195 tools keep `name`, `title`, `description`, and `annotations`.
- `binary_session`: the kit keeps three entries of `tool_availability` or `server_identity.catalog.tools` when either is a list. At 6.7.0 `tool_availability` holds groups and the catalog holds only counts and digests, so this cut removes nothing.
- Every tool result whose `content[0].text` is the JSON text of `structuredContent` keeps `structuredContent` and replaces the text copy. The marker names the byte count of the copy.
- The `compare_functions` request keeps `evidence_id` for `left` and `right` and names the file that holds each complete dossier.

Nothing inside an Evidence record is cut. Every `evidence_id` in `out/` can be recomputed from the record beside it.

## Masks

Written files never hold a host path or user name. At write time the kit replaces the capture directory with `$CAPTURE`, the output directory with `$OUT`, the work directory with `$WORK`, the home directory with `$HOME`, the user name as a path segment with `$USER`, and the npx cache hash with `_npx/<hash>`.

`--check` compares the fresh files with `out/` after masking, in both, the values that change on every run: RFC 3339 timestamps, epoch milliseconds in the server log, `durationMs`, the `(N s)` and `(N ms)` times in the index files, UUIDs such as `analysis_run.run_id`, macOS temporary directories, `rea-ghidra-*` runtime roots, and process ids. Evidence ids are content hashes and are compared unmasked. Two runs on the recording host produced identical records, and the check passed.

## Failures recorded

- `04-inspect-binary-layout.json`: `capability_unavailable`, category `unsupported_provider`. The pwntools ELF profile supports Linux x64 only, so the kit records `inspect-macho` as the macOS layout tool.
- `10-mcp-13-analyze-function-missing.json`: `analyze_function` with `procedure: "_nothing"` returns `isError: true` and the `invalid_request` envelope in `content[0].text`.
- `12-evidence-export.txt`: the canonical file `rea evidence-export` writes has the same JSON content as the file `export_evidence_bundle` wrote over MCP, with a different byte order. The CLI sorts keys and writes no trailing newline.
- `13-evidence-import-rea-6.5.0.json`: `evidence_integrity_mismatch`, category `integrity_mismatch`, at `records.3.evidence_id`. rea 6.7.0 puts a `null` `relationship_coverage` into the identity of a record, so the first 6.5.0 record without coverage no longer verifies.
- `18-setup-claude-jsonc.json`: `needs_human`. Claude Code reads strict JSON, so setup refuses the comment and the trailing comma before it makes a backup or writes.
- `14-compare-bundles.json`: `status: "unknown"` with 10 unresolved records. The two bundles come from different builds, so no record is a member of both, and the bundle carries no inventory completeness marker.

## Fixtures

All fixtures are programs written for this manual. `ledger.c` holds four functions: `percent_change` (division with a zero guard), `grade` (a switch on `score / 10`, compiled to a lookup table and a multiply by `0x66666667`), `total` (a loop over memory), and `grade_label` (a call and a data reference). `ledger-main.c` is a small `main` that parses its arguments and prints the results.

| Path | Build command, run in `fixtures/` | Reproducible |
|---|---|---|
| `ledger-x86_64-O0.o`, `-O1.o`, `-O2.o` | `clang -target x86_64-unknown-linux-gnu -O<n> -fno-asynchronous-unwind-tables -c ledger.c -o ledger-x86_64-O<n>.o` | byte for byte |
| `ledger-arm64-O1.o`, `ledger-arm64-O2.o` | `clang -O<n> -fno-asynchronous-unwind-tables -c ledger.c -o ledger-arm64-O<n>.o` | byte for byte |
| `ledger-arm64-O1`, `ledger-arm64-O2` | `clang -O<n> -o ledger-arm64-O<n> ledger.c ledger-main.c` | byte for byte with the same output name. The linker's ad-hoc code signature embeds the file name, so a link to another name gives other bytes |
| `wasm/ledger.wasm` | `wat2wasm wasm/ledger.wat -o wasm/ledger.wasm` | byte for byte |
| `js-app/` | none, six source files | |

The committed bytes are the ones every record in `out/` describes. `--build-fixtures` rebuilds all of them in place and prints which files changed. On the recording toolchain every rebuild reproduced the committed bytes. A different clang changes the executables and the objects, and with them every SHA-256, `evidence_id`, and bundle digest in `out/`, so `run.py` must run again after such a change.

`js-app/` is a small Electron-style application: `main.js` creates one `BrowserWindow` with a preload script and three `ipcMain` handlers, `preload.js` exposes a `ledger` API through `contextBridge`, `renderer.js` calls `fetch`, `localStorage`, and the exposed API, and `ledger.js` ports the four C functions to JavaScript. `wasm/ledger.wat` is a hand-written WebAssembly text module with the same four functions as exports, one import (`env.log`), one memory, and a data segment with the grade labels.

`bundle-rea-6.5.0-O1.json` is the bundle O1 that the 6.5.0 edition of this kit recorded, kept byte for byte to show how 6.7.0 treats an older bundle. `setup/claude-jsonc.json` and `setup/claude-duplicate.json` are two small Claude Code configuration files for the setup step. None of the three is rebuilt by `--build-fixtures`.

`invoice` and `invoice.c` are the coordinator's smoke-test program and are not used by this kit. `00-fixtures.txt` lists them with the others.
