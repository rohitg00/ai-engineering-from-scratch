# Expose REST and MCP tools

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Bind a local server, require a bearer token, bound request bodies, and implement health, REST writes/search and the MCP initialization/tools subset over JSON-RPC POST. Tool execution failures use isError inside a successful JSON-RPC response; unknown protocol methods use a JSON-RPC error. This is a teaching subset without sessions, streaming or production authentication. Test actual HTTP bytes so serialization cannot drop source or revision.

The boundary for this stage is `createMemoryServer`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

The persistent CLI chooses a retained directory and binds only 127.0.0.1. A REST write and an MCP tools/call memory_search use the same MemoryStore, so source and revision must survive both serialization paths.

```figure
pj-memory-server-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `createMemoryServer` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Collect body chunks as bytes and decode UTF-8 once after the complete request arrives, so a code point split between network chunks stays intact. Limit the incoming body to 50,000 bytes. If it exceeds the limit, send HTTP 413 with {"error":"body too large"} and Connection: close; the unfinished upload must not keep a connection open.

Set the bearer token through MEMORY_TOKEN and never print it. Initialize with a supported version, inspect the complete memory_put schema, then send malformed arguments to confirm a tool-level isError response.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py memory-server --init learning-artifacts/memory-server`. Then grade cumulatively:

```bash
python3 scripts/project_test.py memory-server --stage 4 --path learning-artifacts/memory-server --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/memory-server
node cli.ts --data-dir memory-data --put samples/memory.json
node cli.ts --data-dir memory-data --query "cache policy"
node cli.ts --data-dir memory-data --history cache-policy
```

## Investigate the failure boundary

Restart the service with the same directory and query the prior record. Distinguish restart persistence from multi-writer locking and power-loss durability, which this log does not provide.

Use one writer process per data directory. Appended JSONL is restart persistence, not a power-loss or multi-process transaction guarantee. Hashed lexical vectors are not semantic embeddings. MCP HTTP is a documented tools subset without streaming or sessions.


## References

[MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
[Rust standard library](https://doc.rust-lang.org/std/)
[Node HTTP API](https://nodejs.org/api/http.html)

## Optional standard MCP client verification

The optional track uses `mcp==2.1.1`, the installed official Python client, against this project's actual loopback HTTP server. It negotiates the declared 2025-11-25 legacy tools contract. This does not establish support for every newer protocol feature.

```bash
python3 -m venv .venv-mcp
.venv-mcp/bin/python -m pip install -r projects/memory-server/requirements-framework.txt
.venv-mcp/bin/python scripts/project_test.py memory-server --all --solution --optional --strict
```

Use `--path learning-artifacts/memory-server` to run the same client against your implementation. The default track stays standard-library-only; missing optional packages produce SKIP, which fails strict optional grading.
