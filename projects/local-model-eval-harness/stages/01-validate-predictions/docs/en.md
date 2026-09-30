# Validate prediction records

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

A prediction record is evidence: id, answer, confidence, and measured latency. Require unique ids and finite numbers. NaN can otherwise slip past comparisons and turn a failure into an apparently valid report.

The harness consumes recordings so every metric test runs without a model. To evaluate a real local model, record its responses in the same contract and keep the execution environment beside the resulting JSON.

## Work through one concrete case

Two records with idcase-a make joining to labels ambiguous, so validation rejects them even if their answers agree. Confidence must be finite and within 0..1; NaN must fail before any comparisons or averages.

```figure
pj-local-model-eval-harness-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `validate` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

A boolean is an integer subclass in Python but is not a latency measurement. Preserve answer, confidence, latency and id together so later metrics cannot accidentally align by array position.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py local-model-eval-harness --init learning-artifacts/local-model-eval-harness`. Then grade cumulatively:

```bash
python3 scripts/project_test.py local-model-eval-harness --stage 1 --path learning-artifacts/local-model-eval-harness --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/local-model-eval-harness
python3 cli.py samples/input.json --output scorecard.json --html reliability.html
```

## Investigate the failure boundary

Reorder prediction rows and prove the score stays the same. Then duplicate one id and confirm that the run fails instead of double-counting it.




## References

[Primary technical reference](https://docs.python.org/3/library/statistics.html)
