# Track budgets and terminal state

**Stage 3 of 4.** Rust. Plan about 2 hours.

Wrap the tools in a session that owns its root, request count and closed state. Every parsed request, including rejected commands, consumes one action slot. Quit is terminal. A request beyond the budget emits a terminal error. Distinguish parsing rejection from an execution error so callers can repair a command without confusing it with a missing file.

```figure
pj-rust-agent-shell-3
```

## Worked Orchard case

Before coding, review [Rust ownership and Result](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html) and [Data management](../../../../../phases/00-setup-and-tooling/09-data-management/docs/en.md). Complete [stage 2](../../02-filesystem/docs/en.md) first.

The session owns a request budget and terminal state. Invalid requests consume an attempt too. Expose the budget through the executable argument and adapter --limit so callers can reason about bounded work.

```text
limit=2
request 1: list -> step 1
request 2: rejected grammar -> step 2
request 3 -> terminal budget_exhausted
```

## Build and inspect

Increment once per received request, before dispatch. Once closed, the session must not read more files.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py rust-agent-shell --stage 3 --path learning-artifacts/rust-agent-shell
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

How should a client handle output ending before its request id receives an event?
