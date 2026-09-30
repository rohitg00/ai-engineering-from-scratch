# Report split size and leakage together

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

A clean split can still be useless when nearly all records land in training. Report row counts, group counts, and leakage in one artifact. Keeping these numbers together prevents a clean-leakage claim from hiding an empty test set.

The checker does not certify statistical representativeness. Time-dependent tasks often need a chronological split, which this project deliberately leaves as a later extension.

## Work through one concrete case

A report with zero leaks and test_rows=0 is unusable. The supplied dirty fixture has both partitions but still fails because content and group evidence remain. These are distinct reasons for the same gate outcome.

```figure
pj-dataset-split-auditor-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `summarize` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

The CLI composes summarize with provenance indexes and optionally returns exit 2. A CI job should retain the JSON artifact even when the gate fails so a reviewer can locate the problem.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py dataset-split-auditor --init learning-artifacts/dataset-split-auditor`. Then grade cumulatively:

```bash
python3 scripts/project_test.py dataset-split-auditor --stage 4 --path learning-artifacts/dataset-split-auditor --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/dataset-split-auditor
python3 cli.py samples/input.json --output split-audit.json --html split-audit.html
```

## Investigate the failure boundary

Create an authored clean pair, run --check and confirm exit 0. Add a normalized copy under a new id and confirm exit 2 with both original ids in the artifact.

Normalization finds exact normalized copies, not paraphrases. Stable group hashing does not guarantee balanced classes or time-aware evaluation. Source text remains present in exported partitions.


## References

[Primary technical reference](https://scikit-learn.org/stable/common_pitfalls.html)
