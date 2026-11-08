---
id: a2a-stream-drop-resubscribe
title: Recover a dropped A2A stream without replay
card: protocols
kind: design
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, debugging]
tags: [a2a, streaming, subscribe, artifacts, reconnect]
minutes: 10
lessons: []
manuals: [a2a-101#s-streaming-and-subscribe-to-task, a2a-101#s-artifact-and-chunks]
practice: []
cheatsheet: [a2a, a2a-and-agent-messaging]
related: [protocols/a2a-rejected-task-loop, protocols/a2a-webhook-at-least-once]
updated: 2026-11-03
---

Your client watches a long test run over `SendStreamingMessage`. After four frames the connection drops, while the agent keeps working and appends more lines to the log artifact. Design the recovery: how the client learns what it missed, how it rebuilds the log, and how it knows when to stop reconnecting.

## Short answer

Nothing is replayed, because a stream is a live view and the specification defines no cursor. The client calls `SubscribeToTask` with the task id, and the first frame must be a `Task` snapshot that already holds every chunk written while the client was away. The client replaces its partial artifact with the snapshot's copy and appends the frames that follow. When a later subscribe answers `UnsupportedOperationError`, the task is terminal, so the client stops reconnecting and reads the final task with `GetTask`.

## Full answer

### What a stream is

Every event carries one `StreamResponse` with exactly one of `task`, `message`, `statusUpdate` or `artifactUpdate`. Every implementation must deliver events in the order it created them and to every open stream of the task. The lifecycle of a task does not depend on the lifecycle of any one stream.

In the recorded run the client closed after four frames. The agent then appended two chunks that no connection carried. Those events are gone, and the stored task holds both chunks.

### The snapshot is the source of truth

```text
SubscribeToTask {id}
  frame 1: task snapshot, state WORKING, artifact test-log with parts 01 to 04
  frames 2 to 5: artifactUpdate, chunks 05 to 08, append true
  frame 6: statusUpdate, TASK_STATE_COMPLETED, "96 passed"
```

Rebuild by `artifactId`. A chunk without `append` replaces the artifact or creates it, and a chunk with `append: true` adds its parts to the stored artifact with that id. The snapshot holds only the current `status`, so a reconnecting client can miss status updates. Results belong in artifacts for that reason.

### When the stream ends

Version 1.0 removed the `final` flag, so no frame announces the end. A stream must close when the task reaches a terminal state. At an interrupted state the sources disagree: the recorded kit closes at `TASK_STATE_INPUT_REQUIRED` and stays open through `TASK_STATE_AUTH_REQUIRED`, and the six SDKs split the same way. So a close by itself means that reading ended. Call `GetTask`, and if the task is not terminal, act on its state and subscribe again.

### When to stop

A `SubscribeToTask` on a completed task fails with `UnsupportedOperationError`, `-32004`, as plain JSON with no stream. That is the stop signal. Read the final task with `GetTask` and treat the artifacts there as the result.

### Two more rules from the captures

- Send the first chunk of every artifact without `append`, because servers disagree about `append: true` on an unknown id: one fails the task, one drops the chunk, two start a new artifact.
- Over HTTP+JSON, send `POST` to `/tasks/{id}:subscribe`, because two SDK servers route no `GET`; a server should accept both.

## Follow-ups

- **Level 3:** Why replace the artifact from the snapshot instead of merging? Expected: missed chunks never replay and the snapshot is the stored copy, so a merge would duplicate parts.
- **Level 3:** The stream closes right after a status frame in `TASK_STATE_INPUT_REQUIRED`. Is the task over? Expected: no; the close ended the reading, so call `GetTask` and answer the question on the same task.
- **Level 4:** The last status message said "done" but no terminal state arrived before the close. What do you trust? Expected: the state from `GetTask`; a task is finished only when a terminal state is recorded, never on the close or on prose.
- **Level 4:** How does `lastChunk` relate to the end of the task? Expected: it closes one artifact only; the recorded stream carried two more frames after a `lastChunk`, and a canceled task can store an artifact that never got one.

## Wrong answers

- "Reconnect with a last event id so that the server replays." The specification defines no cursor and no replay. `SubscribeToTask` starts with a snapshot instead.
- "The close means the task finished." Servers close at different states. Confirm the state with `GetTask` before you stop.
- "Keep the chunks you had and append the snapshot's." That duplicates parts. The snapshot replaces your copy, and the following frames append.

## Taught in

The [streaming section](../../../manuals/a2a-101/sections/4-5-streaming-and-subscribe-to-task.md) records the dropped stream and the snapshot, and the [artifact section](../../../manuals/a2a-101/sections/3-3-artifact-and-chunks.md) gives the rebuild rules.
