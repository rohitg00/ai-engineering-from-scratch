# Measure confidence calibration

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

A model that is wrong with 99 percent confidence is more dangerous to an automated router than a model that admits uncertainty. Expected calibration error groups predictions by confidence and compares average confidence with actual correctness.

ECE depends on bin choice and sample count. Report every nonempty bin, its size, and its gap. A tiny sample or an apparently low ECE does not establish calibrated probabilities on new tasks.

## Work through one concrete case

Four predictions at confidence 0.9 contain three correct answers. Their observed accuracy is0.75 and their single-bin gap is0.15. A second bin with one confident wrong answer must be weighted by one sample, not equally with the four-sample bin.

```figure
pj-local-model-eval-harness-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `calibration` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Place confidence 1.0 in the final bin with min(index,bins-1). Report nonempty bin counts beside ECE so the average cannot conceal tiny evidence.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py local-model-eval-harness --init learning-artifacts/local-model-eval-harness`. Then grade cumulatively:

```bash
python3 scripts/project_test.py local-model-eval-harness --stage 3 --path learning-artifacts/local-model-eval-harness --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/local-model-eval-harness
python3 cli.py samples/input.json --output scorecard.json --html reliability.html
```

## Investigate the failure boundary

Split the same records into five and ten bins. Explain why the ECE changes even though the model answers did not.




## References

[Primary technical reference](https://docs.python.org/3/library/statistics.html)
