# Dataset Contract Gate

Define a small versioned data contract, check field types and bounds, find every row in duplicate groups, and export accepted records separately from quarantine. A CLI exit code gates ingestion while a source-line report explains failures.

Python 3.12 or later. No model credentials or third-party dependencies are required.

## Build your version

From the repository root:

```bash
python3 scripts/project_test.py dataset-contract-gate --init learning-artifacts/dataset-contract-gate
python3 scripts/project_test.py dataset-contract-gate --stage 1 --path learning-artifacts/dataset-contract-gate --strict
```

The first run intentionally fails until you implement stage one. The supplied CLI and HTML renderer are scaffolding; they call your functions. Implement each stage without replacing your workspace with the reference.

```bash
python3 scripts/project_test.py dataset-contract-gate --all --path learning-artifacts/dataset-contract-gate --strict --report completion.json
cd learning-artifacts/dataset-contract-gate
python3 cli.py samples/input.jsonl --contract samples/contract.json --output demo-output
```

## Run the reference

```bash
python3 scripts/project_test.py dataset-contract-gate --all --solution --strict
cd projects/dataset-contract-gate/solution
python3 cli.py samples/input.jsonl --contract samples/contract.json --output demo-output
```

Open `demo-output/review.html` locally. Replace the sample input path with your own JSONL to use the tool beyond the demo. The [API contract](API.md) defines the accepted input and output shapes.

## Expected result and integration

The sample has four rows. The first is accepted, the second has a negative token count, and both rows with id sample-c are quarantined. The receipt therefore reports one accepted and three quarantined rows. --check exits 1 for this result. Removing bad rows is a separate decision from passing the original dataset gate.

The exported artifacts are `accepted.jsonl, quarantine.jsonl, receipt.json and review.html`. The supplied fixtures are authored examples. Test-level held-out cases use different values and malformed inputs; a successful demo alone does not qualify as completion.

## Scope

The version-1 contract is an original teaching format, not JSON Schema or the Open Data Contract Standard. It supports flat JSON objects, four scalar types, required fields, numeric bounds, enums, single-column uniqueness and row-count bounds. Missing optional unique fields do not collide. Duplicate detection uses memory proportional to the batch; the API caps input at one hundred thousand rows. It does not check semantic truth or cross-table foreign keys. Quarantine contains original records and must remain in an appropriate local location.

## Stages

1. [Validate an explicit quality contract](stages/01-validate-contract/docs/en.md)
2. [Check each record without coercion](stages/02-check-records/docs/en.md)
3. [Find all rows in a duplicate group](stages/03-check-uniqueness/docs/en.md)
4. [Export partitions and enforce the dataset gate](stages/04-quarantine-and-gate/docs/en.md)

## Primary references

- [Python JSON API](https://docs.python.org/3/library/json.html)
- [JSON specification, RFC 8259](https://www.rfc-editor.org/rfc/rfc8259.html)
