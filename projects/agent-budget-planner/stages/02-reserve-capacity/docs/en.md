# Reserve capacity before dispatch

Stage 2 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

Checking available budget without reserving it allows multiple queued requests to spend the same capacity. Store reservations separately from settled spending. A new request must fit after both quantities are counted.

This single-process state machine teaches the invariant. It does not claim distributed concurrency safety. A service version needs an atomic transaction or lock around this exact transition.

## Work through one concrete case

Start at limit 100, spent 20, holds={A:30}. Available capacity is 50, so reserving B:60 fails without changing A. A second reservation using id A also fails even if its amount is 1.

```figure
pj-agent-budget-planner-2
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `reserve` against the stated contract.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Build a new holds dictionary only after validating the identity and amount. Admission and reservation must be one state transition; an earlier available() check alone permits double spending.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py agent-budget-planner --init learning-artifacts/agent-budget-planner`. Then grade cumulatively:

```bash
python3 scripts/project_test.py agent-budget-planner --stage 2 --path learning-artifacts/agent-budget-planner --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/agent-budget-planner
python3 cli.py samples/input.json --mode execute --output budget.json
```

## Investigate the failure boundary

Trace two callers both observing 50 free units. Name the lock or database transaction a service needs around reserve.




## References

[Primary technical reference](https://docs.python.org/3/library/decimal.html)
