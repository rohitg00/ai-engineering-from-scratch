# Keep text, namespace and provenance together

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Every memory needs a bounded id, namespace, text and source locator. Never return a detached string without its provenance. The small feature-hashing embedding maps normalized terms into a fixed vector; it is a deterministic lexical projection, not a pretrained semantic model. Hash collisions are expected and explain why lexical evidence remains part of retrieval.

The boundary for this stage is `validateMemory, embed`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

A memory {id:cache-policy,namespace:docs,text:...,source:policies/cache.md:12} keeps content and evidence together. The same id in namespace:private is a different record.

```figure
pj-memory-server-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `validateMemory, embed` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Validate the JSON boundary before hashing or writing. Feature hashing maps terms into 32 buckets, so unrelated words can collide; retain lexical coverage to expose that limitation.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py memory-server --init learning-artifacts/memory-server`. Then grade cumulatively:

```bash
python3 scripts/project_test.py memory-server --stage 1 --path learning-artifacts/memory-server --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/memory-server
node cli.ts --data-dir memory-data --put samples/memory.json
node cli.ts --data-dir memory-data --query "cache policy"
node cli.ts --data-dir memory-data --history cache-policy
```

## Investigate the failure boundary

Construct two namespaces with identical text. A query in docs must never return the private record.




## References

[MCP tools specification](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
[Rust standard library](https://doc.rust-lang.org/std/)
[Node HTTP API](https://nodejs.org/api/http.html)
