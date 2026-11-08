---
id: dropped-stream-resent-the-message
title: A dropped stream ran the suite twice
card: scenarios
kind: incident
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, system-design]
tags: [a2a, streaming, sse, subscribe, idempotency, reconnect]
minutes: 25
lessons: [phases/14-agent-engineering/26-failure-modes-agentic]
manuals: []
practice: []
cheatsheet: [a2a, agent-failure-modes]
related: [scenarios/cancel-a-finished-task]
updated: 2026-11-03
system:
  version: A2A 1.0.1 with the manual's capture kit (the test-runner, code-reviewer and deployer agents)
  model: no model; the agents are deterministic fixtures
  hardware: one machine, localhost, no network
source:
  - manuals/a2a-101/capture/out/14-resubscribe.http
  - manuals/a2a-101/capture/out/14-resubscribe.events.json
  - manuals/a2a-101/capture/out/05-streaming.http
  - manuals/a2a-101/sections/4-5-streaming-and-subscribe-to-task.md
  - manuals/a2a-101/sections/3-1-message.md
---

## Situation

A planner watches a long test suite through a stream from the `test-runner` agent. A load balancer sits between them and closes connections that stay open for long. The planner's stream handler came from a REST client, and it has one rule for a connection that drops before the final frame: send the request again. Yesterday the suite of `payments-api` ran twice for every drop. The CI bill doubled, and a flaky test that passed in the first run failed in the second and blocked a release.

A teammate patched the handler to call `SubscribeToTask` after a drop and to retry that call on any error. The next time the task had already finished when the handler reconnected, the call returned an error, and the handler logged "this server does not support subscriptions" and turned streaming off for the agent. You have the capture of the same sequence: a stream that the client closes after four frames, the call that picks it up, and a third call after the end.

## Evidence

- [the first stream, four frames, then the client closes the connection](evidence/first-stream.txt)
- [the request that picks the stream back up](evidence/subscribe-request.txt)
- [the second stream, six frames to the end](evidence/resumed-stream.txt)
- [the artifact inside the first frame of the second stream](evidence/snapshot-artifacts.txt)
- [a third SubscribeToTask after the task completed, status and code](evidence/subscribe-after-completion.txt)
- [the detail inside that error](evidence/subscribe-after-completion-reason.txt)
- [what a repeated messageId does on every implementation](evidence/message-id-rule.txt)

## Questions

1. After the first stream closes at frame four, what has happened to the task, and what happens to the events the agent emits next?
2. What differs between the two requests, and why does one of them create work while the other does not?
3. What does the first frame of the second stream hold, and how does a client merge it with what it already has?
4. The third call returns an error. What does it mean, and what is the next call?
5. Does a repeated messageId protect the planner here? Why or why not?

## Walkthrough

1. **Read the first stream.** Four frames arrive: a `task` in `TASK_STATE_SUBMITTED`, a `statusUpdate` to `TASK_STATE_WORKING`, an `artifactUpdate` that opens `test-log.txt` with the first test file, and an `artifactUpdate` that appends the second file. Then the kit's note says that the client closed the connection. No frame carried a terminal state, so the task is alive. The lifecycle of a task does not depend on any one stream. The agent goes on and appends two more files to its stored artifact, and those events have no open connection to travel on.
2. **Read the second request.** The method is `SubscribeToTask`, and the params hold only the task id. There is no message and no `messageId`. This call opens a view on work that exists and creates nothing. The planner's old handler sent a new `SendStreamingMessage` instead, and a message without a `taskId` starts a new task every time.
3. **Read the second stream.** Frame 1 is a complete `task` object, still in `TASK_STATE_WORKING`. Its `test-log` artifact already holds four parts, `test_suite_01` to `test_suite_04`, which includes the two files the first stream never carried. Frames 2 to 5 append `test_suite_05` to `test_suite_08`, and the last one sets `lastChunk`. Frame 6 is a `statusUpdate` to `TASK_STATE_COMPLETED` with `96 passed`. Nothing is replayed, and the protocol has no cursor. The client replaces its partial log with the snapshot's artifact and then appends the frames that follow.
4. **Read the third call.** The reply has `Content-Type: application/json`, not an event stream. It is an `error` with code -32004 and the reason `UNSUPPORTED_OPERATION`, and the metadata names the state `TASK_STATE_COMPLETED`. This is the terminal-task case of that code, not a missing feature. The client stops reconnecting and reads the final task with `GetTask`.
5. **Check the id rule.** A retry of a send whose reply never came may reuse the same `messageId`. No implementation rejects a repeated id, and without a `taskId` each copy creates another task. So the id protects the planner only against a send that may not have arrived. Here the task exists, the client holds its id, and the right call is a subscribe, not a send.

## Resolution

The reconnect rule caused the double run. A `SendStreamingMessage` is a command plus a view, and resending the command repeats the work. The fix has four parts. A closed connection ends the reading and nothing else. If the last frame was not a terminal state, the handler calls `SubscribeToTask` with the task id. It rebuilds its copy from the `task` snapshot in the first frame and appends what follows. On -32004 it stops reconnecting and calls `GetTask`. The capture is the proof: one task id runs through both streams, the resumed stream delivers the four missing files and the final `96 passed`, and the agent ran the suite once.

## Wrong turns

- "On a drop, send the request again." The request carries a message, and a message without a task id starts a new task. The suite runs again.
- "Resend with the same messageId, and the server will drop the duplicate." Duplicate detection is optional, no implementation rejects a repeated id, and each copy without a task id makes a new task.
- "The connection closed, so the task is finished." Only a terminal state in a frame ends a task. The kit also closes at an input request, and servers differ on when they close. Call `GetTask` after any close.
- "-32004 means this server has no SubscribeToTask." The metadata names the completed state. The result is one `GetTask` away.
- "Append the new frames to the old partial log." Two files were written while no connection was open. The snapshot holds them, so replace the copy first and append after.

## Generalize

Keep the work and the view of the work apart. A command that creates work must go out once, and a reconnect must open a view by the id of the work, never repeat the command. Resume from a snapshot that the server owns, and let a terminal state in the data, not the end of a connection, tell you that the work is done.

## Taught in

The [streaming page of A2A 101](../../../manuals/a2a-101/sections/4-5-streaming-and-subscribe-to-task.md) follows this drop and the subscribe that recovers it, the [message page](../../../manuals/a2a-101/sections/3-1-message.md) explains what each implementation does with a repeated `messageId`, and the [failure modes lesson](../../../phases/14-agent-engineering/26-failure-modes-agentic/) lists the repeated step among the ways an agent loop goes wrong.
