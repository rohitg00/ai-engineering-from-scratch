# GetTask and ListTasks

> `GetTask` and `ListTasks` are your recovery path, and both follow exact rules about which parts of a task they leave out.

The planner's stream to `deployer` drops. A webhook says a test run has finished. The planner restarts with nothing but task ids in its log. In each case the next step is the same: ask the agent for the task it has stored.

When you finish this section, you can fetch the history you need, page through an agent's tasks, and explain a missing field.

## GetTask returns the stored task

`GetTask` takes the task `id` and an optional `historyLength` {{proto GetTaskRequest}}. It returns the `Task` as the server holds it: status, artifacts, and history.

An id you are not allowed to see gets `TaskNotFoundError` {{spec §3.1.3}}, so a not-found answer never proves that a task is gone.

## historyLength

**History:** the messages a task has kept, apart from the current status message. The `historyLength` parameter sets how many a response carries, with the same meaning in every operation {{spec §3.2.4}}:

- Unset: "No limit imposed; server returns its default amount of history (implementation-defined, may be all history)" {{spec §3.2.4}}.
- A number above zero: "Return at most this many recent messages from the task's history" {{spec §3.2.4}}.
- Zero: "No history should be returned; the history field SHOULD be omitted" {{spec §3.2.4}}.

With `historyLength` 1, the kit returns only the newest message of the review task:

```listing
title: GetTask with historyLength 1
source: capture/out/13-history.http
lang: json
note: The JSON-RPC envelopes, the reply's ids, status, and artifacts, and the ids inside the message are cut.
---
  "method": "GetTask",
  "params": {
    "id": "e5c95b09-6d4b-4b3b-8693-91e81472d12f",
    "historyLength": 1
  }
…
    "history": [
      {
        "messageId": "8f9ee658-e185-409a-9294-8d4d97ef77bb",
        …
        "role": "ROLE_AGENT",
        "parts": [
          {
            "text": "Comparing the diff against main"
          }
        ]
      }
    ],
```

That message is not the newest thing the agent said. The final status message, "2 findings", stays in `status.message`. In the kit and the reference SDK, a status message joins `history` only when a newer one replaces it {{sdk src/a2a/server/tasks/task_manager.py}}. Read `history` and `status.message` together.

The server can also "apply a lower limit" {{proto GetTaskRequest}}, and "not all Messages are guaranteed to be persisted in the Task history" {{spec §3.7}}. The unset case is implementation-defined, and the SDKs also read 0 and a negative value in different ways:

| SDK | `historyLength` unset | 0 | below 0 |
|---|---|---|---|
| a2a-python 1.2.2 | all history in both operations | an empty `history` array | `InvalidParamsError` {{sdk src/a2a/utils/task.py}} |
| a2a-go | all history in `GetTask`, the last 100 messages in `ListTasks` | the field is omitted | the field is omitted {{sdk-go a2asrv/handler.go at v2.6.0}} |
| a2a-java | all history in `GetTask`, none in `ListTasks` | an empty list | `InvalidParamsError` {{sdk-java requesthandlers/DefaultRequestHandler.java at v1.4.0.Final}} |
| a2a-js | all history in both operations | the field is omitted | omitted over JSON-RPC, HTTP 400 over REST {{sdk-js src/server/request_handler/default_request_handler.ts at v1.3.0}} |
| a2a-dotnet | all history in both operations | an empty array in `GetTask`, no field in `ListTasks` | `InvalidParamsError` over JSON-RPC {{sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2}} |
| a2a-rs | all history in both operations | an empty history | an empty history {{sdk-rust a2a-server/src/task_store/mod.rs at a2a-server-lf-v0.5.1}} |

## ListTasks returns pages, newest first

`ListTasks` filters by `contextId`, `status`, and `statusTimestampAfter`, and shapes the page with `pageSize`, `pageToken`, `historyLength`, and `includeArtifacts` {{proto ListTasksRequest}}. It returns "only tasks visible to the authenticated client" {{spec §3.1.4}}, under four rules:

- Size: "If unspecified, at most 50 tasks will be returned" {{proto ListTasksRequest}}, and the maximum is 100.
- Order: "Implementations MUST return tasks sorted by their status timestamp time in descending order (most recently updated tasks first)." {{spec §3.1.4}}
- Token: "The nextPageToken field MUST always be present in the response" {{spec §3.1.4}}. On the last page it holds the empty string.
- Artifacts: "When includeArtifacts is false (the default), the artifacts field MUST be omitted entirely" {{spec §3.1.4}}.

The kit asks `test-runner`, which holds five tasks, for `pageSize` 2 and `historyLength` 0:

```listing
title: the first page of ListTasks
source: capture/out/12-list-tasks.http
lang: json
note: Each task is cut to its id, state, and status timestamp, and the token is cut after its first 44 characters.
---
    "tasks": [
      {
        "id": "f22ed7af-848d-4f4d-8cd1-3204d1e1bbaf",
        …
          "state": "TASK_STATE_CANCELED",
          …
          "timestamp": "2026-10-06T09:00:03.750Z"
      …
        "id": "8ae21dcb-7449-4d90-82a6-ac01b20fd782",
        …
          "state": "TASK_STATE_FAILED",
          …
          "timestamp": "2026-10-06T09:00:03.000Z"
      …
    ],
    "nextPageToken": "eyJ0cyI6IjIwMjYtMTAtMDZUMDk6MDA6MDMuMDAwWiIs…",
    "pageSize": 2,
    "totalSize": 5
```

