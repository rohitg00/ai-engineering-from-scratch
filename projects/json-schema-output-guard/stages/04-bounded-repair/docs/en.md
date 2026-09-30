# Repair with a finite budget

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Feed only structured validation feedback into a generation callback. Count each call before interpreting its output. Stop immediately after acceptance and return an explicit exhausted state after the final rejected attempt. Provider failures propagate instead of being disguised as schema failures. The trace records each attempt so a successful third response does not conceal two earlier contract violations.

The boundary for this stage is `repair`. Keep earlier stage behavior intact: the final grader runs every stage against the same workspace.

## Work through one concrete case

The sample records confidence 1.5 then 0.8. The first response emits an above-maximum issue; the callback receives that issue before attempt 2. Acceptance returns immediately and does not spend a third call.

```figure
pj-json-schema-output-guard-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `repair` in your workspace `main.ts`. Read the exported types in the reference only after attempting the contract. Preserve the starter's public names so tests can call your implementation. Return structured values instead of printing inside the core function; the CLI prints the final result.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Call checkSchema before invoking generate so a broken schema cannot consume provider budget. Provider exceptions must remain provider failures, not be converted into an invitation to retry forever.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py json-schema-output-guard --init learning-artifacts/json-schema-output-guard`. Then grade cumulatively:

```bash
python3 scripts/project_test.py json-schema-output-guard --stage 4 --path learning-artifacts/json-schema-output-guard --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/json-schema-output-guard
node cli.ts --schema samples/schema.json --attempts samples/attempts.json --output guard.json --html guard.html
```

## Investigate the failure boundary

Supply two invalid responses with budget 2. Assert exhausted and exactly two trace rows; then replace only the second response with a valid object and inspect the accepted artifact.

This is an explicit JSON Schema subset. $ref, format and combinators are rejected. Schema acceptance does not establish whether an answer is factually correct. Recorded repair is not a live model call.


## References

[JSON Schema validation vocabulary](https://json-schema.org/draft/2020-12/json-schema-validation)
[Node TypeScript execution](https://nodejs.org/api/typescript.html)
