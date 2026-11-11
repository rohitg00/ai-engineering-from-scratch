# Load versioned tool contracts and saved calls

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds the foundation for schema comparison.

## What changes

When an AI tool contract evolves, we must parse both the old schema and the proposed schema into a normalized internal representation, and validate recorded historical agent invocations against those contracts.

The boundary for this stage is `load_contract`, `load_calls`, and `validate_call`.

## Work through one concrete case

A tool contract specifies required parameters, property types, and validation keywords like `enum`, `minimum`, and `maximum`.

```figure
pj-tool-contract-migration-checker-1
```

A valid call provides the required parameters matching their declared types. If a historical invocation omits a required property or violates a constraint, `validate_call` detects the mismatch and returns structured issue messages.

## Implement the contract

Implement `load_contract`, `load_calls`, and `validate_call` in your workspace `main.py`.

- `load_contract(raw)` verifies that `raw` is a dictionary with `type: "object"` and returns a normalized dictionary.
- `load_calls(raw)` takes a list of objects each containing an `arguments` dictionary.
- `validate_call(contract, args)` evaluates the call against declared properties, checking required fields, property types, bounds, and enum membership.

## Verify and inspect

From the repository root, initialize once:

```bash
python3 scripts/project_test.py tool-contract-migration-checker --init learning-artifacts/tool-contract-migration-checker
python3 scripts/project_test.py tool-contract-migration-checker --stage 1 --path learning-artifacts/tool-contract-migration-checker --strict
```

## References

[JSON Schema 2020-12 Validation](https://json-schema.org/draft/2020-12/json-schema-validation)
