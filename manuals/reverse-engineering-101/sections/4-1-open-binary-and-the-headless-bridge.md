# open_binary and the headless bridge

> open_binary binds one target to one provider without a Ghidra import, and the first Ghidra-backed call pays for a headless import, auto-analysis, and a private socket.

Your agent opened `ledger-arm64-O1` over MCP in under two seconds and then waited several seconds for `list_procedures`. Nothing was wrong. The open call did not import the file into Ghidra. The first question did, and every question after it came back in milliseconds.

When you finish this section, you can read the server log of a session and name the process that the first query started. You can also predict which calls will be slow.

## open_binary

```listing
title: the open_binary exchange
source: capture/out/10-mcp-03-open-binary-O1.json
lang: json
note: The request and the result. The text copy of the result is cut by the capture kit.
---
"method": "tools/call",
"params": {
  "name": "open_binary",
  "arguments": {
    "path": "$CAPTURE/fixtures/ledger-arm64-O1",
    "provider_id": "ghidra"
  }
}
…
"structuredContent": {
  "result": {
    "path": "$CAPTURE/fixtures/ledger-arm64-O1",
    "format": "mach-o",
    "kind": "executable",
    "sha256": "01b5d08b…",
    "architecture": "arm64"
  }
}
```

The handler calls `session.open` with the path and the provider id, then returns five fields: `path`, `format`, `kind`, `sha256`, and `architecture`. To fill them rea reads the magic bytes: `7f 45 4c 46` for ELF, `MZ` for DOS and PE, and four Mach-O values. It hashes the whole file in 64 KiB chunks. A file with no header needs an explicit `format`. With `format: "raw-binary"` you also give `architecture` and `entry_point`, and the result adds `entry_point`. rea refuses a WebAssembly module here and sends it to `inspect_wasm_artifact`. For every other target, rea selects the provider you asked for, and `binary_session` records that choice.

The selection waits for the provider's readiness checks. On the capture Mac, the server log shows about 1.6 s for the first `open_binary` and about 0.4 s for the second. The design docs allow the wait: a readiness check can wait for the commands that it owns. Release 6.5.0 answered the same calls in 36 ms and 1 ms. Neither version imports the target at this step.

```listing
title: the binding that binary_session reports
source: capture/out/10-mcp-04-binary-session.json
lang: json
note: Cut to the provider binding and the server identity. The capabilities, candidates, and tool availability lists are cut.
---
"open": true,
…
"analysis_provider_binding": {
  "provider": {
    "id": "ghidra",
    "name": "Ghidra",
    "version": "12.1.4"
  },
  "selection_source": "request",
  "analysis_profile": {
    …
    "digest": "3fc72c9b…"
  }
},
…
"server_identity": {
  "package": {
    "name": "rea-agents",
    "version": "6.7.0",
    …
  },
  …
  "sdk": {
    "server": "2.3.1",
    …
  },
  "negotiated_protocol_version": "2025-06-18",
  …
```

`selection_source: "request"` says the agent chose Ghidra. The profile digest is the one every Ghidra record of this target carries. The docs state the limit of the open call in one sentence:

```rule
label: what open_binary does not do
source: mcp §Ghidra first-query deadlines and recovery
---
`open_binary` picks the target and binds the provider. It does not prove that Ghidra has finished the import of the target.
```

## The first Ghidra-backed call

```listing
title: six calls from the session index
source: capture/out/10-mcp-session.txt
lang: text
note: Lines 03 to 08 of the index. The time in parentheses is measured by the capture client around each call, changes on every run, and is cut.
---
03  tools/call open_binary              ok     -> 10-mcp-03-open-binary-O1.json  (…)
04  tools/call binary_session           ok     -> 10-mcp-04-binary-session.json  (…)
05  tools/call list_procedures          ok     -> 10-mcp-05-list-procedures.json  (…)
06  tools/call procedure_assembly       ok     -> 10-mcp-06-procedure-assembly-grade.json  (…)
07  tools/call xrefs                    ok     -> 10-mcp-07-xrefs-grade.json  (…)
08  tools/call list_strings             ok     -> 10-mcp-08-list-strings.json  (…)
```

```listing
title: the same calls in the server log
source: capture/out/10-mcp-server.log
lang: jsonl
note: The first five lines of the stderr of rea mcp. durationMs is measured inside the server. The time and durationMs values change on every run and are cut.
---
{"level":30,"time":…,"application":"rea","mode":"mcp","layer":"server","tool":"open_binary","durationMs":…,"status":"ok","msg":"MCP tool execution completed"}
{"level":30,"time":…,"application":"rea","mode":"mcp","layer":"server","tool":"list_procedures","durationMs":…,"status":"ok","msg":"MCP tool execution completed"}
{"level":30,"time":…,"application":"rea","mode":"mcp","layer":"server","tool":"procedure_assembly","durationMs":…,"status":"ok","msg":"MCP tool execution completed"}
{"level":30,"time":…,"application":"rea","mode":"mcp","layer":"server","tool":"xrefs","durationMs":…,"status":"ok","msg":"MCP tool execution completed"}
{"level":30,"time":…,"application":"rea","mode":"mcp","layer":"server","tool":"list_strings","durationMs":…,"status":"ok","msg":"MCP tool execution completed"}
```

The capture kit records the pattern in its README. The first Ghidra-backed call after `open_binary` takes 5 to 7 s. Every later call on the same target takes under 100 ms. The difference is the Ghidra start. `GhidraClient.callTool` awaits `start()` before it queues any request, so the first call pays for the whole sequence in `#startWithin`:

