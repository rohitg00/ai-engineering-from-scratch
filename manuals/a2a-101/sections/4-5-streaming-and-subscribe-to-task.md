# SendStreamingMessage and SubscribeToTask

> A stream is a live view of one task, so a dropped connection costs you the frames sent while you were away and never the task itself.

The planner asks `test-runner` to run the full suite of `payments-api` at commit `9f3c2e1` and watches the log arrive on a stream. Four frames in, the client closes the connection. The suite keeps running, and the planner still wants the rest of the log.

When you finish this section, you can open a stream with either operation, tell when it has ended, and resume it after a drop.

## What a stream carries

**Stream:** an HTTP response of type `text/event-stream` whose body is a series of Server-Sent Events {{spec §9.4.2}} {{spec §11.7}}. Every event carries one `StreamResponse`, which holds exactly one of `task`, `message`, `statusUpdate`, or `artifactUpdate` {{proto StreamResponse}}.

Two operations open a stream: `SendStreamingMessage` sends a message and watches the work it starts, and `SubscribeToTask` watches a task that already exists {{spec §3.5.1}}.

```listing
title: the first stream, closed by the client after four frames
source: capture/out/14-resubscribe.http
lang: sse
note: Each frame is cut inside its line. The last line is the kit's own note in the transcript, written when the client drops the connection.
---
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: {"jsonrpc": "2.0", "id": 1, "result": {"task": {… "state": "TASK_STATE_SUBMITTED", …

data: {"jsonrpc": "2.0", "id": 1, "result": {"statusUpdate": {… "state": "TASK_STATE_WORKING", …

data: {"jsonrpc": "2.0", "id": 1, "result": {"artifactUpdate": {… "name": "test-log.txt", …

data: {"jsonrpc": "2.0", "id": 1, "result": {"artifactUpdate": {… "append": true}}}

# the client closes the connection after 4 events
```

