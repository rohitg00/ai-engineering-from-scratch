# Split groups with stable hashing

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Partition groups, not rows. Hash the seed and group id into a stable fraction and compare it with the requested test fraction. Every row in a group follows the same decision, regardless of input order.

Hash partitioning gives an expected fraction rather than an exact row count. Small datasets may have an empty partition. Report that honestly instead of moving one row and breaking group isolation.

## Work through one concrete case

If incident-A contains nine messages and incident-B contains one, a50 percent group split can yield nine train rows and one test row. Moving one message to balance counts would reintroduce incident leakage.

```figure
pj-dataset-split-auditor-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `split_groups` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Derive the partition decision from seed plus group, never input row order. Reversing the input list may change row order but must preserve each id's partition membership.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py dataset-split-auditor --init learning-artifacts/dataset-split-auditor`. Then grade cumulatively:

```bash
python3 scripts/project_test.py dataset-split-auditor --stage 3 --path learning-artifacts/dataset-split-auditor --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/dataset-split-auditor
python3 cli.py samples/input.json --output split-audit.json --html split-audit.html
```

## Investigate the failure boundary

Generate 20 groups with different sizes, change the seed and compare group isolation and row balance separately.




## References

[Primary technical reference](https://scikit-learn.org/stable/common_pitfalls.html)
