# Interrupted states: INPUT_REQUIRED and AUTH_REQUIRED

> A task can stop and wait for you, and the two kinds of waiting are answered in different places: input on the task itself, authorization outside the protocol.

The planner sends `code-reviewer` a diff of `payments-api` and asks for a review. The reviewer cannot start, because it does not know which branch the diff is against. Later the planner asks `deployer` to deploy build `2026.10.06-1` to staging, and that task stops until an operator approves it.

Neither task has failed. When you finish this section, you can recognize an interrupted task, answer it in the right place, and detect the moment it resumes.

## Two states that wait

**Interrupted state:** a state in which the agent has stopped work and needs something before it can continue. The proto marks exactly two states this way, `TASK_STATE_INPUT_REQUIRED` and `TASK_STATE_AUTH_REQUIRED`, each with the words "This is an interrupted state." {{proto TaskState}}

An interrupted task keeps its id, history, and artifacts, and its status message says what the agent needs. A blocking `SendMessage` returns as soon as the task reaches either state {{spec §3.2.2}}. `TASK_STATE_INPUT_REQUIRED` needs an answer, sent as a new message on the same task. `TASK_STATE_AUTH_REQUIRED` needs a credential or an approval, sent outside A2A, and the task can resume without a client message.

## Answering on the same task

The reviewer creates task `e5c95b09` for the planner's diff, stops, and the blocking call returns the task with its question:

```listing
title: the first reply: a task that asks a question
source: capture/out/06-input-required.http
lang: json
note: The envelope above the task, the ids inside the status message, and the history are cut. The history holds only the planner's first message.
---
    "task": {
      "id": "e5c95b09-6d4b-4b3b-8693-91e81472d12f",
      "contextId": "49c5a238-4158-455d-8d63-b2cb39c0ecac",
      "status": {
        "state": "TASK_STATE_INPUT_REQUIRED",
        "message": {
          …
          "role": "ROLE_AGENT",
          "parts": [
            {
              "text": "Which base branch should I compare this diff against?"
            }
          ]
        },
        "timestamp": "2026-10-06T09:00:00.500Z"
      },
      …
```

