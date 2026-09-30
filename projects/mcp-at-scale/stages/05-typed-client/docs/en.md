# Exercise the real wire with a typed client

Stage 5 of 5. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

The parent and child have separate memory. Serialize requests, preserve their ids, and correlate replies after parsing. Initialization notifications intentionally have no id and receive no response. A client that expects one line per input line will hang.

Bound both elapsed time and accumulated output. A server can stall or print forever, so a response timeout alone is insufficient. Check the exit code and keep stderr separate from JSON output. Reject duplicate outgoing ids before creating the process.

## Work through one concrete case

The typed client starts a separate Python process, closes stdin after its requests and validates response ids. The composed CLI can instead serve your supplied inventory continuously for a stdio MCP client.

```figure
pj-mcp-at-scale-5
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement the public interfaces named in the stage tests and API contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Keep stderr separate from protocol stdout. Bound time and accumulated output, and kill the child on a timeout or malformed response. A typed Response annotation cannot validate external JSON at runtime.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py mcp-at-scale --init learning-artifacts/mcp-at-scale`. Then grade cumulatively:

```bash
python3 scripts/project_test.py mcp-at-scale --stage 5 --path learning-artifacts/mcp-at-scale --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/mcp-at-scale
python3 cli.py samples/inventory.json --query "pods count" --max-chars 500
```

## Investigate the failure boundary

Run the full stdio integration regression: initialize, notify, pods_count. Then inspect catalog_search over the same boundary and retain its exact context character count.

The stdio transport implements the documented 2025-06-18 and 2025-11-25 initialization/tools subset. It is not a claim of full current MCP conformance. Inventory reads are local recordings; the generated tool count is not 250 distinct integrations.


## References

[MCP stdio transport](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)

## Optional standard MCP client verification

The optional track uses `mcp==2.1.1`, the installed official Python client, against this project's actual stdio process. It negotiates the declared 2025-11-25 legacy tools contract. This does not establish support for every newer protocol feature.

```bash
python3 -m venv .venv-mcp
.venv-mcp/bin/python -m pip install -r projects/mcp-at-scale/requirements-framework.txt
.venv-mcp/bin/python scripts/project_test.py mcp-at-scale --all --solution --optional --strict
```

Use `--path learning-artifacts/mcp-at-scale` to run the same client against your implementation. The default track stays standard-library-only; missing optional packages produce SKIP, which fails strict optional grading.
