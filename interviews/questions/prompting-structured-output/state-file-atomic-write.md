---
id: state-file-atomic-write
title: Review a state write that can corrupt the next session
card: prompting-structured-output
kind: code-reading
level: 4
roles: [agentic-ai-engineer, applied-ai-engineer]
rounds: [coding, design-review]
tags: [repo-memory, atomic-write, schema, idempotency, code-reading]
minutes: 12
lessons: [phases/14-agent-engineering/34-repo-memory-and-state]
manuals: []
practice: []
cheatsheet: [context-engineering]
related: [prompting-structured-output/take-home-two-tier-memory]
updated: 2026-11-03
---

An agent workbench persists its state between sessions with this code. Review it. What can go wrong, what does the lesson's writer do instead, and what else belongs around the write?

```python
def save_state(path, state):
    try:
        path.write_text(json.dumps(state))
    except Exception:
        return
```

## Short answer

Two faults. A crash in the middle of the write leaves a truncated file that the next session loads as corrupt state, and the silent except hides it, so the agent resumes against garbage with no signal. The lesson's writer creates a temp file in the same directory, writes, syncs to disk and renames over the target, so the file on disk is either the old version or the new one. Around it belong a schema check that refuses a bad state before it is written, a version field with a migration path, and idempotency keys for tool calls that are not safe to repeat.

## Full answer

### The two bugs

The lesson points at a bug report from an open-source project in March 2026 with this exact shape: the state file was written with a plain text write and exceptions were caught and silenced. Partial writes left sessions resuming against corrupt state with no signal. The first bug is the non-atomic write. The second is the except clause that turns a loud failure into a quiet one.

### The atomic writer

1. Create a temp file with `tempfile.mkstemp` beside the target, inside its directory.
2. Write the content.
3. `fsync` so the bytes reach the disk.
4. `os.replace` the temp file over the target, which is an atomic rename on POSIX and on Windows.

A reader sees the old file or the new file, never a mix.

### Schema first

The state file carries a contract: required keys, an enum of allowed status values, forbidden values such as null for an array, a pattern for task ids, and a `schema_version` integer. The manager validates before it writes, so a bad write is a refused write, and it refuses to load a file at a version it cannot migrate. A migration script ships with every schema bump and runs idempotently on startup.

### Around the write

- **Idempotency keys.** If a crash lands between a tool call and its checkpoint, recovery retries the call. Fine for a read; dangerous for an email or a database insert. Log a started record with the call id before execution and a completed record with the result after it. On retry, a call with a completed record is skipped and its stored result is used. A call with only a started record may or may not have run, so reconcile it first, for example by asking the target system whether that idempotency key was applied, before you repeat or skip it.
- **Small state, separate artifacts.** Transcripts, generated files and data sets live in their own files or in object storage; the state holds only the paths.
- **Event log plus snapshot.** Append every mutation to an event log and snapshot the state on a schedule; resume reads the snapshot and replays later events, which also lets you replay agent decisions when debugging.

### What belongs in the file

The active task id, the files touched this session, the assumptions made, open blockers and the next action. Not raw transcripts, reasoning traces, sampled completions or vendor model ids. The test is whether the entry would be useful three months from now in a CI rerun.

## Follow-ups

- **Level 3:** Why does the temp file live in the same directory as the target? Expected: so the final step is a rename on the same filesystem and stays atomic; the lesson's recipe is a temp file beside the target, write, sync, replace.
- **Level 4:** An agent crashes after a tool call and before the checkpoint. What goes wrong on recovery, and what fixes it? Expected: the call is retried, which is dangerous for an email or an insert; log a started record with the call id before execution and a completed record with the result after it; reuse the result of a completed call, and reconcile a call that has only a started record before you repeat it.
- **Level 4:** Two agents write the same state file within 50 ms. What does the atomic rename save, and what does it not? Expected: it prevents a torn file, so each reader sees one complete version; it does not stop the second write from replacing the first, which needs coordination between the writers.
- **Level 4:** What belongs in the state file and what does not? Expected: the active task, touched files, assumptions, blockers and the next action; not transcripts, reasoning traces, completions or vendor model ids, and large artifacts only by path.

## Wrong answers

- "Catch the exception and keep going, the next write will fix it." The silent except is the second bug; it hides a truncated file that the next session loads.
- "Write to a temp file, then copy it over the target." A copy can be interrupted too; the atomic step is the rename.
- "Store the full transcript in the state so nothing is lost." Transcripts are telemetry, not durable state; keep the file small and keep artifacts in separate files with only their paths in state.

## Taught in

The lesson [repo memory](../../../phases/14-agent-engineering/34-repo-memory-and-state/) gives the atomic write recipe, the schema-first contract, idempotency keys and the event log pattern.
