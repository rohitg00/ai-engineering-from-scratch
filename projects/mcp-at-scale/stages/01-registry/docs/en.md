# Build a catalog of 250 read-only tools

Stage 1 of 5. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Create five narrowly scoped read operations for each of 50 resource kinds. The names and schemas are stable; execution reads an injected inventory rather than contacting a cluster. A tool schema defines the exact accepted keys and values, so an unknown argument never reaches a handler by accident.

## Work through one concrete case

Fifty resource families times five operations produce 250 teaching tools, but all share one local inventory mechanism. A supplied inventory containing only pods exposes five useful resource tools; the composed server adds catalog_search as the sixth.

```figure
pj-mcp-at-scale-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `registry.py`: `catalog`, `execute`. This artifact is stage 1 of MCP Server With 250 Tools. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Keep public name, description and inputSchema separate from internal resource/operation metadata. Validate exact argument keys before consulting inventory.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py mcp-at-scale --init learning-artifacts/mcp-at-scale`. Then grade cumulatively:

```bash
python3 scripts/project_test.py mcp-at-scale --stage 1 --path learning-artifacts/mcp-at-scale --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/mcp-at-scale
python3 cli.py samples/inventory.json --query "pods count" --max-chars 500
```

## Investigate the failure boundary

Pass {query:"worker",extra:true} to pods_search. It must fail rather than quietly ignoring an unrecognized instruction.




## References

[Reference 1](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
[Reference 2](https://www.jsonrpc.org/specification)
