# Select tools under an explicit context budget

Stage 2 of 5. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Rank metadata before sending tools into a context window. Count the actual compact JSON characters of each selected schema and stop at the explicit budget. This is a character budget, not a model-token estimate; keep the units honest. Stable name ties make discovery reproducible.

## Work through one concrete case

Two schemas of compact lengths 200 and 220 occupy 423 characters in an array:200+220, two brackets and one comma. Summing individual lengths would undercount and could overflow a420-character budget.

```figure
pj-mcp-at-scale-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `discovery.py`: `discover`. This artifact is stage 2 of MCP Server With 250 Tools. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Measure JSON serialization of the candidate selected array before accepting the next schema. Ranking and packing are distinct: a highly ranked oversized schema can be skipped while a smaller useful schema still fits.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py mcp-at-scale --init learning-artifacts/mcp-at-scale`. Then grade cumulatively:

```bash
python3 scripts/project_test.py mcp-at-scale --stage 2 --path learning-artifacts/mcp-at-scale --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/mcp-at-scale
python3 cli.py samples/inventory.json --query "pods count" --max-chars 500
```

## Investigate the failure boundary

Set max_chars to exactly the size of one selected schema array, then one character less. Verify the boundary without estimating model tokens.




## References

[Reference 1](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
[Reference 2](https://www.jsonrpc.org/specification)
