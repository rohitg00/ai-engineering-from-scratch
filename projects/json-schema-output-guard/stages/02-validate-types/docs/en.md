# Walk a schema recursively

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Implement object, array and primitive validation. Required properties are checked with own-property semantics. An inherited property does not satisfy the contract. Treat integer as a refinement of number, reject non-finite numbers, and preserve a path for every failure. Bound recursive descent at depth 32 so a schema and value cannot consume the stack indefinitely.

The boundary for this stage is `validate`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

For schema properties.results.items.type=integer, the value {results:[1,"2"]} produces an issue at $/results/1. The text "2" does not become a number simply because coercion would be possible.

```figure
pj-json-schema-output-guard-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `validate` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Carry the property path down recursion rather than rebuilding it after failure. Use own-property checks for required fields, and reject a schema subtree even when its optional value is absent.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py json-schema-output-guard --init learning-artifacts/json-schema-output-guard`. Then grade cumulatively:

```bash
python3 scripts/project_test.py json-schema-output-guard --stage 2 --path learning-artifacts/json-schema-output-guard --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/json-schema-output-guard
node cli.ts --schema samples/schema.json --attempts samples/attempts.json --output guard.json --html guard.html
```

## Investigate the failure boundary

Add an unsupported keyword under properties.unused and validate {}. Schema preflight must reject the configuration before declaring the empty object valid.




## References

[JSON Schema validation vocabulary](https://json-schema.org/draft/2020-12/json-schema-validation)
[Node TypeScript execution](https://nodejs.org/api/typescript.html)
