# Publish accuracy and latency together

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Quality and latency measure different tradeoffs. Use nearest-rank percentiles so the definition is reproducible on small samples. Report p50 and p95 alongside accuracy, coverage, calibration, and number of measured predictions.

The included demo uses explicitly synthetic recorded latencies, not timing claims about any local model. Substitute real measurements before making a performance decision.

## Work through one concrete case

Latencies[80,100,120,300,900] have nearest-rank p95 at ceil(.95*5)=5, so p95=900. The recording manifest keeps model revision, prompt revision, hardware and confidence method beside this number.

```figure
pj-local-model-eval-harness-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `scorecard` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

record.py sends only the prompt to the model endpoint; expected labels remain local. Use a monotonic clock around the actual request and feed the resulting recording to cli.py.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py local-model-eval-harness --init learning-artifacts/local-model-eval-harness`. Then grade cumulatively:

```bash
python3 scripts/project_test.py local-model-eval-harness --stage 4 --path learning-artifacts/local-model-eval-harness --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/local-model-eval-harness
python3 cli.py samples/input.json --output scorecard.json --html reliability.html
```

## Investigate the failure boundary

Compare two recordings with different labels. The CLI must reject the comparison even when both datasets have the same number of cases.

Reported confidence is model self-report unless your adapter defines another method. ECE varies with bins and sample count. No model is downloaded or started, and the sample is not a hardware benchmark.


## References

[Primary technical reference](https://docs.python.org/3/library/statistics.html)