1. Create a private runtime root named `rea-ghidra-` and a random suffix under the session root.
2. Allocate the endpoint, a Unix socket on macOS and Linux.
3. Copy the target into the root as `target-01b5d08b08fb.bin`, hashing while copying, and refuse a digest mismatch.
4. Mint a 32-byte random token and a run id.
5. Write `session.json` with `transport`, `endpoint_path`, `token`, `run_id`, `target_sha256`, `provider_version`, and `profile_digest`.
6. Start Java and wait for the bridge to accept a connection.

**Headless import:** a Ghidra run with no window that imports one file into a project and runs the default analyzers. On macOS and Linux, rea does not run the `analyzeHeadless` shell script. It asks Ghidra's `LaunchSupport.jar` for the environment and the JVM arguments, then runs `java` itself. The heap is `-Xmx2G` unless `GHIDRA_HEADLESS_MAXMEM` or `GHIDRA_MAXMEM` is set. The command adds `-Djava.awt.headless=true` and names the class `ghidra.Ghidra` with `ghidra.app.util.headless.AnalyzeHeadless`.

The docs give the reason for the direct start. On Apple platforms the shell wrappers hide their environment from ownership checks. With the wrappers in place, rea could not cancel the process group safely during startup {{install §Ghidra}}.

The headless arguments come in one fixed order:

- the project root and the project name `rea-project`
- `-import` with the copied target
- `-readOnly` and `-deleteProject`
- `-log` and `-scriptlog` into the runtime root, and `-scriptPath` at the bridge directory
- `-postScript ReaGhidraNoReturnFix.java`
- `-postScript ReaGhidraBridge.java` with the path of `session.json`, last

Some targets and settings need more arguments. A raw binary, a DOS file, or a language override adds a loader and a processor. Seeds and disabled analyzers add pre-scripts. The fixtures of this manual need none of them.

```figure
id: fig-4-1
kind: sequence
title: one open and three questions over MCP
claim: The open call returns after the readiness checks with no import, the first question waits seconds for the headless import, and the next takes under 100 ms.
caption: Time runs down. Solid arrows are calls, dashed arrows are replies. The violet lanes are rea's Ghidra client and the Java bridge inside analyzeHeadless. The times are the ranges that the kit notes record. From capture/out/10-mcp-server.log and 10-mcp-session.txt.
```

## The bridge on the Java side

`ReaGhidraBridge.java` is a Ghidra script that runs after the import and the analyzers. Its `run()` reads `session.json` and deletes it, then requires an imported program. It checks that the Ghidra version equals `provider_version` and compares the program's own SHA-256 with `target_sha256` in constant time. It then ends the script transaction, initializes the decompiler, and serves. On a Unix socket it binds the path, sets the mode to `rw-------`, and accepts one client.

Each request is one JSON line, `{ id, token, method, params }`. Each reply is `{ id, ok: true, result }` or `{ id, ok: false, error: { code, message } }`, and rea parses it with a strict schema. `list_procedures` was request number 2 on that socket, after the `ping` of the handshake, and it took the Java side a few milliseconds. The seconds before it were the import and the analyzers.

```figure
id: fig-4-2
kind: tree
title: the private runtime root of one session
claim: One session owns one directory with the project, the hashed target copy, the descriptor, the socket, and the logs, and close_binary deletes it.
caption: Read top to bottom. Each entry names the file or directory and what writes it. From src/ghidra/GhidraLauncher.ts and src/ghidra/GhidraClient.ts at rea 6.7.0, and capture/out/05-analyze-arm64-O1.json for the document name.
```

## Deadlines and the close

rea allows 330,000 ms for the start, set by `REA_GHIDRA_STARTUP_TIMEOUT_MS`. On the capture Mac the start took 5 to 7 s, and the client limit is the one to watch. The pinned client SDK 2.3.1 waits 60,000 ms by default, so it can cancel before the REA startup deadline {{mcp §Ghidra first-query deadlines and recovery}}.

The docs record about 64 s on a Linux fixture and about 163 s on Windows. Set the client deadline from your own first run on your own machine.

`close_binary` takes a fraction of a second in the log. The client sends `shutdown` to the bridge with a 10 s limit, the bridge disposes the decompiler, and `-deleteProject` removes the project. The next `open_binary` on `ledger-arm64-O2` took about 0.4 s. Its first `analyze_function` again took seconds, because every new provider session imports the target again into a new temporary project {{mcp §Ghidra first-query deadlines and recovery}}.

```takeaways
- Expect the first Ghidra-backed call after `open_binary` to take seconds and the rest milliseconds.
- Set the MCP client deadline from a measured cold start on your own machine.
- Ask every question you have before `close_binary`, because the project is deleted.
- Read `durationMs` in the server log to separate rea time from Ghidra time.
```

Sources: capture/out/10-mcp-03-open-binary-O1.json, capture/out/10-mcp-04-binary-session.json, capture/out/10-mcp-session.txt, capture/out/10-mcp-server.log, capture/out/05-analyze-arm64-O1.json, capture/README.md; rea 6.7.0 at 27dc42d: src/server/registerSessionTools.ts, src/contracts/sessionLifecycleInputs.ts, src/domain/binaryTarget.ts, src/application/BinaryTargetResolver.ts, src/ghidra/GhidraClient.ts, src/ghidra/GhidraTransport.ts, src/ghidra/GhidraTargetSnapshot.ts, src/ghidra/GhidraLauncher.ts, src/ghidra/GhidraJavaLaunch.ts, src/ghidra/GhidraClientWire.ts, src/ghidra/protocol.ts, src/config/providerStartupTimeout.ts, src/application/binary/AnalysisProviderRegistry.ts, bridge/ghidra/ReaGhidraBridge.java; rea docs/mcp-contracts.md, rea docs/installation.md, rea docs/tool-design.md; the 6.5.0 recording of capture/out/10-mcp-server.log in commit 99d70723c of this repository
