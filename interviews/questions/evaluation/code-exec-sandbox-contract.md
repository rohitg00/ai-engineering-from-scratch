---
id: code-exec-sandbox-contract
title: Score generated code without an exec in the eval process
card: evaluation
kind: design
level: 3
roles: [ai-evaluation-reliability-engineer, agentic-ai-engineer, applied-ai-engineer]
rounds: [system-design, design-review]
tags: [code-exec, sandbox, timeout, denylist, exit-codes]
minutes: 10
lessons: [phases/19-capstone-projects/72-code-exec-metric, phases/19-capstone-projects/49-lm-eval-harness]
manuals: []
practice: []
cheatsheet: [eval-driven-agents]
related: [evaluation/two-pass-at-k-formulas]
updated: 2026-11-03
---

You must score generated code by running it. A teammate proposes a call to the interpreter's eval function inside the harness process with a try block around it. Design the execution contract instead, and say how a timeout, a crash and a denylist hit each appear in the result.

## Short answer

Run every candidate in a fresh interpreter subprocess with a wall clock timeout, an output cap and an import denylist, never in the harness process. The score is the fraction of assertions that pass. A timeout, a syntax error, an assertion failure and any other crash each map to a distinct exit reason, so a reviewer can tell a slow solution from a wrong one while the score for most of them is zero.

## Full answer

### Why the subprocess

An in process call cannot survive a generated infinite loop, and it cannot survive a generated call that deletes the file system. A fresh interpreter per candidate takes the code on standard input, writes a JSON envelope of per assertion results to standard output, and dies when it overruns. The harness keeps running.

### The contract

1. **Extract** the first fenced code block from the generation, with the same post process rule the task spec uses.
2. **Build** a runner script around the code with the task's assertion strings.
3. **Spawn** a new interpreter with a default budget of 3 seconds of wall clock, clamped between 0.1 and thirty seconds by the runner.
4. **Cap** the output: the runner streams standard output and kills the child when the total passes 256 KB, recorded as an error with the detail output overflow.
5. **Deny** dangerous imports by rewriting them to raise an import error: the operating system shell call, subprocess, socket, shutil, the request libraries, and the foreign function interface. The list is a backstop. The timeout and the cap are the load bearing controls.

### The result vocabulary

| Exit reason | Meaning |
|---|---|
| pass | every assertion passed |
| assertion_fail | the code ran and at least one assertion failed |
| syntax_error | the code did not import |
| timeout | the wall clock expired |
| error | any other crash, including a denylist hit and output overflow |

The score stays a fraction: two of three assertions is 0.667. The exit reason is metadata, so the leaderboard layer can decide whether a timeout counts as zero or as missing data.

### What the smaller harness does

The smaller harness in the leaderboard lesson runs the prediction in a namespace with stripped builtins, and its test asserts that an import of the operating system module fails. It also caps the batch size for rate limits and pins the task files with a hash so a moved score can be traced to a moved task.

### What this is not

Not a sandbox for untrusted code from the open web, not a home for stateful tasks with files or network. Those need a container or a microVM.

## Follow-ups

- **Level 3:** Why is the denylist not the main control? Expected: determined code can escape any in process guard; the wall clock timeout and the output cap bound run time and output size whatever the code does. They do not bound memory or file writes, so production adds a read only file system and network isolation, or a container.
- **Level 3:** A candidate prints inside an infinite loop. Which control fires? Expected: the output cap at 256 KB, recorded as an error with the detail output overflow; the timeout would fire later.
- **Level 4:** How should the leaderboard treat timeouts, zero or missing? Expected: a documented choice; zero if slow code is wrong for the task, missing if you measure correctness alone, and the exit reason lets you report both.
- **Level 4:** When do assertion strings stop being enough? Expected: when the eval should match production CI; replace them with real unit test files in a container and stop calling the strings tests.

## Wrong answers

- "A try block around the call is a sandbox." It catches exceptions, not infinite loops, not file deletion, not memory floods.
- "The denylist makes it safe." It is a conservative backstop; the capstone states that it is not bulletproof.
- "Score a timeout as a crash." Keep them distinct in the exit reason; the score can be zero for both, but the reason tells you whether to raise the budget.

## Taught in

The [code exec metric capstone](../../../phases/19-capstone-projects/72-code-exec-metric/) gives the subprocess contract, the exit reasons and the limits, and the [language model evaluation harness capstone](../../../phases/19-capstone-projects/49-lm-eval-harness/) runs predictions in a stripped namespace and pins the task files.
