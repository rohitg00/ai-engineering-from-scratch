# SendMessage

> `SendMessage` carries one message and a `SendMessageConfiguration`, and the agent answers with a `Message` or a `Task` that, by default, is terminal or interrupted.

Your planner sends `code-reviewer` two messages through the same method. The first asks which languages it reviews, and the answer arrives at once as a message. The second carries a diff, and the answer is a task with an id, a state, and later an artifact.

When you finish this section, you can build a `SendMessage` request and act on whichever shape comes back.

## The request and its configuration

**SendMessageRequest:** a `message`, as [Message](#s-message) defines it, an optional `configuration`, and `metadata` {{proto SendMessageRequest}}. The configuration has four fields {{proto SendMessageConfiguration}}:

- `acceptedOutputModes`: the media types the client accepts.
- `taskPushNotificationConfig`: a webhook, as [push notification configs](#s-push-notification-configs) explains.
- `historyLength`: how much history the returned task carries.
- `returnImmediately`: whether the server answers before the task settles.

A send blocks unless `returnImmediately` is `true`:

```rule
label: the blocking default
source: spec §3.2.2
---
"The operation MUST wait until the task reaches a terminal state (`TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`) or an interrupted state (`TASK_STATE_INPUT_REQUIRED`, `TASK_STATE_AUTH_REQUIRED`) before returning."
```

In `03-blocking-task.http`, one `SendMessage` with no `configuration` gets task `3d8f7801` in `TASK_STATE_COMPLETED`, with every artifact {{spec §3.2.2}}. The client never sees `TASK_STATE_SUBMITTED` or `TASK_STATE_WORKING`. The specification sets no time limit, and a client that times out never learns the task id {{spec §3.4.2}}.

One sentence of the specification says the opposite ([conflict D2](#s-ref-sources)): "The operation MUST return immediately with either task information or response message" {{spec §3.1.1}}. The proto makes `false` the default {{proto SendMessageConfiguration}}, and the proto is normative {{spec §1.4}}. The kit and the reference SDK block {{sdk src/a2a/server/request_handlers/default_request_handler_v2.py}}.

The SDKs disagree on whether `historyLength` in the configuration trims the returned task:

| SDK | `configuration.historyLength` on the returned task |
|---|---|
| a2a-python 1.2.2 | applied to the returned `Task` and to `task` events of a stream, and a negative value is `InvalidParamsError` {{sdk src/a2a/server/request_handlers/default_request_handler_v2.py}} |
| a2a-go | never applied, so the task returns with its full stored history {{sdk-go a2asrv/handler.go at v2.6.0}} |
| a2a-java | applied to the returned `Task` and to each `Task` event of a stream, and a negative value is `InvalidParamsError` {{sdk-java requesthandlers/DefaultRequestHandler.java at v1.4.0.Final}} |
| a2a-js | applied to the returned task and to `task` payloads of a stream, and 0 or less omits history {{sdk-js src/server/request_handler/default_request_handler.ts at v1.3.0}} |
| a2a-dotnet | never read by the server, so the task returns with its full stored history {{sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2}} |
| a2a-rs | applied to the returned `Task` of a blocking send only, and a stream ignores it {{sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1}} |

## Message or Task

`SendMessage` returns a `SendMessageResponse` whose payload is a `oneof` of two members, `task` and `message` {{proto SendMessageResponse}}. The agent decides, and the specification gives it no rule: "The agent MAY create a new `Task` to process the provided message asynchronously or MAY return a direct `Message` response for simple interactions." {{spec §3.1.1}}

In the kit, `test-runner` and `deployer` create a task for every message. `code-reviewer` answers with a message when the request has no `text/x-diff` part and its text ends with a question mark ([capture/agents.py](manuals/a2a-101/capture/agents.py)). Once a task exists, the choice is over: "Once a task is created, the agent will only return `Task` objects in response to messages sent" {{docs life-of-a-task}}.

A message is the whole answer, with no id to poll, cancel, or subscribe to. It carries a `contextId` {{proto Message}}, so keep it for a follow-up. A task is a handle on work that can outlive the call. [Figure](#fig-message-or-task) puts the two answers from `code-reviewer` side by side. `SendStreamingMessage` makes the same choice in its first event, as [SendStreamingMessage and SubscribeToTask](#s-streaming-and-subscribe-to-task) shows.

```figure
id: fig-message-or-task
kind: decision
title: one method, two result shapes
claim: The same `SendMessage` to `code-reviewer` returns a message for a question and a task for a diff, and only the task gives the client something to follow.
caption: Read top down. The agent's own logic picks the shape, here the review_quick rule in capture/agents.py. Left, the reply in capture/out/02-message-reply.http. Right, the task in capture/out/06-input-required.http. Ids are shortened to 8 characters.
```

## Returning at once and polling with GetTask

**returnImmediately:** a boolean in `SendMessageConfiguration` that asks the server to answer as soon as the task exists: "The operation MUST return immediately after creating the task, even if processing is still in progress" {{spec §3.2.2}}. The flag has no effect on a direct `Message` reply, on streaming operations, or on push notification configs {{spec §3.2.2}}.

**Polling:** reading a task with `GetTask` until its state tells you to stop. In `04-polling.http` the kit sends with `returnImmediately`, then polls task `d0c28826` twice with `historyLength` 0:

```listing
title: a send that returns at once, then two polls
source: capture/out/04-polling.http
lang: json
note: The send and the first GetTask request are cut to their key lines. The second GetTask request matches the first apart from its JSON-RPC id. Each reply is cut to its state, and the first poll also shows its one log part.
---
    "configuration": {
      "returnImmediately": true
    }
…
        "state": "TASK_STATE_SUBMITTED",
…
  "method": "GetTask",
  "params": {
    "id": "d0c28826-28b8-4b15-8b53-4e01ae7a5a3c",
    "historyLength": 0
  }
…
      "state": "TASK_STATE_WORKING",
…
            "text": "collected 12 items\n"
…
      "state": "TASK_STATE_COMPLETED",
```

The send returns `TASK_STATE_SUBMITTED`, while the specification's examples name `TASK_STATE_WORKING` and `TASK_STATE_INPUT_REQUIRED` {{spec §3.2.2}}, so switch on the state you get. The first poll finds `TASK_STATE_WORKING` and one log part. The second finds `TASK_STATE_COMPLETED` with every artifact. [Figure](#fig-blocking-and-return) sets the blocking call beside the immediate return and its two polls.

```figure
id: fig-blocking-and-return
kind: timeline
title: a blocking call and a call that returns at once
claim: A blocking send holds one request open until this task completes, while `returnImmediately` answers at `TASK_STATE_SUBMITTED` and leaves the client to poll.
caption: Both tasks are aligned at the request and run through the same states on the kit's clock. Filled squares are states a reply showed the client, and hollow squares are states it never saw. Green ticks are artifact updates, and violet bars are open requests. From capture/out/03-blocking-task.http and 04-polling.http.
```

## Dispatch on the result

The kit's planner tests which member is present before it touches either:

```listing
title: the planner's dispatch on a SendMessage result
source: capture/planner.py
lang: python
note: The top of the loop in Planner.delegate. The interrupted states are handled below this cut.
---
        while True:
            if "error" in reply:
                self.note(f"  error {reply['error']['code']}: {reply['error']['message']}")
                return None
            result = reply["result"]
            if "message" in result:
                self.note("  direct reply, no task to follow")
                return result["message"]
            task = result["task"] if "task" in result else result
            state = task["status"]["state"]
            self.note(f"  task {task['id'][:8]} is {state}")
            if state in TERMINAL:
                return task
```

The planner checks `error` first, because JSON-RPC errors arrive inside an HTTP 200 response. Then it checks `message` and stops. Only then does it branch on the task's state, as [Task, TaskStatus, and TaskState](#s-task-and-task-state) defines it. [A client](#s-a-client) walks through the rest of this loop.

```takeaways
- Test for `message` and `task` in every `SendMessage` result, and never assume one shape for an agent.
- Set `returnImmediately: true` whenever you plan to poll, subscribe, or wait for a webhook.
- Switch on the state of every reply, including an early `TASK_STATE_SUBMITTED` from a blocking send.
```

Sources: spec §1.4, §3.1.1, §3.2.2, §3.4.2 (research/sources/specification.md); proto SendMessageRequest, SendMessageConfiguration, SendMessageResponse, Message (research/sources/a2a.proto); docs docs/topics/life-of-a-task.md at v1.0.1; sdk src/a2a/server/request_handlers/default_request_handler_v2.py (a2a-python 1.2.2); sdk-go a2asrv/handler.go at v2.6.0; sdk-java server-common/src/main/java/org/a2aproject/sdk/server/requesthandlers/DefaultRequestHandler.java at v1.4.0.Final; sdk-js src/server/request_handler/default_request_handler.ts at v1.3.0; sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2; sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1; capture/out/02-message-reply.http, 03-blocking-task.http, 04-polling.http, 06-input-required.http; capture/agents.py, capture/planner.py
