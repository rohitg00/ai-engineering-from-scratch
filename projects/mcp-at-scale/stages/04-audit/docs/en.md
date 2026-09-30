# Audit catalog coverage through protocol pages

Stage 4 of 5. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Treat pagination as a client-visible contract. Traverse every page through the handler and track duplicate names across page boundaries. A finite page guard catches accidental cursor loops. This audit validates the protocol inventory, while the final typed client will exercise the separate operating-system process boundary.

## Work through one concrete case

A32-tool page size over 250 tools requires eight pages: seven full pages and a final 26. Keep seen names across pages so repeating page 1 with a new cursor cannot masquerade as coverage.

```figure
pj-mcp-at-scale-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `audit.py`: `audit_catalog`. This artifact is stage 4 of MCP Server With 250 Tools. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Drive pagination through handle rather than calling catalog directly. An audit of internal arrays cannot detect a cursor bug in the transport layer.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py mcp-at-scale --init learning-artifacts/mcp-at-scale`. Then grade cumulatively:

```bash
python3 scripts/project_test.py mcp-at-scale --stage 4 --path learning-artifacts/mcp-at-scale --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/mcp-at-scale
python3 cli.py samples/inventory.json --query "pods count" --max-chars 500
```

## Investigate the failure boundary

Deliberately return the same cursor twice in a test double. Bound the page loop and surface the repeated page instead of continuing indefinitely.




## References

[Reference 1](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
[Reference 2](https://www.jsonrpc.org/specification)
