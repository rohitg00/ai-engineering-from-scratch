# Tool Contract Migration Checker

Find the saved tool calls that a proposed schema change would break.

Python 3.10+; dictionaries, schema parsing, and generative testing. The core uses the Python standard library with no external dependencies.

## Build and run your version

From the repository root, initialize once:

```bash
python3 scripts/project_test.py tool-contract-migration-checker --init learning-artifacts/tool-contract-migration-checker
python3 scripts/project_test.py tool-contract-migration-checker --stage 1 --path learning-artifacts/tool-contract-migration-checker --strict
```

Implement each stage, then run the cumulative grader and CLI driver:

```bash
python3 scripts/project_test.py tool-contract-migration-checker --all --path learning-artifacts/tool-contract-migration-checker --strict
cd learning-artifacts/tool-contract-migration-checker
python3 cli.py --old samples/catalog_v1.json --new samples/catalog_v2.json --calls samples/saved_calls.json --output report.json
```

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py tool-contract-migration-checker --all --solution --strict
cd projects/tool-contract-migration-checker/solution
python3 cli.py --old samples/catalog_v1.json --new samples/catalog_v2.json --calls samples/saved_calls.json --output report.json
```

## Observe the change

The demo compares `catalog_v1.json` with `catalog_v2.json`. The proposed schema adds a required `api_key`, narrows the allowed `category` enum, lowers the `limit` maximum to 50, and rejects undeclared properties. Replaying five historical calls reveals four breaking failures and synthesizes concrete counterexample payloads.

## Integration and limits

The baseline supports `properties`, `required`, `additionalProperties`, `type`, `enum`, `minimum`, `maximum`, `minLength`, and `maxLength`. Keywords outside this educational subset (`$ref`, `oneOf`, `anyOf`, `allOf`) are surfaced as unresolved changes.

## Stages

1. [Load versioned tool contracts and saved calls](stages/01-load-contracts-and-calls/docs/en.md)
2. [Classify supported schema changes](stages/02-classify-schema-changes/docs/en.md)
3. [Generate and replay breaking-call counterexamples](stages/03-generate-and-replay-counterexamples/docs/en.md)
4. [Export migration fixtures and a compatibility gate](stages/04-export-fixtures-and-ci-gate/docs/en.md)

## Primary references

[JSON Schema 2020-12](https://json-schema.org/draft/2020-12/json-schema-validation)
[Semantic Versioning 2.0.0](https://semver.org/)
