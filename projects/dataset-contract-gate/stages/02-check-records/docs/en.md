# Check each record without coercion

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

Consume a validated contract. Return ordered {field,rule} dictionaries. Missing required fields yield required; wrong scalar types yield type; numeric violations yield min or max; disallowed enum values yield enum. Unknown fields yield extra unless allow_extra=true. A non-object row yields {field:"",rule:"object"}.

```text
row_issues(row, contract) -> list[dict]
```

## Work through one example

```python
row_issues({}, {'fields': {'id': {'type': 'string', 'required': True}}})
```

Expected value:

```text
[{'field': 'id', 'rule': 'required'}]
```

A string `31` is not an integer. Converting it during validation would conceal upstream drift. Check types before comparisons so an invalid value reports one useful type issue rather than raising from an unrelated numeric operation. Missing optional fields pass; explicit null fails every supported scalar type.

## Interactive Lab

```figure
pj-dataset-contract-gate-2
```

Change one input in the mechanism. Predict which intermediate value should change, then compare the calculated receipt. The diagram illustrates this stage's contract; the local grader tests your actual Python code.

## Build it

Open the `main.py` in your learner workspace. Implement this stage's function with explicit data structures. Preserve the prior stage contracts. The CLI and HTML renderer were supplied at initialization; they do not replace the implementation you are writing. Stage tests import `PROJECT_WORKSPACE`, so editing an instructor file does not complete your version.

## Failure cases

Boolean true fails integer and number fields. Non-finite floats fail number fields. The contract preserves original records and never invents missing values.

## Verify it

From the repository root:

```bash
python3 scripts/project_test.py dataset-contract-gate --stage 2 --path learning-artifacts/dataset-contract-gate --strict
```

The grader is cumulative. Read the first failed assertion, reproduce it with the smallest input and fix the responsible function. It checks ordinary cases, boundary conditions, malformed values and independent fixtures. The instructor-only equivalent is `--stage 2 --solution --strict`.

## Use it and extend it

After all four stages pass, use the supplied CLI with your own JSONL:

```bash
cd learning-artifacts/dataset-contract-gate
python3 cli.py samples/input.jsonl --contract samples/contract.json --output demo-output
```

Write one additional held-out case that differs from the worked example. Explain why its result follows from the contract rather than matching a hardcoded sample.

Keep unsupported behavior explicit. Extending the accepted input format requires new contract examples and tests before changing the implementation.
