# Parse the untrusted boundary

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

A model response is a byte string. Parse the entire string as JSON, reject markdown wrappers and trailing text, and cap its UTF-8 byte size before parsing. Accept JSON primitives as well as objects: the schema, not the parser, determines whether a primitive is useful. Do not remove text until it happens to parse because that hides the actual output contract.

The boundary for this stage is `parseJSON`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

The string `{"answer":"yes"}` is valid JSON. Adding a trailing sentence makes the entire response invalid. Removing that sentence until parsing succeeds would hide a provider contract violation.

```figure
pj-json-schema-output-guard-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `parseJSON` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Count UTF-8 bytes before JSON.parse. A thousand non-ASCII characters need not occupy a thousand bytes. Keep JSON null distinct from an absent property.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py json-schema-output-guard --init learning-artifacts/json-schema-output-guard`. Then grade cumulatively:

```bash
python3 scripts/project_test.py json-schema-output-guard --stage 1 --path learning-artifacts/json-schema-output-guard --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/json-schema-output-guard
node cli.ts --schema samples/schema.json --attempts samples/attempts.json --output guard.json --html guard.html
```

## Investigate the failure boundary

Try a markdown code fence and a valid JSON primitive. The fence fails at parsing; the primitive waits for the schema stage to decide its suitability.




## References

[JSON Schema validation vocabulary](https://json-schema.org/draft/2020-12/json-schema-validation)
[Node TypeScript execution](https://nodejs.org/api/typescript.html)