The streaming guide calls each payload "a JSON-RPC 2.0 Response object, typically a `SendStreamingMessageResponse`" {{docs streaming-and-async}}, a type the proto does not define {{proto A2AService}} ([conflict D33](#s-ref-sources)). The migration guide names the update members `taskStatusUpdate` and `taskArtifactUpdate` {{docs whats-new-v1}}, where the proto and these frames say `statusUpdate` and `artifactUpdate` ([conflict D9](#s-ref-sources)). Match on the proto names.

The specification defines no `event:` types, `id:` lines, `retry:` value, or keep-alive {{spec §11.7}}. The reference SDK sends keep-alive comments and marks a late error with `event: error` {{sdk src/a2a/server/routes/jsonrpc_dispatcher.py}}, so skip comments and check each payload for `error`.

## Order and the close

"All implementations MUST deliver events in the order they were generated" {{spec §3.5.2}}, and "Events MUST be broadcast to all active streams for that task" {{spec §3.5.2}}. None of those streams owns the task:

```rule
label: the stream is not the task
source: spec §3.5.2
---
"The task lifecycle is independent of any individual stream's lifecycle"
```

Version 1.0 has no end marker: "`final` boolean field removed from TaskStatusUpdateEvent" {{docs whats-new-v1}}. A task stream "MUST close when the task reaches a terminal state" {{spec §3.1.2}}, and so does a `SubscribeToTask` stream {{spec §3.1.6}}. After a `message` frame the stream closes at once {{spec §3.1.2}}.

At interrupted states, §11.7 and the streaming guide close the stream, while §7.6.1 asks agents to keep it open for `TASK_STATE_AUTH_REQUIRED` {{spec §11.7}} {{docs streaming-and-async}} {{spec §7.6.1}} ([conflict D3](#s-ref-sources)). [Interrupted states](#s-input-required-and-auth-required) lists where each SDK closes, so a close by itself means only that reading has ended.

## A dropped connection and SubscribeToTask

```figure
id: fig-stream-resubscribe
kind: sequence
title: a stream dropped after four frames and picked back up
claim: A dropped stream loses the frames sent while it was closed, and SubscribeToTask resumes with a Task snapshot that already holds their content.
caption: Read top to bottom. Steps 1 to 5 are the first stream, and only the writes nobody saw are drawn to the task store. Frame numbers count per stream. From capture/out/14-resubscribe.http, ids shortened to 8 characters.
```

After frame 4 the agent appends chunks 03 and 04 to `test-log.txt`, and no open connection carries their `artifactUpdate` events, as [figure](#fig-stream-resubscribe) shows. The events are gone, and the stored task holds both chunks.

**SubscribeToTask:** the operation that opens a new stream on an existing task, given its `id` {{proto SubscribeToTaskRequest}}. Its first frame is a snapshot: "The operation MUST return a `Task` object as the first event in the stream" {{spec §3.1.6}}.

```listing
title: the first frame after SubscribeToTask, a full Task snapshot
source: capture/out/14-resubscribe.events.json
lang: json
note: The status message and the history are cut, and so are parts 02 and 03 of the log.
---
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "task": {
      "id": "25239d4c-798b-4754-be06-d1f94d0645b1",
…
      "status": {
        "state": "TASK_STATE_WORKING",
…
      "artifacts": [
        {
          "artifactId": "test-log",
          "name": "test-log.txt",
          "parts": [
            {
              "text": "tests/test_suite_01.py ........\n"
…
              "text": "tests/test_suite_04.py ........\n"
```

Frames 2 to 5 append chunks 05 to 08, and frame 6 carries `TASK_STATE_COMPLETED` with `96 passed`. Nothing is replayed, and the specification defines no cursor. So replace your partial `test-log.txt` with the snapshot's artifact, then append the frames that follow.

The snapshot holds only the current `status`, so a reconnecting client "MAY not receive all status update messages" {{spec §3.7}}, and results belong in artifacts.

A second `SubscribeToTask` after the task completes fails with `UnsupportedOperationError`, `-32004`, as plain JSON with no stream {{spec §3.1.6}} {{sdk src/a2a/server/routes/jsonrpc_dispatcher.py}}. So stop reconnecting and read the final task with `GetTask`, as [GetTask and ListTasks](#s-get-task-and-list-tasks) shows.

## The subscribe verb over HTTP+JSON

The HTTP+JSON route is `/tasks/{id}:subscribe`, and the specification names two verbs for it. The proto binds it to `GET` {{proto A2AService}}, and the method table and the URL list show `POST` {{spec §5.3}} {{spec §11.3.2}} ([conflict D1](#s-ref-sources)). On 2026-09-29 the project's steering committee chose `GET` in [PR #2068](https://github.com/a2aproject/A2A/pull/2068), which matches the proto. That change is unreleased on branch `dev-1.1`, and [PR #1891](https://github.com/a2aproject/A2A/pull/1891) for `POST` stays open on main. The SDKs split three ways:

| SDK | Server accepts | Client sends |
|---|---|---|
| a2a-python 1.2.2 {{sdk src/a2a/server/routes/rest_routes.py}} | `GET` and `POST` | `POST` |
| a2a-go {{sdk-go a2asrv/rest.go at v2.6.0}} | `GET` and `POST` | `POST` |
| a2a-java {{sdk-java reference/rest/src/main/java/org/a2aproject/sdk/server/rest/quarkus/A2AServerRoutes.java at v1.4.0.Final}} | `POST` | `POST` |
| a2a-js {{sdk-js src/server/express/rest_handler.ts at v1.3.0}} | `GET` and `POST` | `POST` |
| a2a-dotnet {{sdk-dotnet src/A2A.AspNetCore/A2AEndpointRouteBuilderExtensions.cs at v1.0.0-preview2}} | `POST` | `POST` |
| a2a-rs {{sdk-rust a2a-server/src/rest.rs at a2a-server-lf-v0.5.1}} | `GET` and `POST` | `GET` |

A `POST` reaches all six servers, and a `GET` reaches four, so send `POST` as five of the six clients do. A server should accept both.

```takeaways
- Treat a task as finished only when the last frame holds a terminal state, never on the close alone.
- After a drop, call `SubscribeToTask` and rebuild your copy from its first frame, the `Task` snapshot.
- When `SubscribeToTask` returns `-32004`, stop reconnecting and read the result with `GetTask`.
- Send `POST` to `/tasks/{id}:subscribe`, because two SDK servers route no `GET`.
```

Sources: spec §3.1.2, §3.1.6, §3.5.1, §3.5.2, §3.7, §5.3, §7.6.1, §9.4.2, §11.3.2, §11.7 (research/sources/specification.md); proto StreamResponse, SubscribeToTaskRequest, A2AService (research/sources/a2a.proto); docs whats-new-v1, streaming-and-async (research/sources/docs.md); a2aproject/A2A PR #2068 and PR #1891, checked 2026-10-06; sdk src/a2a/server/routes/jsonrpc_dispatcher.py, src/a2a/server/routes/rest_routes.py, src/a2a/client/transports/rest.py (a2a-python 1.2.2); sdk-go a2asrv/rest.go, a2aclient/rest.go (a2a-go v2.6.0); sdk-java reference/rest/src/main/java/org/a2aproject/sdk/server/rest/quarkus/A2AServerRoutes.java, client/transport/rest/src/main/java/org/a2aproject/sdk/client/transport/rest/RestTransport.java (a2a-java v1.4.0.Final); sdk-js src/server/express/rest_handler.ts, src/client/transports/rest_transport.ts (a2a-js v1.3.0); sdk-dotnet src/A2A.AspNetCore/A2AEndpointRouteBuilderExtensions.cs, src/A2A/Client/A2AHttpJsonClient.cs (a2a-dotnet v1.0.0-preview2); sdk-rust a2a-server/src/rest.rs, a2a-client/src/rest.rs (a2a-rs a2a-server-lf-v0.5.1); capture/out/14-resubscribe.http, 14-resubscribe.events.json
