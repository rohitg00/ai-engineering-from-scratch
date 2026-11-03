---
id: tests-passed-but-nothing-ran
title: The agent said the tests passed, and no test ran
card: agents
kind: debug
level: 2
roles: [agentic-ai-engineer, ai-evaluation-reliability-engineer, forward-deployed-ai-engineer]
rounds: [debugging, design-review]
tags: [feedback-record, verification-gate, exit-code, acceptance-command]
minutes: 10
lessons: [phases/14-agent-engineering/37-runtime-feedback-loops, phases/14-agent-engineering/38-verification-gates]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops, agent-harness]
related: []
updated: 2026-11-03
---

A pull request from a coding agent says that the whole suite is green. A reviewer runs it and two tests fail. The transcript shows the agent writing "running tests now" and then "all tests pass", with nothing between the two lines. What happened, and what do you build so that this claim cannot reach a reviewer again?

## Short answer

The agent predicted the output instead of reading it. Either no command ran, or the command ran and nobody captured the result into the loop. The fix has two parts: a feedback runner that records every command with its exit code, and a verification gate that reads those records and refuses to mark the task done unless each acceptance command ran and exited zero.

## Full answer

### Three ways the claim appears

1. **No command ran.** The model wrote the words it expected to write next. Nothing in the transcript shows argv, output or an exit code.
2. **The command ran, and the result never came back.** A runner that errors before it captures the exit leaves the model with nothing to read, and the model fills the gap.
3. **The result came back, and the failure line was cut.** A long output trimmed from the end loses the summary line where the failures are.

The transcript in this case has no record between the two sentences, so it is the first or the second.

### The feedback runner

Every command goes through one wrapper. The record carries the exact argv, the tail of stdout and stderr as separate fields, the exit code, the duration, the start time, and a one-line note of what the agent expected. The runner truncates head and tail in a fixed way with a marker for the lines it removed, so the final error line survives. If the runner fails before it captures an exit, the record carries `exit_code: null` and an `error` field, and the loop must not advance on it. No exit, no progress.

### The verification gate

The gate is a pure function over the artifacts. For this failure it checks three things from the feedback log: every acceptance command appears in the records, each one exited zero, and no record has a null exit. Each of those is a block-severity finding. A block prevents `passed: true`, and only a human can override it, with a reason and a user id in a signed log. The gate runs in CI and before the handoff. No green verdict, no pull request.

### Why the model is not the fix

A prompt that says "always run the tests" asks the model to be honest about something it cannot see. The runner makes the result visible. The gate makes the claim checkable. Neither depends on the model.

## Follow-ups

- **Level 2:** Why does the record keep stdout and stderr in separate fields? Expected: a test runner writes the failure summary to one stream and progress to the other, and a merged tail can hide the summary behind progress lines.
- **Level 2:** The agent runs the acceptance command, it fails, and a retry passes. What does the gate see? Expected: two records for the same command, linked by the parent command id. The gate blocks on the failed record and does not report `passed: true`, even though the retry exited zero. Only a signed human override gets past it, and the chain keeps the failure history visible.
- **Level 3:** Why must the gate be deterministic and not a model judge? Expected: the gate answers whether the task is complete, which must give the same verdict for the same artifacts every time, while a judge gives a qualitative opinion that belongs on the review side.
- **Level 4:** Where do you place the gate so that it cannot be bypassed? Expected: in layers, with a pre-commit hook, a CI status check, and a pre-merge gate, so that a failure in one layer is caught by the next.

## Wrong answers

- "Tell the agent to paste the test output into the transcript." The model can paste what it expects, and a reviewer cannot tell a paste from a capture.
- "Trust the agent and let CI catch it." CI did catch it, after the claim reached a reviewer, and the point is to stop the claim at the source.
- "Treat a timeout as a pass, because the tests were slow." A timeout gives a null exit, and the loop must refuse to advance on a null exit.

## Taught in

The [runtime feedback lesson](../../../phases/14-agent-engineering/37-runtime-feedback-loops/) builds the runner, and the [verification gates lesson](../../../phases/14-agent-engineering/38-verification-gates/) builds the gate that reads its records.
