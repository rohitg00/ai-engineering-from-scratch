---
id: a2a-rejected-task-loop
title: The poll loop that never ends and the deploy that should not
card: protocols
kind: debug
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, coding]
tags: [a2a, task-state, terminal-state, artifacts, polling]
minutes: 8
lessons: []
manuals: [a2a-101#s-cancel-task-and-terminal-states, a2a-101#s-task-and-task-state]
practice: []
cheatsheet: [a2a]
related: [protocols/a2a-card-before-the-call]
updated: 2026-11-03
---

A planner polls a remote agent with `GetTask` until a task is done. It stops when the state is completed, failed or canceled. Against a deploy agent, the loop never returns. Against a test runner, the planner deploys a build whose test suite had a failure. Explain both bugs.

## Short answer

The loop knows three terminal states, and there are four. The deploy agent rejected the task, and a task in `TASK_STATE_REJECTED` never changes again, so the loop spins forever. The test runner finished the work it was asked to do, so its task is `TASK_STATE_COMPLETED` even with a failing test, because the verdict is a result and results travel in artifacts.

## Full answer

### Nine states, two sets the client must hard-code

| Class | States |
|---|---|
| active | `TASK_STATE_SUBMITTED`, `TASK_STATE_WORKING` |
| interrupted | `TASK_STATE_INPUT_REQUIRED`, `TASK_STATE_AUTH_REQUIRED` |
| terminal | `TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED` |

`TASK_STATE_UNSPECIFIED` is the proto zero value. Treat it, and any unknown name, as an error. The proto marks four states terminal and two interrupted, and it gives no transition table, so accept any transition out of a state that is not terminal. A deploy agent can reject straight from submitted.

### Bug one: the forgotten ending

Rejected means the agent decided not to do the task. In the recorded run the status message read "Production deploys are outside this agent's policy. Use the release train." The same request gets the same refusal, so the planner should stop and follow the message, not retry.

### Bug two: a state is not a verdict

Completed means the task finished successfully, and the job was to run the suite. In the recorded blocking run the status message said "1 failed, 11 passed", and the `summary.json` artifact carried `"passed": 11` and `"failed": 1`. A planner reads the `failed` count in that data part before it deploys. A message should not carry the output of a task.

### What a finished task still answers

| Call on a terminal task | Reply |
|---|---|
| `GetTask` | the final task, while the server keeps it |
| `SendMessage` with its `taskId` | `UnsupportedOperationError`, `-32004` |
| `SubscribeToTask` | `UnsupportedOperationError`, `-32004` |
| `CancelTask` | `TaskNotCancelableError`, `-32002` |

To go on, start a new task in the same `contextId` and name the finished task in `referenceTaskIds`.

## Follow-ups

- **Level 2:** Which other states must the loop handle, and how? Expected: the two interrupted states; answer `TASK_STATE_INPUT_REQUIRED` with a message on the same task, and route `TASK_STATE_AUTH_REQUIRED` to an approver outside A2A while you subscribe or poll.
- **Level 3:** You call `CancelTask` and get `-32002`. What next? Expected: call `GetTask`; canceled means an earlier cancel worked, another terminal state means the task ended first, and a running state means the server cannot stop it.
- **Level 3:** The agent process crashed mid-task and your blocking send returned an error. Is the task failed? Expected: treat the outcome as unknown; the reference SDK stores the task as failed, but the client only saw an error, so read the task back.
- **Level 4:** How do you continue a completed review with a changed diff? Expected: a new task with the same `contextId`, no `taskId`, and the old task in `referenceTaskIds`; a terminal task takes no more messages.

## Wrong answers

- "Compare the state with the lower-case string `completed`." The current version sends enum names such as `TASK_STATE_COMPLETED`, and an unknown name must be an error, not a wait.
- "A completed task means the tests passed." Completed means the agent finished the work it was asked to do. The verdict is in the artifact.
- "Send another message to the rejected task and ask again." A terminal task refuses messages. Start a new task in the same context.

## Taught in

The [terminal states section](../../../manuals/a2a-101/sections/4-4-cancel-task-and-terminal-states.md) shows the four endings from the recorded runs, and the [task state section](../../../manuals/a2a-101/sections/3-4-task-and-task-state.md) classifies all nine values.