The answer is an ordinary `SendMessage` that names the task: "The client continues the interaction by sending a new message with the same taskId and contextId" {{spec §3.4.3}}. The planner answers `main` with both ids. The second reply returns the same task in `TASK_STATE_COMPLETED`, with the `review.json` artifact. [Figure](#fig-input-required) follows the whole exchange.

```figure
id: fig-input-required
kind: sequence
title: the review question and its answer
claim: The question arrives as the status message of a paused task, and the answer is a new message that carries the same task and context ids.
caption: Read top to bottom. Steps 1 to 3 are the first `SendMessage` and its reply, and steps 4 to 9 answer the question on the same task. Ids are shortened to 8 characters. From capture/out/06-input-required.http.
```

## Authorization that arrives outside A2A

An agent that needs permission partway through a task, such as "An agent requiring human approval before a destructive action is taken" {{spec §7.6}}, "MUST transition the TaskState to TASK_STATE_AUTH_REQUIRED" {{spec §7.6.1}}. The credential takes another road:

```rule
label: where the credential travels
source: spec §7.6.1
---
"Agents MUST arrange to receive credentials via an out-of-band means, unless an in-band mechanism has been negotiated out-of-band or via an extension."
```

The deployer's third stream frame names the place where an operator approves:

```listing
title: frame 3: the deploy asks for approval
source: capture/out/07-auth-required.events.json
lang: json
note: The JSON-RPC envelope and the ids inside the status message are cut.
---
          "statusUpdate": {
            "taskId": "ecf2dcb6-79c8-48f8-8868-24a0541781f4",
            "contextId": "9e8e6bcf-b117-48b9-992a-67971cddcb1b",
            "status": {
              "state": "TASK_STATE_AUTH_REQUIRED",
              "message": {
                …
                "role": "ROLE_AGENT",
                "parts": [
                  {
                    "text": "An operator must approve this deploy at http://localhost:41243/approve/ecf2dcb6-79c8-48f8-8868-24a0541781f4"
                  }
                ]
              },
              "timestamp": "2026-10-06T09:00:00.750Z"
            }
          }
```

The approval never enters the protocol. In the kit an operator sends `POST /approve/<task id>` to the deployer, as [the kit README](manuals/a2a-101/capture/README.md) lists. No client message follows: "The agent MAY immediately continue Task processing after receiving the credential, without a requirement that clients send a follow-up message." {{spec §7.6.1}}

A client that is itself an agent can pass the request upstream by moving its own task to `TASK_STATE_AUTH_REQUIRED` {{spec §7.6.2}}. [Security schemes and in-task authorization](#s-security-schemes-and-in-task-authorization) covers what such a chain does to credentials.

```figure
id: fig-auth-required
kind: sequence
title: a deploy that waits for an operator
claim: The deploy waits in `TASK_STATE_AUTH_REQUIRED` while the stream stays open, and the operator's approval travels outside A2A before the same stream carries the result.
caption: Read top to bottom. Steps 2 to 4 and 7 to 9 are the six frames of one stream. Steps 5 and 6 are plain HTTP outside A2A. Ids are shortened to 8 characters. From capture/out/07-auth-required.http.
```

## When the stream closes

In this capture the stream stays open through the wait. Closing is a MUST only at terminal states {{spec §3.1.2}}, and the HTTP+JSON binding closes at "a terminal or interrupted state" {{spec §11.7}}. An agent that waits for a credential outside A2A "SHOULD maintain any active response streams with the client after setting the TaskState to TASK_STATE_AUTH_REQUIRED" {{spec §7.6.1}}. The specification does not settle this ([conflict D3](#s-ref-sources)). Upstream, [PR #2270](https://github.com/a2aproject/A2A/pull/2270) on branch `dev-1.1`, approved on 2026-09-29 and unreleased, makes both interrupted states non-terminal and says entering one "does not necessitate closing a streaming response". On `main`, §11.7 and the streaming guide still say "terminal or interrupted".

The kit closes at `TASK_STATE_INPUT_REQUIRED` and stays open through `TASK_STATE_AUTH_REQUIRED`, as the kit README lists. The SDKs split the same way:

| SDK | When the server closes a `SendStreamingMessage` stream |
|---|---|
| a2a-python 1.2.2 | when the agent's `execute()` call returns, so the agent code decides {{sdk src/a2a/server/agent_execution/active_task.py}} |
| a2a-go | after a `Message`, a terminal state, or `TASK_STATE_INPUT_REQUIRED`, and it stays open through `TASK_STATE_AUTH_REQUIRED` {{sdk-go internal/taskupdate/final.go at v2.6.0}} |
| a2a-java | after a terminal state, a `Message`, or an error, and both interrupted states keep it open after `execute()` returns {{sdk-java events/EventConsumer.java at v1.4.0.Final}} |
| a2a-js | after a terminal state, `TASK_STATE_INPUT_REQUIRED`, or a `Message`, and `TASK_STATE_AUTH_REQUIRED` keeps it open {{sdk-js src/server/events/execution_event_queue.ts at v1.3.0}} |
| a2a-dotnet | when the handler returns or calls a `TaskUpdater` method for a terminal or interrupted state {{sdk-dotnet src/A2A/Server/TaskUpdater.cs at v1.0.0-preview2}} |
| a2a-rs | after a terminal event or when the executor's stream ends, with no rule for interrupted states {{sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1}} |

A closed stream ends your watching, never the task. Call `GetTask`, and if the task is not terminal, act on its state and call `SubscribeToTask`, as [SendStreamingMessage and SubscribeToTask](#s-streaming-and-subscribe-to-task) shows.

## Keep watching while someone else acts

Without an open stream, "the client risks missing Task updates" {{spec §7.6.2}}, so subscribe with `SubscribeToTask`, register a webhook, or poll with `GetTask`.

The kit's planner subscribes. Its blocking `SendMessage` returns task `a31361b3` in `TASK_STATE_AUTH_REQUIRED`, and it calls `SubscribeToTask` at once, in exchanges 7 and 8 of `19-planner.http`. It alerts the operator only after the first frame arrives, because the specification defines no replay of earlier events.

```takeaways
- Answer `TASK_STATE_INPUT_REQUIRED` with a new message that carries the task's `taskId` and `contextId`.
- Pass a `TASK_STATE_AUTH_REQUIRED` request to whoever approves it, through a channel outside A2A.
- Subscribe, register a webhook, or poll before anyone acts on an approval request.
- Call `GetTask` whenever a stream closes, because servers disagree on when that happens.
```

Sources: spec §3.1.2, §3.2.2, §3.4.3, §7.6, §7.6.1, §7.6.2, §11.7 (research/sources/specification.md); proto TaskState (research/sources/a2a.proto); sdk src/a2a/server/agent_execution/active_task.py (a2a-python 1.2.2); sdk-go internal/taskupdate/final.go at v2.6.0; sdk-java server-common/src/main/java/org/a2aproject/sdk/server/events/EventConsumer.java at v1.4.0.Final; sdk-js src/server/events/execution_event_queue.ts at v1.3.0; sdk-dotnet src/A2A/Server/TaskUpdater.cs at v1.0.0-preview2; sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1; a2aproject/A2A PR #2270 (unreleased, branch dev-1.1); capture/out/06-input-required.http, 07-auth-required.http, 07-auth-required.events.json, 19-planner.http; capture/planner.py; capture/README.md
