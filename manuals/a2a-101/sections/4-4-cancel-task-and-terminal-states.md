# CancelTask and terminal states

> Four terminal states end a task, the agent chooses three of them and CancelTask asks for the fourth, and no later call moves a task out of one.

The planner asks `test-runner` to run the unit tests at commit `9f3c2e1`. One test fails, and the task comes back in `TASK_STATE_COMPLETED`. A planner that reads only the state deploys broken code, and a planner that reads the artifact stops the release.

When you finish this section, you can tell the four endings apart, call `CancelTask`, and predict what a finished task answers.

## Terminal states

**Terminal state:** one of the four states that end a task: `TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, and `TASK_STATE_REJECTED`. The proto marks each one with "This is a terminal state" {{proto TaskState}}.

A terminal task never changes again: "Once a task reaches a terminal state (completed, canceled, rejected, or failed), it cannot restart" {{docs life-of-a-task}}. [Figure](#fig-task-endings) sets the four endings side by side.

```figure
id: fig-task-endings
kind: comparison
title: four ways a task ends
claim: The agent chose three of these endings and the client one, and once a task ends, the server refuses any further message or cancel.
caption: Each card is one task from the kit: who chose the ending, the final status message, and the artifacts left behind. The bottom rows show what the canceled task answers afterwards. Ids are shortened to 8 characters. From capture/out/03-blocking-task.http, 09-failed.http, 10-cancel.http, and 08-rejected.http.
```

## The agent's three endings

Task `3d8f7801` ran the suite at `9f3c2e1`. One of twelve tests failed, and the task still ended in `TASK_STATE_COMPLETED`:

```listing
title: a completed task that reports a failing test
source: capture/out/03-blocking-task.http
lang: json
note: Cut to the state, the status message, and the start of the summary.json data part.
---
    "task": {
      "id": "3d8f7801-f421-4e4e-aa2d-8b6da17d9281",
      …
        "state": "TASK_STATE_COMPLETED",
        …
              "text": "1 failed, 11 passed"
      …
          "artifactId": "summary",
          "name": "summary.json",
          "parts": [
            {
              "data": {
                "passed": 11,
                "failed": 1,
```

Completed "Indicates that a task has finished successfully" {{proto TaskState}}, and the job was to run the suite. Whether the code is good is a result, and results travel in artifacts {{spec §3.7}}. The kit's planner reads the `failed` count in `summary.json` before a deploy.

Commit `deadbee` does not exist, so task `8ae21dcb` ended in `TASK_STATE_FAILED`, which "Indicates that a task has finished with an error" {{proto TaskState}}. The same request fails the same way, so fix the input and start a new task. If the agent crashes, the reference SDK stores the task as failed, yet a blocking send gets an error {{sdk src/a2a/server/agent_execution/active_task.py}}. Treat that error as an unknown outcome.

The planner asked `deployer` for a production deploy. Task `23cf3710` went straight to `TASK_STATE_REJECTED`, which "Indicates that the agent has decided to not perform the task" {{proto TaskState}}. A loop that stops only on completed, failed, and canceled polls a rejected task forever. The same request gets the same refusal, so follow the status message: "Production deploys are outside this agent's policy. Use the release train."

## CancelTask

**CancelTask:** the operation that asks the server to stop a task, given its `id` {{proto CancelTaskRequest}}. Task `f22ed7af` was running the full suite when the planner called it. The reply was the task in `TASK_STATE_CANCELED`, with the two log chunks it had already written.

A cancel is a request: "The server will attempt to cancel the task, but success is not guaranteed" {{spec §3.1.5}}. The specification does not say which unfinished states a server must cancel, and the reference SDK cancels any task that is not terminal {{sdk src/a2a/server/request_handlers/default_request_handler_v2.py}}.

A second `CancelTask` gets `TaskNotCancelableError`, `-32002`, from the kit and the reference SDK {{sdk src/a2a/server/request_handlers/default_request_handler_v2.py}}, as §3.1.5 lists for a task "already completed, failed, or canceled" {{spec §3.1.5}}. Section 3.3.1 disagrees: "Cancel Task operations are idempotent - multiple cancellation requests have the same effect" {{spec §3.3.1}}, and a repeat on a purged task "MAY return TaskNotFoundError" {{spec §3.3.1}}.

So after a cancel that errors, call `GetTask`. Canceled means an earlier cancel worked, another terminal state means the task ended first, and running means the server cannot stop it {{spec §3.1.5}}.

## Calls on a finished task

A finished task still answers. `GetTask` returns the final task {{spec §3.1.3}}. `SendMessage` with its `taskId` gets `UnsupportedOperationError`, `-32004` {{spec §3.1.1}}, and `SubscribeToTask` gets the same error {{spec §3.1.6}}. `CancelTask` gets `TaskNotCancelableError` {{spec §3.1.5}}. `UnsupportedOperationError` also covers unrelated failures, so read its details, as [Errors](#s-errors) explains.

The official SDKs send the same error, with two differences in the other bindings:

| SDK | JSON-RPC | HTTP+JSON | gRPC |
|---|---|---|---|
| a2a-python 1.2.2 {{sdk src/a2a/server/agent_execution/active_task.py}} {{sdk src/a2a/utils/errors.py}} | `-32004` | `400` | `FAILED_PRECONDITION` |
| a2a-go {{sdk-go a2asrv/agentexec.go at v2.6.0}} | `-32004` | `400` | `FAILED_PRECONDITION` |
| a2a-java {{sdk-java server-common/src/main/java/org/a2aproject/sdk/server/requesthandlers/DefaultRequestHandler.java at v1.4.0.Final}} | `-32004` | `400` | `UNIMPLEMENTED` |
| a2a-js {{sdk-js src/server/request_handler/default_request_handler.ts at v1.3.0}} | `-32004` | `400` | `FAILED_PRECONDITION` |
| a2a-dotnet {{sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2}} | `-32004` | `400`, a problem-details body | none at this release |
| a2a-rs {{sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1}} | `-32004` | `400` | `FAILED_PRECONDITION` |

a2a-java answers gRPC with `UNIMPLEMENTED` where §5.4 maps the error to `FAILED_PRECONDITION` {{spec §5.4}}. a2a-go in its experimental cluster mode answers `InvalidParamsError`, `-32602`, instead {{sdk-go internal/taskexec/distributed_manager.go at v2.6.0}}.

To go on, start a new task in the same context, naming the finished one in `referenceTaskIds` {{spec §3.4.3}}, as [contextId](#s-context-id) shows.

```takeaways
- Stop every wait or poll loop on all four terminal states, `TASK_STATE_REJECTED` included.
- Read the artifacts for the result, because a completed test run can carry a failing test.
- After a cancel that errors, call `GetTask` and act on the state it returns.
- Start a new task in the same context, with `referenceTaskIds`, instead of messaging a finished task.
```

Sources: spec §3.1.1, §3.1.3, §3.1.5, §3.1.6, §3.3.1, §3.4.3, §3.7, §5.4 (research/sources/specification.md); proto TaskState, CancelTaskRequest (research/sources/a2a.proto); docs life-of-a-task (research/sources/docs.md); sdk src/a2a/server/agent_execution/active_task.py, src/a2a/server/request_handlers/default_request_handler_v2.py, src/a2a/utils/errors.py (a2a-python 1.2.2); sdk-go a2asrv/agentexec.go, internal/taskexec/distributed_manager.go (a2a-go v2.6.0); sdk-java server-common/src/main/java/org/a2aproject/sdk/server/requesthandlers/DefaultRequestHandler.java (a2a-java v1.4.0.Final); sdk-js src/server/request_handler/default_request_handler.ts (a2a-js v1.3.0); sdk-dotnet src/A2A/Server/A2AServer.cs (a2a-dotnet v1.0.0-preview2); sdk-rust a2a-server/src/handler.rs (a2a-rs a2a-server-lf-v0.5.1); capture/out/03-blocking-task.http, 08-rejected.http, 09-failed.http, 10-cancel.http, 14-resubscribe.http; capture/planner.py
