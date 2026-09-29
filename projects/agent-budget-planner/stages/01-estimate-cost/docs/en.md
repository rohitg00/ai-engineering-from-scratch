# Estimate requests in integer microcredits

Stage 1 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Floating point costs accumulate rounding errors. Represent rates and costs as integers in a documented unit. A request estimate charges prompt tokens and an output ceiling at separate per-token rates.

Rates in this fixture are arbitrary teaching units, not provider prices. Output ceilings reserve worst-case cost so the scheduler can decide before invoking a model. Actual usage is settled later.

## Work through one concrete case

A prompt has 120 tokens and allows 40 output tokens. At integer rates 2 and 5, its ceiling is 120*2+40*5=440 units. With output_limit=0 the ceiling is still 240.

```figure
pj-agent-budget-planner-1
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `estimate` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Validate booleans separately from integers in Python: True must not become one token. Check every operand before multiplying, then retain the caller's unit beside the result.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py agent-budget-planner --init learning-artifacts/agent-budget-planner`. Then grade cumulatively:

```bash
python3 scripts/project_test.py agent-budget-planner --stage 1 --path learning-artifacts/agent-budget-planner --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/agent-budget-planner
python3 cli.py samples/input.json --mode execute --output budget.json
```

## Investigate the failure boundary

Change the output ceiling from 40 to 400. The estimate becomes 2240 units. With 40 actual output tokens the invoice is 440, a gap of 1800; with zero actual output tokens the invoice is 240, the maximum gap of 2000. Explain why reserving a ceiling differs from settling a receipt.




## References

[Primary technical reference](https://docs.python.org/3/library/decimal.html)
