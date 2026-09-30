# Persistent Memory Server

A persistent memory workbench with revision history and one boundary for REST and MCP.

Node 22.18+, Rust 2021 and Python 3 for the grader; promises, append logs, HTTP, namespaces, revisions and vector dot products. The core uses standard libraries. The grader checks your selected workspace; it never fills in missing behavior from the reference.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally.

```bash
python3 scripts/project_test.py memory-server --init learning-artifacts/memory-server
python3 scripts/project_test.py memory-server --stage 1 --path learning-artifacts/memory-server --strict
```

Implement each stage, then run the cumulative grader and the supplied input driver:

```bash
python3 scripts/project_test.py memory-server --all --path learning-artifacts/memory-server --strict
cd learning-artifacts/memory-server
node cli.ts --data-dir memory-data --put samples/memory.json
node cli.ts --data-dir memory-data --query "cache policy"
node cli.ts --data-dir memory-data --history cache-policy
```

The driver and offline samples are provided scaffolding. Its imports resolve to your implementation. Public input types and function signatures live in the starter and [API contract](API.md).

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py memory-server --all --solution --strict
cd projects/memory-server/solution
node cli.ts --data-dir memory-data --put samples/memory.json
node cli.ts --data-dir memory-data --query "cache policy"
node cli.ts --data-dir memory-data --history cache-policy
```

## Observe the change

A first process appends revision 1. A separate process recovers and searches that record with its source. Updating with --revision 1 appends revision 2; repeating revision 0 fails and leaves the log unchanged.

Edit a copy of the sample and rerun the command. Keep the input beside the output so someone else can reproduce the result; the supplied samples are authored teaching data.

## Integration and limits

Set MEMORY_TOKEN in the environment and run node cli.ts --data-dir memory-data --serve --port 8788. REST and MCP share the same store; no token is written into files.

Use one writer process per data directory. Appended JSONL is restart persistence, not a power-loss or multi-process transaction guarantee. Hashed lexical vectors are not semantic embeddings. MCP HTTP is a documented tools subset without streaming or sessions.

For persistent serving, set MEMORY_TOKEN in your environment, then run:

```bash
node cli.ts --data-dir memory-data --serve --port 8788
```

Restart with the same directory to recover history. Use a new id or `--revision 1` when updating the initial sample; rerunning its creation with revision 0 is intentionally a conflict.

## Stages

1. [Keep text, namespace and provenance together](stages/01-record-contract/docs/en.md)
2. [Serialize revisioned writes](stages/02-durable-log/docs/en.md)
3. [Score vectors in a real Rust process](stages/03-hybrid-search/docs/en.md)
4. [Expose REST and MCP tools](stages/04-transports/docs/en.md)


## Primary references

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

## Compare a source change

After the initial sample write, run these commands in the same completed workspace:

```bash
node cli.ts --data-dir memory-data --put samples/memory-updated.json --revision 1
node cli.ts --data-dir memory-data --history cache-policy --html history.html
```

The comparison table keeps both source locators and revisions. Revision 1 says sixty seconds at policies/cache.md:12; revision 2 says ninety seconds at line 18. Retaining the old source makes the change reviewable. The server does not verify that an external source file still matches its stored text.
