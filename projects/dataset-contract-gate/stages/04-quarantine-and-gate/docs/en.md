# Export partitions and enforce the dataset gate

> Quarantine invalid records and fail ingestion on explicit dataset rules.

**Type:** Build
**Languages:** Python
**Prerequisites:** The previous project stages
**Time:** ~120 minutes

## Learning Objectives

- Implement the public function contract and reject unsupported input.
- Predict the worked example before running the tool.
- Explain the failure cases with stored evidence.
- Reuse the output in the next pipeline stage.

## What you build

Return schema_version=1, passed, counts, dataset_issues, duplicates, accepted and quarantine. Quarantine records carry row_number, record and issues. Add a unique issue to every row in a duplicate group. A dataset passes only with no quarantined rows and no whole-dataset issues. CLI --check uses exit1 for rule failure and exit2 for invalid input.

```text
evaluate(rows, contract) -> dict; render_html(report) -> str
```

## Work through one example

```python
evaluate([{'id': 'x'}, {'id': 'x'}, {'id': 'y'}], {'version': 1, 'fields': {'id': {'type': 'string'}}, 'unique': ['id']})['counts']
```

Expected value:

```text
{'input': 3, 'accepted': 1, 'quarantined': 2}
```

The final test runs the actual CLI, consumes accepted.jsonl in a second evaluation, and confirms the clean partition passes. A row-count violation still blocks ingestion even when every row is individually valid. Read receipt.json before using exported rows. The HTML labels one-based source lines because blank JSONL lines are rejected.

## Interactive Lab

```figure
pj-dataset-contract-gate-4
```

Change one input in the mechanism. Predict which intermediate value should change, then compare the calculated receipt. The diagram illustrates this stage's contract; the local grader tests your actual Python code.

## Build it

Open the `main.py` in your learner workspace. Implement this stage's function with explicit data structures. Preserve the prior stage contracts. The CLI and HTML renderer were supplied at initialization; they do not replace the implementation you are writing. Stage tests import `PROJECT_WORKSPACE`, so editing an instructor file does not complete your version.

## Failure cases

Output partitions are evidence, not permission to discard records automatically. Multiple independent output files are not an atomic transaction; consumers should wait for the command to finish successfully before loading them.

## Verify it

From the repository root:

```bash
python3 scripts/project_test.py dataset-contract-gate --stage 4 --path learning-artifacts/dataset-contract-gate --strict
```

The grader is cumulative. Read the first failed assertion, reproduce it with the smallest input and fix the responsible function. It checks ordinary cases, boundary conditions, malformed values and independent fixtures. The instructor-only equivalent is `--stage 4 --solution --strict`.

## Use it and extend it

At the final stage, run the CLI from your workspace and inspect every exported artifact:

```bash
cd learning-artifacts/dataset-contract-gate
python3 cli.py samples/input.jsonl --contract samples/contract.json --output demo-output
```

The sample has four rows. The first is accepted, the second has a negative token count, and both rows with id sample-c are quarantined. The receipt therefore reports one accepted and three quarantined rows. --check exits 1 for this result. Removing bad rows is a separate decision from passing the original dataset gate.

The version-1 contract is an original teaching format, not JSON Schema or the Open Data Contract Standard. It supports flat JSON objects, four scalar types, required fields, numeric bounds, enums, single-column uniqueness and row-count bounds. Missing optional unique fields do not collide. Duplicate detection uses memory proportional to the batch; the API caps input at one hundred thousand rows. It does not check semantic truth or cross-table foreign keys. Quarantine contains original records and must remain in an appropriate local location.
