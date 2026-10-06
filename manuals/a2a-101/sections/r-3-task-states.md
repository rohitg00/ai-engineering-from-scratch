# Task states

> Nine values describe a task, and whether the current one is active, interrupted, or terminal tells the client what it can do next.

The proto marks four states terminal and two interrupted {{proto TaskState}}. Neither it nor the prose gives a transition table, so the agent decides the order. A blocking `SendMessage` returns at a terminal or interrupted state {{spec §3.2.2}}. [Task, TaskStatus, and TaskState](#s-task-and-task-state) classifies the values and collects the transitions the kit makes. [Interrupted states](#s-input-required-and-auth-required) and [CancelTask and terminal states](#s-cancel-task-and-terminal-states) explain the client's next step.

| State | Class | Set by | The client does next |
|---|---|---|---|
| TASK_STATE_UNSPECIFIED | none | Nobody: the zero value | Treat it, and any unknown name, as an error. |
| TASK_STATE_SUBMITTED | active | The server, on creation | Wait, poll, or subscribe. |
| TASK_STATE_WORKING | active | The agent, while it works | As for a submitted task |
| TASK_STATE_INPUT_REQUIRED | interrupted | The agent, with a question | Answer with a new message that carries the same `taskId` and `contextId`. |
| TASK_STATE_AUTH_REQUIRED | interrupted | The agent, for an authorization | Pass the request to whoever approves it, outside A2A, and subscribe, register a webhook, or poll. |
| TASK_STATE_COMPLETED | terminal | The agent, when the work is done | Read the artifacts for the result. Follow up in a new task with `referenceTaskIds`. |
| TASK_STATE_FAILED | terminal | The agent, unable to do the work | Read the status message, fix the input, and start a new task. |
| TASK_STATE_CANCELED | terminal | The agent, after `CancelTask` | Start a new task in the same context. |
| TASK_STATE_REJECTED | terminal | The agent, refusing the task | Stop the loop, and follow the status message. |

Until a task ends, `CancelTask` asks the server to stop it, and success is not guaranteed {{spec §3.1.5}}. A terminal task never changes. A message on its `taskId` and `SubscribeToTask` fail with `UnsupportedOperationError`, and `CancelTask` fails with `TaskNotCancelableError` {{spec §3.1.1}} {{spec §3.1.5}} {{spec §3.1.6}}. `GetTask` still returns it while the server keeps it {{spec §3.1.3}}.

A stream "MUST close when the task reaches a terminal state" {{spec §3.1.2}}. At an interrupted state the sources disagree ([conflict D3](#s-ref-sources-the-conflict-register)). The kit closes its stream at `TASK_STATE_INPUT_REQUIRED` and keeps it open through `TASK_STATE_AUTH_REQUIRED`, as the kit README lists. So after any close, call `GetTask` and act on the state it returns.

Sources: proto TaskState (research/sources/a2a.proto); spec §3.1.1, §3.1.2, §3.1.3, §3.1.5, §3.1.6, §3.2.2, §3.3.2, §3.4.3, §7.6.1, §7.6.2 (research/sources/specification.md); docs life-of-a-task (research/sources/docs.md); research/brief-spec.md sections 4.1 to 4.5, 5.4 and 12.2; manuals/a2a-101/capture/README.md; capture/out/03-blocking-task.http, 04-polling.http, 05-streaming.http, 06-input-required.http, 07-auth-required.http, 08-rejected.http, 09-failed.http, 10-cancel.http
