# Reject ambiguous and unsupported contracts

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Add numeric bounds, enum membership, minimum Unicode string length, array bounds, and closed objects. Escape slash and tilde inside property paths. A keyword outside this educational subset is a configuration error, not silent success. This implementation intentionally does not claim complete JSON Schema conformance: references, formats and combinators require additional work.

The boundary for this stage is `validate, guard`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

A required key a/b~c is reported at $/a~1b~0c. Escape ~ first, then /; reversing or skipping escapes makes the diagnostic point at the wrong field. A minimum string length counts Unicode code points.

```figure
pj-json-schema-output-guard-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `validate, guard` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Treat unsupported vocabulary as a configuration exception and ordinary value mismatches as Issue[] results. Validate all schema shapes, including minItems and nested properties, before inspecting model data.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py json-schema-output-guard --init learning-artifacts/json-schema-output-guard`. Then grade cumulatively:

```bash
python3 scripts/project_test.py json-schema-output-guard --stage 3 --path learning-artifacts/json-schema-output-guard --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/json-schema-output-guard
node cli.ts --schema samples/schema.json --attempts samples/attempts.json --output guard.json --html guard.html
```

## Investigate the failure boundary

Use an empty array with items containing $ref. Empty input must not bypass schema-vocabulary validation.




## References

[JSON Schema validation vocabulary](https://json-schema.org/draft/2020-12/json-schema-validation)
[Node TypeScript execution](https://nodejs.org/api/typescript.html)
