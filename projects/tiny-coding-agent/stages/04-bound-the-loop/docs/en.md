# Stop the coding loop on evidence or budget

**Stage 4 of 4.** Python. Plan about 2 hours.

A coding agent alternates actions and observations. Here the planner is an explicit recorded list of tool calls, making the loop deterministic and easy to inspect. The tools perform real file edits and real test runs.

Count every action against a step budget. Stop immediately when tests pass, when a tool call is invalid, or when the budget is exhausted. A production model can later supply the same typed actions without changing tool execution.

```figure
pj-tiny-coding-agent-4
```

Primary reference: [Primary technical reference](https://docs.python.org/3/library/subprocess.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [The agent loop](../../../../../phases/14-agent-engineering/01-the-agent-loop/docs/en.md). Complete [stage 3](../../03-run-real-tests/docs/en.md) first.

The planner now receives each observation. It tests first, selects a supplied exact repair only when its failure marker appears, then tests again. This transparent rule planner does not claim to invent code from a model.

```text
test -> AssertionError
proposal marker matches -> patch
test -> OK -> completed
```

## Build and inspect

Call the planner again after every tool result. Retain the requested action with each observation and stop on abstention or exhausted steps.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py tiny-coding-agent --stage 4 --path learning-artifacts/tiny-coding-agent
```

After the cumulative stages pass, run your artifact on the original sample input from the repository root:

```bash
python3 learning-artifacts/tiny-coding-agent/cli.py projects/tiny-coding-agent/examples/workspace projects/tiny-coding-agent/examples/proposals.json --copy-to basket-repair --out repair-trace.json
```

The CLI copies a trusted Python workspace to a new destination, then runs its tests as local code. The supplied proposal planner selects prewritten repairs from observed failures; it does not invent patches. POSIX process-group timeout stops descendants, but memory and output quotas require an OS-level runner.

## Investigate next

How would you plug in a model while keeping the same patch preconditions and completion rule?
