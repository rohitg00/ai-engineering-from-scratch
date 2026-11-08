# Find all rows in a duplicate group

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

For each unique column, index valid typed values to one-based input row numbers. Emit {field,rows} only for groups containing at least two rows. Missing fields and values of the wrong type are left to row validation. Report every colliding member, including the first occurrence.

```text
duplicate_rows(rows, contract) -> list[dict]
```

## Work through one example

```python
duplicate_rows([{'id': 'x'}, {'id': 'x'}], {'fields': {'id': {'type': 'string'}}, 'unique': ['id']})
```

Expected value:

```text
[{'field': 'id', 'rows': [1, 2]}]
```

Keeping the first duplicate would make acceptance depend on input order. Group all rows first and decide afterward. Two numeric values 1 and 1.0 collide in a number column, while string values `a` and `A` remain distinct. The evidence stores row numbers without repeating values.

## Interactive Lab

```figure
pj-dataset-contract-gate-3
```

Change one input in the mechanism. Predict which intermediate value should change, then compare the calculated receipt. The diagram illustrates this stage's contract; the local grader tests your actual Python code.

## Build it

Open the `main.py` in your learner workspace. Implement this stage's function with explicit data structures. Preserve the prior stage contracts. The CLI and HTML renderer were supplied at initialization; they do not replace the implementation you are writing. Stage tests import `PROJECT_WORKSPACE`, so editing an instructor file does not complete your version.

## Failure cases

Do not attempt to hash invalid arrays or objects. Two missing optional values are not evidence of duplicate keys. The chosen rules are per-column, not composite uniqueness.

## Verify it

From the repository root:

```bash
python3 scripts/project_test.py dataset-contract-gate --stage 3 --path learning-artifacts/dataset-contract-gate --strict
```

The grader is cumulative. Read the first failed assertion, reproduce it with the smallest input and fix the responsible function. It checks ordinary cases, boundary conditions, malformed values and independent fixtures. The instructor-only equivalent is `--stage 3 --solution --strict`.

## Use it and extend it

After all four stages pass, use the supplied CLI with your own JSONL:

```bash
cd learning-artifacts/dataset-contract-gate
python3 cli.py samples/input.jsonl --contract samples/contract.json --output demo-output
```

Write one additional held-out case that differs from the worked example. Explain why its result follows from the contract rather than matching a hardcoded sample.

Keep unsupported behavior explicit. Extending the accepted input format requires new contract examples and tests before changing the implementation.
