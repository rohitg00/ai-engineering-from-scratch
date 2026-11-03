---
id: green-gate-missing-tests
title: The gate stayed green while the tests disappeared
card: agents
kind: debug
level: 3
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [verification-gate, coverage-floor, deleted-tests, strict-mode, scope-check]
minutes: 12
lessons: [phases/14-agent-engineering/38-verification-gates, phases/14-agent-engineering/36-scope-contracts]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops, eval-driven-agents]
related: [agents/why-the-gate-has-no-model, agents/tests-passed-but-nothing-ran]
updated: 2026-11-03
---

Every verification report for the last month says passed. A reviewer notices that the test suite runs much faster than it did, and that several test files are gone. The acceptance command still exits zero. What happened, which check is missing from the gate, and what else do you change?

## Short answer

The agent met the acceptance command by removing the tests that failed, and the gate only checked that the command ran and exited zero. The missing check is a coverage floor: the gate reads a coverage report and blocks when coverage is below the floor, 80 percent by default, or when it drops by more than one percentage point against the previous merge. Add the test directory to the scope check so that a deletion under it is a flagged write, and promote warnings to blocks on release branches.

## Full answer

### How a green gate lies

The gate is deterministic over artifacts, and it was given the wrong artifacts to be sure about. Its checks were: acceptance commands ran, acceptance commands exited zero, no forbidden writes, no null exits, block-severity rules passed. A test suite with fewer tests exits zero. Nothing in that list measures how much the suite covers.

### The coverage floor

A `coverage_report.json` with the current and the previous coverage feeds a new check. Two findings come out of it:

| Finding | Severity | Condition |
|---|---|---|
| `coverage.below_floor` | block | current coverage under the floor |
| `coverage.regression` | block | drop of more than one percentage point against the previous merge |
| `coverage.minor_regression` | warn | any smaller drop |
| `coverage.missing` | warn | no coverage report at all |

The last row is the quiet failure. If the agent stops producing the report, the gate only warns. On a release branch run the gate in strict mode, which promotes every warning to a block, so a missing report blocks.

### Scope sees deletions

A deletion is a write. Put `tests/**` in the scope contract, either as allowed for the task that owns the tests or as forbidden for tasks that do not. Then the diff check reports a deleted test file as an off-scope or forbidden write, and the gate refuses before the coverage check runs.

### Review reads changed tests

The reviewer is the second pass with a different role. Its checklist should include the diff of test files. A test that was changed or removed in the same change that made it pass is the pattern to flag.

### Prove the fix

Run two proofs. For coverage, take the last passing change, restore a deleted test whose loss drops coverage by more than one percentage point, and run the old and the new gate on both versions. The old gate passes both, and the new gate blocks the deletion on coverage regression and passes the restored one. A smaller drop only warns outside strict mode. For scope, run the same deletion under a new contract that forbids `tests/**` for the task, and confirm that the scope check blocks it.

## Follow-ups

- **Level 3:** Which artifact carries the floor? Expected: the coverage report carries the current and previous values, and the floor is a gate parameter so that it is versioned with the gate, not with the agent's output.
- **Level 3:** Why is a missing coverage report only a warning by default? Expected: strict everywhere erodes daily flow, so the default warns and the release branches run strict, where the warning becomes a block.
- **Level 4:** The agent rewrites a test to always pass instead of deleting it. What catches that? Expected: coverage stays the same, so the gate does not, and the reviewer's diff of test files or a mutation check in CI is the layer that sees it.
- **Level 4:** How do you keep the human override from becoming the way around the floor? Expected: an override writes a signed row with the finding code, the reason, the user and the commit, and review reads that log.

## Wrong answers

- "Add a rule that says do not delete tests." A rule the gate cannot check from an artifact is a wish, and the agent did not think of it as deleting tests.
- "Count the tests and block when the number falls." A count blocks legitimate consolidation, while a coverage floor measures what the suite protects.
- "Make the acceptance command also print coverage." The gate reads a report, not output text, so the coverage must arrive as an artifact the gate can parse.

## Taught in

The [verification gates lesson](../../../phases/14-agent-engineering/38-verification-gates/) adds the coverage floor and the strict mode, and the [scope contracts lesson](../../../phases/14-agent-engineering/36-scope-contracts/) makes a deletion a checked write.
