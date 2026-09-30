# Agent Budget Planner

A receipt-aware budget controller that keeps uncertain spending visible.

Python 3.10+; functions, dictionaries, exceptions, integer arithmetic and callback functions. The core uses standard libraries. The grader checks your selected workspace; it never fills in missing behavior from the reference.

## Build and run your version

From the repository root, initialize once. A fresh starter fails intentionally.

```bash
python3 scripts/project_test.py agent-budget-planner --init learning-artifacts/agent-budget-planner
python3 scripts/project_test.py agent-budget-planner --stage 1 --path learning-artifacts/agent-budget-planner --strict
```

Implement each stage, then run the cumulative grader and the supplied input driver:

```bash
python3 scripts/project_test.py agent-budget-planner --all --path learning-artifacts/agent-budget-planner --strict
cd learning-artifacts/agent-budget-planner
python3 cli.py samples/input.json --mode execute --output budget.json
```

The driver and offline samples are provided scaffolding. Its imports resolve to your implementation. Public input types and function signatures live in the starter and [API contract](API.md).

## Inspect the reference separately

From the repository root:

```bash
python3 scripts/project_test.py agent-budget-planner --all --solution --strict
cd projects/agent-budget-planner/solution
python3 cli.py samples/input.json --mode execute --output budget.json
```

## Observe the change

The recording requests 190 units against a 100-unit limit. Executing the supplied hash jobs admits two jobs, rejects one and settles 95 units; missing receipts keep their holds.

Edit a copy of the sample and rerun the command. Keep the input beside the output so someone else can reproduce the result; the supplied samples are authored teaching data.

## Integration and limits

Import execute_jobs and provide invoke(job) -> (value, actual_cost). Use unit=nano_dollars only when rates and receipts have actually been converted to that unit.

Costs are caller-supplied integer receipts. A monotonic deadline gates dispatch but cannot interrupt a synchronous callback. The ledger is single-process and in-memory.

## Stages

1. [Estimate requests in integer microcredits](stages/01-estimate-cost/docs/en.md)
2. [Reserve capacity before dispatch](stages/02-reserve-capacity/docs/en.md)
3. [Settle actual usage and release unused budget](stages/03-settle-and-release/docs/en.md)
4. [Schedule within cost and time limits](stages/04-schedule-under-deadlines/docs/en.md)


## Primary references

[Mechanism and API reference](https://docs.python.org/3/library/decimal.html)
