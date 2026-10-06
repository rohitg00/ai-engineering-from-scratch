# Task, TaskStatus, and TaskState

> A `Task` carries one `TaskStatus`, whose `state` is one of nine `TaskState` values, and the specification names those values without a table of the transitions between them.

Your planner holds three tasks at once: the tests on `test-runner`, the review on `code-reviewer`, and the deploy on `deployer`. Each is a `Task` with a `status`, and the planner's next action turns on `status.state`: wait, act, or stop.

When you finish this section, you can read every field of a `Task`, classify every `TaskState` value, and say which transitions the specification defines.

## Task

**Task:** "The fundamental unit of work managed by A2A, identified by a unique ID" {{spec §2.2}}. The proto gives `Task` six fields and marks `id` and `status` REQUIRED {{proto Task}}. The server creates the `id` {{proto Task}}, and a client cannot supply one {{spec §3.4.2}}.

The optional fields are `contextId`, `artifacts`, `history`, and `metadata` {{proto Task}}. [contextId](#s-context-id), [Artifact and chunks](#s-artifact-and-chunks), and [GetTask and ListTasks](#s-get-task-and-list-tasks) cover the first three in turn. [Figure](#fig-task-object-model) lays out task `3d8f7801` from the blocking run.

```figure
id: fig-task-object-model
kind: structure
title: the object model of one task
claim: A task carries its own id, its context, one current status, its artifacts, and its history, and every message and artifact inside it is made of parts.
caption: Read the task table from the top, in the order the blocking run filled it. The boxes on the right expand its last two rows, and the chips below show the four kinds of part. Values come from capture/out/03-blocking-task.http, ids shortened to 8 characters. The raw and url examples come from 06-input-required.http and 11-errors.http.
```

## TaskStatus

**TaskStatus:** the current status of a task, with `state` REQUIRED and `message` and `timestamp` optional {{proto TaskStatus}}. The message is "A message associated with the status" {{proto TaskStatus}}, and the timestamp is an "ISO 8601 Timestamp when the status was recorded" {{proto TaskStatus}}.

A task has one status at a time, and the previous status message can move into `history`, as `06-input-required.http` shows.

## TaskState

The enum `TaskState` has nine values, numbered 0 to 8 {{proto TaskState}}. In JSON, a state travels as its name {{spec §5.5}}.

**Terminal state:** a state that ends the task for good. The proto marks four values with "This is a terminal state" {{proto TaskState}}.

**Interrupted state:** a state in which the task waits for something from outside the agent. The proto marks two values with "This is an interrupted state" {{proto TaskState}}.

**Active state:** this manual's name for `TASK_STATE_SUBMITTED` and `TASK_STATE_WORKING`, which the proto puts in neither group.

| Value | Number | Class | In the kit |
|---|---|---|---|
| `TASK_STATE_UNSPECIFIED` | 0 | none | never sent |
| `TASK_STATE_SUBMITTED` | 1 | active | every new task, `04-polling.http` |
| `TASK_STATE_WORKING` | 2 | active | the suite runs, `05-streaming.http` |
| `TASK_STATE_COMPLETED` | 3 | terminal | the tests end, `03-blocking-task.http` |
| `TASK_STATE_FAILED` | 4 | terminal | commit `deadbee`, `09-failed.http` |
| `TASK_STATE_CANCELED` | 5 | terminal | after `CancelTask`, `10-cancel.http` |
| `TASK_STATE_INPUT_REQUIRED` | 6 | interrupted | the base branch question, `06-input-required.http` |
| `TASK_STATE_REJECTED` | 7 | terminal | a production deploy, `08-rejected.http` |
| `TASK_STATE_AUTH_REQUIRED` | 8 | interrupted | waiting for an operator, `07-auth-required.http` |

`TASK_STATE_UNSPECIFIED` is the proto3 zero value, for a task "in an unknown or indeterminate state" {{proto TaskState}}. The kit never sends it, so treat it and any unknown name as an error.

A client needs both named sets, because a blocking `SendMessage` returns at a terminal or an interrupted state {{spec §3.2.2}}, as [SendMessage](#s-send-message) shows.

## The transitions the specification allows

The specification says tasks "progress through a defined lifecycle" {{spec §2.2}}, yet neither its prose nor the proto has a transition table. What it says about transitions fits in four rules:

- Input: "Agents can request additional input mid-processing by transitioning a task to the `input-required` state" {{spec §3.4.3}}. That is the 0.3 name of `TASK_STATE_INPUT_REQUIRED` ([conflict D37](#s-ref-sources)).
- Authorization: an agent "MUST transition the TaskState to `TASK_STATE_AUTH_REQUIRED`" to ask for it, and can resume without a client message {{spec §7.6.1}}.
- Rejection: an agent can reject "during initial task creation or later" {{proto TaskState}}.
- Finality: a terminal task refuses messages {{spec §3.1.1}}, cancellation {{spec §3.1.5}}, and subscription {{spec §3.1.6}}.

The migration guide says 1.0 clarified "Task state transitions for cancellation scenarios" {{docs whats-new-v1}}, and the specification lists none ([conflict D38](#s-ref-sources)). The extensions guide lists extensions for "Adding new states or transitions" {{docs extensions}} and says extensions "should use existing enum values" {{docs extensions}} ([conflict D29](#s-ref-sources)). Expect only the nine values.

With no table in the protocol, an agent's transitions are whatever its code emits. [Figure](#fig-task-states) collects every transition the kit's agents make.

```figure
id: fig-task-states
kind: state
title: the nine task states and the transitions the kit makes
claim: The kit's captures show nine transitions between task states, and none of them leaves a double-bordered terminal state.
caption: Boxes are TaskState values with the TASK_STATE_ prefix dropped. Dashed arrows are the transitions the kit's agents make, in capture order, labelled with the capture that shows each one. Read them as one implementation's behavior, never as the protocol's rules. Blocking captures return only the final state, so their earlier transitions come from the history they return and from capture/agents.py.
```

The deployer leaves `TASK_STATE_AUTH_REQUIRED` with no message from the client, as the specification allows {{spec §7.6.1}}, and rejects straight from `TASK_STATE_SUBMITTED`. The reference SDK enforces no table either {{sdk src/a2a/server/agent_execution/active_task.py}}, so accept any transition out of a state that is not terminal.

A terminal task refuses a message on its `taskId` and `SubscribeToTask` with `UnsupportedOperationError`, and `CancelTask` with `TaskNotCancelableError` {{spec §3.1.1}} {{spec §3.1.5}} {{spec §3.1.6}}. [CancelTask and terminal states](#s-cancel-task-and-terminal-states) covers the four endings, and [the state table](#s-ref-task-states) lists the client's next step for each value.

```takeaways
- Hard-code the two sets: terminal is `COMPLETED`, `FAILED`, `CANCELED`, `REJECTED`, and interrupted is `INPUT_REQUIRED`, `AUTH_REQUIRED`, each with the `TASK_STATE_` prefix.
- Compare states by name, and treat `TASK_STATE_UNSPECIFIED` or an unknown name as an error.
- Accept any transition out of a state that is not terminal, including a rejection straight after creation.
- Check the state before you message, cancel, or subscribe, because all three fail on a terminal task.
```

Sources: spec §2.2, §3.1.1, §3.1.5, §3.1.6, §3.2.2, §3.4.2, §3.4.3, §5.5, §7.6.1 (research/sources/specification.md); proto Task, TaskStatus, TaskState (research/sources/a2a.proto); docs docs/topics/extensions.md and docs/whats-new-v1.md at v1.0.1; sdk src/a2a/server/agent_execution/active_task.py at a2a-python 1.2.2; capture/out/03-blocking-task.http, 04-polling.http, 05-streaming.http, 06-input-required.http, 07-auth-required.http, 08-rejected.http, 09-failed.http, 10-cancel.http, 11-errors.http; capture/agents.py
