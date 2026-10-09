# Validate an explicit quality contract

> Quarantine invalid records and fail ingestion on explicit dataset rules.

**Type:** Build
**Languages:** Python
**Prerequisites:** Basic Python dictionaries and lists
**Time:** ~120 minutes

## Learning Objectives

- Implement the public function contract and reject unsupported input.
- Predict the worked example before running the tool.
- Explain the failure cases with stored evidence.
- Reuse the output in the next pipeline stage.

## What you build

Require version=1 and a nonempty fields object. Each field declares type string, integer, number or boolean; optional required is Boolean. Numeric min/max must be finite and ordered. enum is a nonempty list of the declared type. unique contains distinct declared field names. min_rows/max_rows are nonnegative integers. Unknown rules fail closed.

```text
validate_contract(contract) -> dict
```

## Work through one example

```python
validate_contract({'version': 1, 'fields': {'id': {'type': 'string'}}})['version']
```

Expected value:

```text
1
```

Validate the policy before looking at data. A typo such as `minimum` must not silently disable a bound. Python considers True an integer in isinstance checks, so use exact type checks when distinguishing Boolean policy flags from numeric bounds.

## Interactive Lab

```figure
pj-dataset-contract-gate-1
```

Change one input in the mechanism. Predict which intermediate value should change, then compare the calculated receipt. The diagram illustrates this stage's contract; the local grader tests your actual Python code.

## Build it

Open the `main.py` in your learner workspace. Implement this stage's function with explicit data structures. Preserve the prior stage contracts. The CLI and HTML renderer were supplied at initialization; they do not replace the implementation you are writing. Stage tests import `PROJECT_WORKSPACE`, so editing an instructor file does not complete your version.

## Failure cases

Reject unsupported version, unknown keys, missing fields, inverted bounds, incompatible enums and uniqueness rules targeting nonexistent columns.

## Verify it

From the repository root:

```bash
python3 scripts/project_test.py dataset-contract-gate --stage 1 --path learning-artifacts/dataset-contract-gate --strict
```

The grader is cumulative. Read the first failed assertion, reproduce it with the smallest input and fix the responsible function. It checks ordinary cases, boundary conditions, malformed values and independent fixtures. The instructor-only equivalent is `--stage 1 --solution --strict`.

## Use it and extend it

After all four stages pass, use the supplied CLI with your own JSONL:

```bash
cd learning-artifacts/dataset-contract-gate
python3 cli.py samples/input.jsonl --contract samples/contract.json --output demo-output
```

Write one additional held-out case that differs from the worked example. Explain why its result follows from the contract rather than matching a hardcoded sample.

Keep unsupported behavior explicit. Extending the accepted input format requires new contract examples and tests before changing the implementation.
