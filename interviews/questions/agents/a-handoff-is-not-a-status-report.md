---
id: a-handoff-is-not-a-status-report
title: What a handoff packet carries that a status report does not
card: agents
kind: concept
level: 1
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-developer-relations-engineer]
rounds: [screen, ml-breadth]
tags: [handoff, next-action, multi-session, clean-state, state-file]
minutes: 6
lessons: [phases/14-agent-engineering/40-multi-session-handoff]
manuals: []
practice: []
cheatsheet: [agent-workbench-ops]
related: [agents/seven-surfaces-one-symptom-each]
updated: 2026-11-03
---

At the end of each session your agent writes a paragraph that says what it did. The next session still spends its first half hour finding out where things stand. What is missing from the end-of-session artifact, and how do you produce it so that it is never skipped?

## Short answer

The paragraph is a status report, and a handoff needs seven fields: a summary, the changed files, the commands run, the failed attempts, the open risks, the next action and a pointer to the verification and review reports. The next action is the most important field, because it makes the first step of the next session deterministic. Generate the packet from the workbench artifacts instead of asking the agent to write it, and run a cleanup check first so that the packet describes a tree the next session can trust.

## Full answer

### The seven fields

| Field | Question it answers |
|---|---|
| `summary` | What was done, in one paragraph |
| `changed_files` | The diff at a glance |
| `commands_run` | What was executed, from the feedback records |
| `failed_attempts` | What was tried and why it did not work |
| `open_risks` | What can hurt the next session, with a severity |
| `next_action` | The first concrete step the next session takes |
| `verdict_pointer` | The path to the verification and review reports |

A packet with every field except `next_action` is a status report. It is useful, but the next session still has to decide what to do first.

### Generated, not written

A hand-written handoff is the thing that gets skipped on a hard day. The generator reads the state file, the verification report, the review report and the feedback log, and emits the packet in two forms. `handoff.md` is for the human. `handoff.json` is for the next agent. If they disagree, the JSON wins. The agent's job is to leave the workbench in a state the generator can summarize.

### Trim the log

The feedback log can hold hundreds of records. The packet carries only the last K plus every record with a non-zero exit. The next session loads the full log if it needs it.

### Leave a clean state

A perfect packet is useless if the next session opens on a half-applied diff, a stray temp file, a wrong branch and tests that error before they run. Cleanup is its own phase, and it is a check, not a habit. The working tree is committed or stashed with a note. No temp artifacts remain. Tests are green, or red with the failure named in the open risks. The feature board matches reality. The branch is the expected one. The cleanup phase emits a list of blocking issues, and an empty list is the precondition the generator asserts before it writes.

## Follow-ups

- **Level 1:** Why does the JSON win when the two forms disagree? Expected: the next agent loads the JSON, so the machine-readable form is the one that drives the next session.
- **Level 2:** Which failed attempts belong in the packet? Expected: every record with a non-zero exit, with the retry chain visible, so that the next session does not repeat a known dead end.
- **Level 2:** What is the difference between a handoff and the state file? Expected: the state file is read on every turn and holds where the agent is, while the handoff is generated once at session end and tells the next session where to start.
- **Level 3:** Two sessions on two branches each wrote a handoff. How does the next session pick one? Expected: each packet carries a branch, a last known good commit and a status of active, superseded or archived, and only the active packet for this branch drives the session.

## Wrong answers

- "Ask the agent to write a detailed summary at the end." A written summary is skipped when the session ends badly, and it is the bad sessions that need the handoff most.
- "The chat history is the handoff." The history is trimmed or gone, and the next session cannot replay an hour of chat in its first minute.
- "A green verification report is enough to resume." The report proves the task state, not the tree state, and a dirty tree costs the next session its first ten minutes.

## Taught in

The [multi-session handoff lesson](../../../phases/14-agent-engineering/40-multi-session-handoff/) builds the packet out of the workbench files and adds the cleanup check.
