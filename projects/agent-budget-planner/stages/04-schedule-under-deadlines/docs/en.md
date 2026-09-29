# Schedule within cost and time limits

Stage 4 of 4. Read the [project prerequisites](../../../README.md) before starting; this stage builds on the preceding contracts.

## What changes

A bounded agent needs more than a money counter. Apply a deadline and a cost limit before each sequential job, then append an explicit completed or rejected event. Test deterministic durations rather than sleeping.

This is a simulator for admission decisions, clearly separated from execution. The JSON trace lets you inspect which constraint rejected each job. It is not a benchmark of model latency.

## Work through one concrete case

Two jobs each reserve 70 against limit 100. In execution mode, the first settles 20; the second now fits and settles 20. In conservative replay with costs 70 and 70, only the first fits. The different traces follow different evidence.

```figure
pj-agent-budget-planner-4
```

Change the lab inputs and calculate the result before reading its metrics. The figure computes from those inputs; the implementation tests below remain the source of completion evidence.

## Implement the contract

Implement `schedule` against the stated contract. Emit each outcome in `events[].status`: `completed` for an admitted job, or `rejected` with its deadline or budget reason. The execution driver uses the same status field and adds `needs_reconciliation` for uncertain receipts.

Use the [public API contract](../../../API.md) and the typed starter signatures. Return values from core functions and let the supplied driver own file input, argument parsing and presentation.

Keep schedule as a deterministic admission replay. The supplied execute_jobs driver calls your reserve and settle functions around an actual callback; do not substitute predicted duration for the callback's elapsed clock.

## Verify and inspect

From the repository root, initialize once with `python3 scripts/project_test.py agent-budget-planner --init learning-artifacts/agent-budget-planner`. Then grade cumulatively:

```bash
python3 scripts/project_test.py agent-budget-planner --stage 4 --path learning-artifacts/agent-budget-planner --strict
```

A fresh workspace should fail until you implement the contract. After every stage is complete, run your actual artifact from the supplied sample:

```bash
cd learning-artifacts/agent-budget-planner
python3 cli.py samples/input.json --mode execute --output budget.json
```

## Investigate the failure boundary

Add an invocation that sleeps past the deadline. The next dispatch must stop, but this synchronous implementation cannot interrupt the already-running callback.

Costs are caller-supplied integer receipts. A monotonic deadline gates dispatch but cannot interrupt a synchronous callback. The ledger is single-process and in-memory.


## References

[Primary technical reference](https://docs.python.org/3/library/decimal.html)