The second page holds the completed runs `728ba084` and `d0c28826`. Neither page carries `artifacts`, although both completed runs stored a log and a summary. A third request filters on `TASK_STATE_CANCELED` and gets one task, a `pageSize` of 50, and an empty `nextPageToken`. [Figure](#fig-history-and-pages) draws the pages beside the history regimes.

```figure
id: fig-history-and-pages
kind: structure
title: history regimes and list pages
claim: `GetTask` trims history to the newest messages you ask for, and `ListTasks` returns newest-first pages that leave out artifacts until you ask for them.
caption: Top, the stored history of task e5c95b09 and what each `historyLength` returns. Bottom, the five tasks on test-runner in list order, grouped into the pages the kit requested. Ids are shortened to 8 characters. From capture/out/13-history.http, 04-polling.http, and 12-list-tasks.http.
```

The specification requires cursor-based pagination and gives the token no format {{spec §3.1.4}}, so each SDK makes its own:

| SDK | Token | Page size | Last page |
|---|---|---|---|
| a2a-python 1.2.2 | URL-safe base64 of a JSON cursor with the status timestamp and the task id {{sdk src/a2a/utils/task.py}} | 50 by default, 1 to 100 or error -32602 | `""` |
| a2a-go | URL-safe base64 of the update time and the task id {{sdk-go a2asrv/taskstore/inmemory.go at v2.6.0}} | 50 by default, 1 to 100 or error -32600 | `""` |
| a2a-java | plain text, the status time in epoch milliseconds, a colon, and the task id {{sdk-java util/PageToken.java at v1.4.0.Final}} | 50 by default, 1 to 100 or error -32602 | `""` |
| a2a-js | base64 of the status timestamp, a bar, and the task id {{sdk-js src/server/utils.ts at v1.3.0}} | 50 by default, 1 to 100 or error -32602 | `""` |
| a2a-dotnet | a decimal offset such as `50` {{sdk-dotnet src/A2A/Server/InMemoryTaskStore.cs at v1.0.0-preview2}} | 50 by default, and only JSON-RPC rejects a size outside 1 to 100 | `""` |
| a2a-rs | a decimal offset over tasks sorted by id, against the order rule above {{sdk-rust a2a-server/src/task_store/inmemory.rs at a2a-server-lf-v0.5.1}} | 50 by default, and a size above 100 is cut to 100 | `""` |

## Send every parameter

The third request sends no `historyLength` and gets the full history, as the reference SDK would {{sdk src/a2a/server/request_handlers/default_request_handler_v2.py}}. With 0, the SDK returns an empty `history` array where the specification asks for no field {{sdk src/a2a/server/routes/common.py}}. So treat a missing `history` and an empty one alike.

Pass back exactly the token you were given. The migration guide calls these fields `cursor`, `limit`, and `nextCursor`, names the proto does not define ([conflict D12](#s-ref-sources)).

The bound of `statusTimestampAfter` is inclusive: "Only tasks with a status timestamp time greater than or equal to this value will be returned" {{proto ListTasksRequest}}. To fetch only what changed, send the newest status timestamp you have seen, and skip the boundary task you already hold.

```takeaways
- Call `GetTask` after a stream ends, a webhook arrives, or your process restarts.
- Send `historyLength` on every read: 0 for a status check, a small number for the latest turn.
- Page with the exact token you were given until it comes back empty.
- Set `includeArtifacts` when a list must carry results, or fetch each task with `GetTask`.
```

Sources: spec §3.1.3, §3.1.4, §3.2.4, §3.7 (research/sources/specification.md); proto GetTaskRequest, ListTasksRequest (research/sources/a2a.proto); sdk src/a2a/server/tasks/task_manager.py, src/a2a/server/request_handlers/default_request_handler_v2.py, src/a2a/server/routes/common.py, src/a2a/utils/task.py (a2a-python 1.2.2); sdk-go a2asrv/handler.go, a2asrv/taskstore/inmemory.go at v2.6.0; sdk-java server-common/src/main/java/org/a2aproject/sdk/server/requesthandlers/DefaultRequestHandler.java, spec/src/main/java/org/a2aproject/sdk/spec/util/PageToken.java at v1.4.0.Final; sdk-js src/server/request_handler/default_request_handler.ts, src/server/utils.ts at v1.3.0; sdk-dotnet src/A2A/Server/A2AServer.cs, src/A2A/Server/InMemoryTaskStore.cs at v1.0.0-preview2; sdk-rust a2a-server/src/task_store/mod.rs, a2a-server/src/task_store/inmemory.rs at a2a-server-lf-v0.5.1; capture/out/04-polling.http, 12-list-tasks.http, 13-history.http
