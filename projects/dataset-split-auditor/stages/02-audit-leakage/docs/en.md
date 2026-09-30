# Audit duplicate and group leakage

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Content leakage and group leakage are different. Two distinct support messages from the same incident can leak the answer even when their text differs. Track both normalized content hashes and group ids across partitions.

Return the colliding hashes and group names, not just a percentage. The reviewer needs to locate the records. Reject duplicate record ids because they make that evidence ambiguous.

## Work through one concrete case

train-a and test-a share normalized text across different incidents. train-a and test-b have different text but share incident-1. The report keeps two independent evidence lists with the exact record ids involved.

```figure
pj-dataset-split-auditor-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `audit` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Build value-to-record-id indexes for both sides, then intersect keys. The hash alone proves a collision but does not tell a beginner which source rows to inspect.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py dataset-split-auditor --init learning-artifacts/dataset-split-auditor`. Then grade cumulatively:

```bash
python3 scripts/project_test.py dataset-split-auditor --stage 2 --path learning-artifacts/dataset-split-auditor --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/dataset-split-auditor
python3 cli.py samples/input.json --output split-audit.json --html split-audit.html
```

## Investigate the failure boundary

Give two records the same id. Reject before constructing evidence because the resulting location would be ambiguous.




## References

[Primary technical reference](https://scikit-learn.org/stable/common_pitfalls.html)
