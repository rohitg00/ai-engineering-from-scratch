# Export migration fixtures and a compatibility gate

Stage 4 of 4. Read [Stage 3](../../03-generate-and-replay-counterexamples/docs/en.md) before starting; this stage integrates contract checking into a reusable CI gate.

## What changes

In modern AI agent deployments, schema changes must be validated automatically in continuous integration. This stage builds a comprehensive report generator, exports reproducible regression fixtures, and exposes a CLI gate that fails CI builds whenever breaking schema changes or replayed call failures are detected.

The boundary for this stage is `build_report`, `export_fixtures`, and the `cli.py` entrypoint.

## Work through one concrete case

A CI pull request proposes tightening tool arguments:

```figure
pj-tool-contract-migration-checker-4
```

Running `cli.py --old schema_v1.json --new schema_v2.json --strict` exits with status `1`, blocking the merge until the developer relaxes the contract to restore backwards compatibility.

## Implement the contract

Implement `build_report` and `export_fixtures` in your workspace `main.py`.

- `build_report(old_contract, new_contract, changes, counterexamples, replay_result)` produces a structured summary including schema version, tool name, compatibility status, and counts.
- `export_fixtures(output_path, counterexamples, broken_calls)` writes a clean JSON fixture file containing counterexamples and broken calls for regression testing.
- The supplied `cli.py` driver connects your cumulative functions to command-line flags.

## Verify and inspect

```bash
python3 scripts/project_test.py tool-contract-migration-checker --all --path learning-artifacts/tool-contract-migration-checker --strict
cd learning-artifacts/tool-contract-migration-checker
python3 cli.py --old samples/catalog_v1.json --new samples/catalog_v2.json --calls samples/saved_calls.json --output report.json
```

## References

[Continuous Integration and Schema Evolution](https://martinfowler.com/articles/evodb.html)
