# JSON Schema Output Guard

A schema preflight and bounded-repair receipt for model output contracts.

Node 22.18+ and Python 3 for the grader; TypeScript unions, recursive functions, JSON and async callbacks. The core uses standard libraries. The grader checks your selected workspace; it never fills in missing behavior from the reference.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally.

```bash
python3 scripts/project_test.py json-schema-output-guard --init learning-artifacts/json-schema-output-guard
python3 scripts/project_test.py json-schema-output-guard --stage 1 --path learning-artifacts/json-schema-output-guard --strict
```

Implement each stage, then run the cumulative grader and the supplied input driver:

```bash
python3 scripts/project_test.py json-schema-output-guard --all --path learning-artifacts/json-schema-output-guard --strict
cd learning-artifacts/json-schema-output-guard
node cli.ts --schema samples/schema.json --attempts samples/attempts.json --output guard.json --html guard.html
```

The driver and offline samples are provided scaffolding. Its imports resolve to your implementation. Public input types and function signatures live in the starter and [API contract](API.md).

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py json-schema-output-guard --all --solution --strict
cd projects/json-schema-output-guard/solution
node cli.ts --schema samples/schema.json --attempts samples/attempts.json --output guard.json --html guard.html
```

## Observe the change

Attempt 1 rejects confidence 1.5 at $/confidence. Attempt 2 accepts confidence 0.8. An unsupported keyword in an absent optional property now fails during schema preflight.

Edit a copy of the sample and rerun the command. Keep the input beside the output so someone else can reproduce the result; the supplied samples are authored teaching data.

## Integration and limits

Call guard(raw,schema) at the application boundary, or repair(generate,schema,maxAttempts) where generate receives structured Issue[] and a one-based attempt number.

This is an explicit JSON Schema subset. $ref, format and combinators are rejected. Schema acceptance does not establish whether an answer is factually correct. Recorded repair is not a live model call.

## Stages

1. [Parse the untrusted boundary](stages/01-parse-json/docs/en.md)
2. [Walk a schema recursively](stages/02-validate-types/docs/en.md)
3. [Reject ambiguous and unsupported contracts](stages/03-constraints/docs/en.md)
4. [Repair with a finite budget](stages/04-bounded-repair/docs/en.md)


## Primary references

[JSON Schema validation vocabulary](https://json-schema.org/draft/2020-12/json-schema-validation)
[Node TypeScript execution](https://nodejs.org/api/typescript.html)
