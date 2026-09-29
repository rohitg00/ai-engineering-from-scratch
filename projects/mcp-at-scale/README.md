# MCP Tool Discovery Workbench

A scoped MCP inventory server that discovers schemas inside a measured context budget.

Python 3.10+, Node 22.18+, dictionaries, JSON-RPC request ids, stdin/stdout and child processes. The core uses standard libraries. The grader checks your selected workspace; it never fills in missing behavior from the reference.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally.

```bash
python3 scripts/project_test.py mcp-at-scale --init learning-artifacts/mcp-at-scale
python3 scripts/project_test.py mcp-at-scale --stage 1 --path learning-artifacts/mcp-at-scale --strict
```

Implement each stage, then run the cumulative grader and the supplied input driver:

```bash
python3 scripts/project_test.py mcp-at-scale --all --path learning-artifacts/mcp-at-scale --strict
cd learning-artifacts/mcp-at-scale
python3 cli.py samples/inventory.json --query "pods count" --max-chars 500
```

The driver and offline samples are provided scaffolding. Its imports resolve to your implementation. Public input types and function signatures live in the starter and [API contract](API.md).

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py mcp-at-scale --all --solution --strict
cd projects/mcp-at-scale/solution
python3 cli.py samples/inventory.json --query "pods count" --max-chars 500
```

## Observe the change

The file supplies three resource families, exposing fifteen read tools plus catalog_search. Search returns the best matching schema within the exact serialized tools-array budget. The exhaustive teaching registry remains 250 tools.

Edit a copy of the sample and rerun the command. Keep the input beside the output so someone else can reproduce the result; the supplied samples are authored teaching data.

## Integration and limits

Run `python3 cli.py /absolute/inventory.json --serve` as a stdio server. tools/call catalog_search takes query, max_chars and k; the response returns selected public schemas and their character count.

The stdio transport implements the documented 2025-06-18 and 2025-11-25 initialization/tools subset. It is not a claim of full current MCP conformance. Inventory reads are local recordings; the generated tool count is not 250 distinct integrations.

## Stages

1. [Build a catalog of 250 read-only tools](stages/01-registry/docs/en.md)
2. [Select tools under an explicit context budget](stages/02-discovery/docs/en.md)
3. [Implement initialized JSON-RPC over stdio](stages/03-protocol/docs/en.md)
4. [Audit catalog coverage through protocol pages](stages/04-audit/docs/en.md)
5. [Exercise the real wire with a typed client](stages/05-typed-client/docs/en.md)


## Primary references

- [MCP tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [JSON-RPC 2.0 specification](https://www.jsonrpc.org/specification)

## Optional standard MCP client verification

The optional track uses `mcp==2.1.1`, the installed official Python client, against this project's actual stdio process. It negotiates the declared 2025-11-25 legacy tools contract. This does not establish support for every newer protocol feature.

```bash
python3 -m venv .venv-mcp
.venv-mcp/bin/python -m pip install -r projects/mcp-at-scale/requirements-framework.txt
.venv-mcp/bin/python scripts/project_test.py mcp-at-scale --all --solution --optional --strict
```

Use `--path learning-artifacts/mcp-at-scale` to run the same client against your implementation. The default track stays standard-library-only; missing optional packages produce SKIP, which fails strict optional grading.

## Import a small REST contract

`rest_adapter.py` imports OpenAPI 3 GET operations with unique operationId and primitive path/query parameters. Unsupported parameter forms fail explicitly; write operations are excluded. Each imported operation retains the canonical source-spec SHA-256.

```bash
python3 cli.py samples/api-recordings.json --openapi samples/api.json --query "incident" --max-chars 800
python3 cli.py samples/api-recordings.json --openapi samples/api.json --serve
```

Call incident_get with {"id":"checkout-1"}. The authored recording must match the supplied arguments; a different id is rejected instead of receiving a misleading canned answer. `--base-url http://127.0.0.1:PORT` explicitly enables actual GETs against your loopback fixture. Redirects and non-loopback endpoints are rejected, requests time out after five seconds and response bytes are capped at one megabyte. This narrow importer does not promise full OpenAPI coverage.
