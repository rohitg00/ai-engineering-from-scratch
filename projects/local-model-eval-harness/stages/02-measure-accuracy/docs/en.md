# Measure normalized exact-answer accuracy

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Exact-answer matching is appropriate for constrained outputs such as labels and short reference answers. Normalize case and whitespace only; do not remove facts or punctuation to inflate a score.

Require one prediction per labeled item and reject unknown ids. Missing predictions count as incorrect in the denominator. The coverage metric reveals how much of the dataset was actually attempted.

## Work through one concrete case

With ten labels, six correct predictions, two wrong predictions and two missing predictions, accuracy is6/10 and coverage is8/10. Dividing by eight would reward a system for avoiding difficult cases.

```figure
pj-local-model-eval-harness-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `accuracy` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Normalize only case and repeated whitespace for this task. Keep punctuation and facts intact. Reject prediction ids absent from the expected label map.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py local-model-eval-harness --init learning-artifacts/local-model-eval-harness`. Then grade cumulatively:

```bash
python3 scripts/project_test.py local-model-eval-harness --stage 2 --path learning-artifacts/local-model-eval-harness --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/local-model-eval-harness
python3 cli.py samples/input.json --output scorecard.json --html reliability.html
```

## Investigate the failure boundary

Record only one easy correct answer from a ten-case dataset. Predict accuracy 0.1 and coverage 0.1 before running the scorer.




## References

[Primary technical reference](https://docs.python.org/3/library/statistics.html)
