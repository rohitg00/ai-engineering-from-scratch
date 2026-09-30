# Serialize revisioned writes

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Load a versioned event log and reconstruct the latest record for each namespace/id pair. An update must name its expected revision. Serialize writes so two callers racing from revision zero cannot both succeed. Append before mutating the in-memory map. This is a single-process store: append completion is not a power-loss durability guarantee, and multiple server processes require an external lock or database.

The boundary for this stage is `MemoryStore.put, MemoryStore.list`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

Two writers in the same process both propose expectedRevision0 for the same id. The serialized queue admits one create and rejects the other; replaying the JSONL log reconstructs revision 1.

```figure
pj-memory-server-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `MemoryStore.put, MemoryStore.list` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Append before mutating the map. On a failed append, the in-memory value must not pretend persistence succeeded. Keep the tail promise usable after a failed operation so later independent writes can proceed.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py memory-server --init learning-artifacts/memory-server`. Then grade cumulatively:

```bash
python3 scripts/project_test.py memory-server --stage 2 --path learning-artifacts/memory-server --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/memory-server
node cli.ts --data-dir memory-data --put samples/memory.json
node cli.ts --data-dir memory-data --query "cache policy"
node cli.ts --data-dir memory-data --history cache-policy
```

## Investigate the failure boundary

Run cli.ts --put twice from separate processes with revision 0. The second run fails. Then use revision 1 and inspect both log entries with --history.




## References

[MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
[Rust standard library](https://doc.rust-lang.org/std/)
[Node HTTP API](https://nodejs.org/api/http.html)
