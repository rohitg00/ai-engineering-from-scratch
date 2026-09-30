# Implement initialized JSON-RPC over stdio

Stage 3 of 5. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

The protocol has a lifecycle: negotiate a version, receive the initialized notification, then list or call tools. Notifications have no response. Separate transport errors from tool execution errors, preserve the request id, and paginate the catalog instead of returning all 250 schemas at once.

## Work through one concrete case

initialize id1 returns a version and capabilities. notifications/initialized has no id and emits no line. tools/call id2 then returns id2 with either content or a protocol error. Counting input lines as expected responses would hang.

```figure
pj-mcp-at-scale-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `protocol.py`: `handle`, `serve`. This artifact is stage 3 of MCP Server With 250 Tools. It consumes explicit inputs and returns an inspectable result that the next stage can use.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Maintain negotiated and initialized state separately. The CLI supplies a scoped catalog to serve; the catalog_search tool calls the same discover function tested in stage 2.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py mcp-at-scale --init learning-artifacts/mcp-at-scale`. Then grade cumulatively:

```bash
python3 scripts/project_test.py mcp-at-scale --stage 3 --path learning-artifacts/mcp-at-scale --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/mcp-at-scale
python3 cli.py samples/inventory.json --query "pods count" --max-chars 500
```

## Investigate the failure boundary

Call a tool before initialization, then complete the lifecycle and call pods_count against the sample inventory. Compare protocol error -32002 with a successful text result "2".




## References

[Reference 1](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
[Reference 2](https://www.jsonrpc.org/specification)
