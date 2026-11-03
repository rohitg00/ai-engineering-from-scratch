---
id: what-a-feedback-record-carries
title: What one feedback record carries
card: agents
kind: concept
level: 1
roles: [agentic-ai-engineer, ai-developer-relations-engineer, forward-deployed-ai-engineer]
rounds: [screen, ml-breadth]
tags: [feedback-record, exit-code, truncation, redaction, telemetry]
minutes: 5
lessons: [phases/14-agent-engineering/37-runtime-feedback-loops]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops]
related: [agents/tests-passed-but-nothing-ran]
updated: 2026-11-03
---

You wrap every shell command that an agent runs so that the next turn can read what happened. What goes into the record, which field tells you whether the command worked, and what do you do when that field is empty?

## Short answer

The record carries the exact command as argv, the tail of stdout and the tail of stderr as separate fields, the exit code, the duration, the start time, and a one-line note of what the agent expected. The exit code is the success signal, because text can say anything and the code cannot. If the runner fails before it captures an exit, the record carries a null exit and an error reason, and the loop must not advance on it.

## Full answer

### The fields

| Field | Why it is there |
|---|---|
| `command` | Exact argv, so no shell expansion surprise |
| `stdout_tail` | The last lines of output, truncated the same way every time |
| `stderr_tail` | The last lines of errors, kept apart from stdout |
| `exit_code` | The one unambiguous success signal |
| `duration_ms` | Shows slow probes and runaway processes |
| `started_at` | A timestamp for replay |
| `agent_note` | What the agent expected before it read the result |

### Truncation that does not lose the error

A large log destroys the loop. The runner keeps a fixed number of head lines and tail lines and inserts a marker that says how many lines it removed. The same output always gives the same record. Nothing is sampled, because the final error and the final summary live at the tail.

### Redact at write

A record of stdout can carry a secret. The runner strips bearer tokens, password assignments, API keys and known key formats before it appends the line. Redaction at read time is a mistake, because the file on disk is what an attacker reaches.

### Feedback is not telemetry

Telemetry is for operators reviewing runs across time. Feedback is for the next turn of this run. They share fields and live in different files with different retention.

## Follow-ups

- **Level 1:** Why keep stderr separate from stdout? Expected: the failure summary often lands on one stream and progress on the other, and a merged tail can bury the summary.
- **Level 2:** A command times out. What does the record say? Expected: a null exit code, an error field with the timeout, and whatever partial output was captured, and the loop refuses to advance.
- **Level 2:** What is the agent note for? Expected: it records the prediction before the result, so a reviewer can see when the agent expected success and got a failure.
- **Level 3:** A retry succeeds. How does the audit see the first failure? Expected: each record has a command id, and the retry carries the parent command id, so the chain is visible and the retry does not look like an independent success.

## Wrong answers

- "Parse the output for the word error to detect failure." Output text varies by tool and language, and the exit code is the signal every command gives.
- "Keep the whole output, because truncation can hide something." A huge record pushes the loop out of its token budget, and the deterministic tail keeps the lines that matter.
- "Redact when a human opens the log." The file on disk is already the leak, so redaction has to happen before the append.

## Taught in

The [runtime feedback lesson](../../../phases/14-agent-engineering/37-runtime-feedback-loops/) builds the runner that writes this record.
