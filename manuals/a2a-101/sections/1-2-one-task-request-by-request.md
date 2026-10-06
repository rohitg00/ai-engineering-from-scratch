# One task, request by request

> One streamed run of test-runner shows every piece of the protocol in order, from the card read to the moment the server closes the stream.

Your planner wants the unit tests of `payments-api` run at commit `9f3c2e1`, and it wants to watch the log grow while they run. It already holds the card of `test-runner`, whose capabilities include `"streaming": true`, so it sends the request with `SendStreamingMessage`.

This section follows that run frame by frame, from `capture/out/05-streaming.http`, and [figure](#fig-one-streamed-task) shows it. When you finish this section, you can read any task stream and say what each frame changed in the stored task.

```figure
id: fig-one-streamed-task
kind: sequence
title: one streamed task from the card read to the close
claim: A streamed task opens with the task itself, reports its work as status and artifact frames, and ends when the server closes the stream after the terminal status.
caption: Read top to bottom. Unnumbered rows come before the stream, and each numbered row is one data frame, numbered as in capture/out/05-streaming.http. Timestamps on the right come from the kit clock, and the task id is shortened to 8 characters.
```

## Before the first frame

Unless the card sets `capabilities.streaming` to `true`, the agent must refuse `SendStreamingMessage` with `UnsupportedOperationError` {{spec §3.3.4}}, as [discovery](#s-discovery-and-supported-interfaces) explains. The request itself is short:

```listing
title: the request that opens the stream
source: capture/out/05-streaming.http
lang: http
note: The first lines of the JSON-RPC envelope and its closing brackets are cut.
---
POST /a2a/jsonrpc HTTP/1.1
Host: localhost:41241
Content-Type: application/json
A2A-Version: 1.0
Accept: text/event-stream
…
  "method": "SendStreamingMessage",
  "params": {
    "message": {
      "messageId": "5bc8fbbc-bde5-4099-8164-d8399f767c45",
      "role": "ROLE_USER",
      "parts": [
        {
          "text": "Run the unit tests for payments-api at commit 9f3c2e1"
        }
      ]
…
```

The client minted the `messageId` itself, and it sent no `taskId` and no `contextId`, so the agent creates both. The response head is `HTTP/1.1 200 OK` with `Content-Type: text/event-stream`. Each event after it is one `data:` line that holds a complete JSON-RPC response, with the request's `id` of `1` {{spec §9.4.2}}.

## Frame 1: the task appears

A task stream has a fixed opening: "the stream MUST begin with the Task object" {{spec §3.1.2}}. This one is already in `TASK_STATE_SUBMITTED`:

```listing
title: frame 1, the new task
source: capture/out/05-streaming.events.json
lang: json
note: The JSON-RPC envelope, the message parts, and the closing brackets are cut.
---
"task": {
  "id": "728ba084-97eb-422b-b94b-b0fe9153ce2c",
  "contextId": "c026046c-6890-4830-9618-8fffa35cb080",
  "status": {
    "state": "TASK_STATE_SUBMITTED",
    "timestamp": "2026-10-06T09:00:01.750Z"
  },
  "history": [
    {
      "messageId": "5bc8fbbc-bde5-4099-8164-d8399f767c45",
      "contextId": "c026046c-6890-4830-9618-8fffa35cb080",
      "taskId": "728ba084-97eb-422b-b94b-b0fe9153ce2c",
      "role": "ROLE_USER",
      …
```

The server minted task `728ba084` and context `c026046c`, and it wrote both ids into its copy of the planner's message. From here on, the planner matches every frame to those two ids. The kit fills the optional `timestamp` of this first status {{proto TaskStatus}}, and the SDK leaves it out, as [the kit README](manuals/a2a-101/capture/README.md) lists.

## Frame 2: the work starts

Frame 2 is a `statusUpdate` that moves the task to `TASK_STATE_WORKING`, with the status message "Checking out 9f3c2e1 and starting the suite". Every status event names its task and its context, because `taskId`, `contextId`, and `status` are all REQUIRED {{proto TaskStatusUpdateEvent}}.

## Frames 3 to 8: the results arrive in pieces

The next six frames are `artifactUpdate` events, a type with no timestamp field {{proto TaskArtifactUpdateEvent}}. Frames 3 to 7 build one artifact, `test-log`, one line of the log at a time:

- Frame 3 carries the `artifactId` `test-log`, the `name` `test-log.txt`, and the first part. It has no `append`, so it starts the artifact.
- Frames 4, 5, and 6 repeat the `artifactId`, leave out the `name`, and set `append: true`.
- Frame 7 sets both `append: true` and `lastChunk: true`, so the log is complete.
- Frame 8 starts a second artifact, `summary`, in one chunk: a data part with the media type `application/json`, and `lastChunk: true`.

A `lastChunk` closes one artifact and nothing more: frame 8 carries its own while the task keeps running. [Artifact and chunks](#s-artifact-and-chunks) shows how a client joins the chunks, and what the specification leaves open.

## Frame 9 and the close

Frame 9 is the last `statusUpdate`. It moves the task to `TASK_STATE_COMPLETED` at `09:00:02.250Z`, with the status message "1 failed, 11 passed". The task completed although a test failed, because the failure is part of the result.

Then the server closes the connection, and no frame announces it, because version 1.0 removed the `final` flag {{docs whats-new-v1}}. The rule is "The stream MUST close when the task reaches a terminal state" {{spec §3.1.2}}. At an interrupted state, the specification contradicts itself about whether a stream closes ([conflict D3](#s-ref-sources)). [Interrupted states](#s-input-required-and-auth-required) sets out when a stream closes, and its [figure](#fig-auth-required) follows a stream that stays open.

## The task after the stream

After the close, the task remains in the store, and a client reads it back with `GetTask`, the operation meant "for fetching the final state of a task after being notified via a push notification or after a stream has ended" {{spec §3.1.3}}. [GetTask and ListTasks](#s-get-task-and-list-tasks) covers what it returns.

```takeaways
- Take the task id and the context id from the first frame, and match every later frame to them.
- Treat `lastChunk` as the end of one artifact, never as the end of the task.
- After the stream closes, confirm the task's state with `GetTask`.
```

Sources: spec §3.1.2, §3.1.3, §3.3.4, §9.4.2 (research/sources/specification.md); proto TaskStatus, TaskStatusUpdateEvent, TaskArtifactUpdateEvent (research/sources/a2a.proto); docs whats-new-v1 (research/sources/docs.md); capture/README.md, capture/a2a_ref.py; capture/out/01-agent-cards.http, 05-streaming.http, 05-streaming.events.json
