# Settle actual usage and release unused budget

Stage 3 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

A reservation is a ceiling, not an invoice. When a request finishes, remove its hold and add actual spending. On cancellation, release the hold with zero spending.

A reported actual cost above the reservation is an accounting violation. Preserve the old ledger and raise an error so the caller can reconcile rather than silently producing a negative balance.

## Work through one concrete case

A 70-unit hold with an actual 20-unit receipt releases 50 and moves 20 into spending. A missing receipt preserves the 70-unit hold; a reported 71 triggers reconciliation instead of silently increasing the budget.

```figure
pj-agent-budget-planner-3
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `settle` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Store closed request ids so a duplicate receipt cannot spend twice. Read the old state after an exception and prove that it is unchanged.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py agent-budget-planner --init learning-artifacts/agent-budget-planner`. Then grade cumulatively:

```bash
python3 scripts/project_test.py agent-budget-planner --stage 3 --path learning-artifacts/agent-budget-planner --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/agent-budget-planner
python3 cli.py samples/input.json --mode execute --output budget.json
```

## Investigate the failure boundary

The integration callback throws after doing work. Explain why releasing the reservation would hide an unknown liability.




## References

[Primary technical reference](https://docs.python.org/3/library/decimal.html)
