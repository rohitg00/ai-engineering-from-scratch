---
id: a-login-fix-touched-five-files
title: A login fix touched five files
card: agents
kind: debug
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [debugging, design-review]
tags: [scope-contract, scope-creep, diff-check, forbidden-files, globs]
minutes: 10
lessons: [phases/14-agent-engineering/36-scope-contracts]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops]
related: [agents/tests-passed-but-nothing-ran]
updated: 2026-11-03
---

The task given to the agent was to fix one login bug. The diff changes the login route, an email helper, the database driver, the README and the release script. The transcript gives a plausible reason for each change. The reviewer rejects the pull request and asks you what went wrong and how to stop it. What do you say?

## Short answer

This is scope creep, and it is hard to see because the agent explains each step in good faith. The fix is not a stricter prompt. It is a contract on disk that lists the files the task may change and the files it must never change, plus a check that compares the final diff with that contract. The check runs before the gate, and a write to a forbidden path blocks the task.

## Full answer

### Why the prompt did not hold

Each change had a local reason. The model does not know where the task ends, so it extends the task every time it finds something related. "Stay in scope" in a prompt is a wish. A file that says what in scope means is a check.

### The scope contract

| Field | Purpose |
|---|---|
| `task_id` | Points at the task on the board |
| `goal` | One sentence that a reviewer can verify |
| `allowed_files` | Globs the agent may write |
| `forbidden_files` | Globs the agent must not touch, even by accident |
| `acceptance_criteria` | Commands or assertion lines that prove done |
| `rollback_plan` | One paragraph an operator can run if the task must be halted |
| `approvals_required` | Actions outside scope that need a human sign-off |

Two rules about the fields. First, a contract without `forbidden_files` is incomplete, because the negative space is half the contract. Second, use globs and not raw paths, so that a file move between sessions does not void the contract.

### The check

The checker reads the diff, the allowed globs and the forbidden globs, and returns the violations, the in-scope files and the off-scope files. For this pull request it reports the release script as a forbidden write and the README, the email helper and the driver as off-scope writes. Severity differs by path family: an off-scope write under `docs/**` is a warning, and a write under `scripts/**`, `migrations/**` or production config is always a block. That asymmetry lives in the contract, because it changes per project and per task.

### Make it survive the team

A gate that fails on every small slip gets switched off. Give each task a violation budget so that minor slips surface as warnings, and only a budget overrun blocks the merge. One practitioner who wrote scope contracts before each run reported that the rabbit-hole rate fell from 52 percent to 21 percent in three weeks, with the same agent.

### The second altitude

A contract bounds one task, not the project. An agent can respect the login contract and then start a settings page on the next turn. A `feature_list.json` with at most one feature `in_progress` closes that gap. The task contract's allowed files must sit inside what the active feature touches.

## Follow-ups

- **Level 2:** The agent needed a one-line change in the email helper to fix the bug. What should have happened? Expected: the checker flags the off-scope write, the agent opens a question, and a human either grows the contract or asks the agent to back off.
- **Level 3:** How do you keep the contract valid when a refactor moves the login code? Expected: write the globs by pattern such as `app/**/login*.py`, not by exact path, and archive the contract when the task closes.
- **Level 3:** Two contracts apply to one diff, one for the project and one for the task. What is the merge rule? Expected: least privilege, so intersect the allowed globs, union the forbidden globs, and take the most restrictive time budget.
- **Level 4:** File globs are not the only scope dimension. What else belongs in the contract? Expected: a wall-clock budget and a network egress allowlist, because an agent can stay inside its files and still call a service that was not part of the task.

## Wrong answers

- "Add a sentence to the prompt that says stay in scope." The agent already believed it was in scope at every step, so the sentence changes nothing without a check.
- "Review the diff by hand more carefully." Human review caught it this time, after the agent spent the budget, and the point is to catch it before the pull request exists.
- "Block every write outside the task files." A hard block on a README edit trains the team to disable the gate, so use warnings for low-risk paths and blocks for scripts and migrations.

## Taught in

The [scope contracts lesson](../../../phases/14-agent-engineering/36-scope-contracts/) builds the contract, the diff checker and the feature list.
