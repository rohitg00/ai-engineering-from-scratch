# Score vectors in a real Rust process

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Compile score.rs with the standard Rust toolchain and send query and document vectors over stdin. Compute cosine similarity, returning zero for a zero-norm vector. Combine 60 percent lexical query coverage with 40 percent cosine score and use ids to break ties. Test dimensions and finite values before crossing the process boundary. Compile the Rust binary into a private temporary directory and remove it on normal process exit. Never trust an executable already present at a predictable shared temporary path.

The boundary for this stage is `cosineScores, MemoryStore.search`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

Query vector[1,1] and document[1,0] have cosine 1/sqrt(2), about 0.707. With lexical coverage 0.5, the hybrid score is0.6*0.5+0.4*0.707, about 0.583.

```figure
pj-memory-server-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `cosineScores, MemoryStore.search` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Validate finite, equal-length vectors before sending comma-separated rows to Rust. Treat zero norm as score 0 and check the real subprocess result count.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py memory-server --init learning-artifacts/memory-server`. Then grade cumulatively:

```bash
python3 scripts/project_test.py memory-server --stage 3 --path learning-artifacts/memory-server --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/memory-server
node cli.ts --data-dir memory-data --put samples/memory.json
node cli.ts --data-dir memory-data --query "cache policy"
node cli.ts --data-dir memory-data --history cache-policy
```

## Investigate the failure boundary

Change the query in the lab and inspect both contributions. A high hash cosine with no literal overlap may be a collision, not semantic support.




## References

[MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
[Rust standard library](https://doc.rust-lang.org/std/)
[Node HTTP API](https://nodejs.org/api/http.html)
