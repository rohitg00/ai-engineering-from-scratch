---
id: cancel-a-finished-task
title: A shutdown that retried a cancel forever
card: scenarios
kind: incident
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, design-review]
tags: [a2a, task-states, cancel, terminal-states, retries]
minutes: 20
lessons: [phases/14-agent-engineering/26-failure-modes-agentic]
manuals: []
practice: []
cheatsheet: [a2a, agent-failure-modes]
related: [scenarios/task-not-found-in-two-bindings]
updated: 2026-11-03
system:
  version: A2A 1.0.1 with the manual's capture kit (the test-runner, code-reviewer and deployer agents)
  model: no model; the agents are deterministic fixtures
  hardware: one machine, localhost, no network
source:
  - manuals/a2a-101/capture/out/10-cancel.http
  - manuals/a2a-101/sections/4-4-cancel-task-and-terminal-states.md
  - manuals/a2a-101/sections/5-5-errors.md
  - manuals/a2a-101/sections/r-3-task-states.md
---

## Situation

A supervisor service drives a fleet of remote agents. At the end of a run it lists every task it started and sends `CancelTask` to each one. Its rule for every call is simple: an error means "not yet", so the call goes out again until it returns a task. Last night the shutdown never finished. Two tasks on the `test-runner` agent answered an error on every attempt, for the whole night.

The on-call engineer reads the supervisor log. One of the two tasks had been stopped by an operator earlier in the run, by hand, through the same agent. After the shutdown routine failed to cancel it, the engineer sent it the message "Try again" to wake it up, and got a second kind of error. The ticket says that the agent is stuck and asks for a restart of the agent. You have the four exchanges that the capture kit recorded for the same sequence of calls.

## Evidence

- [the send that started the suite, and the state it came back in](evidence/the-send.txt)
- [the reply to the first CancelTask](evidence/first-cancel.txt)
- [the second CancelTask on the same id, status and code](evidence/second-cancel.txt)
- [the detail inside the second cancel error](evidence/second-cancel-reason.txt)
- [a message sent to the canceled task, and the code it got](evidence/message-after-cancel.txt)
- [the detail inside the error for the message](evidence/message-after-cancel-reason.txt)
- [what the specification and the implementations say about a repeated cancel](evidence/after-a-cancel-that-errors.txt)

## Questions

1. What did the first cancel return, and what did the task still carry?
2. The second cancel and the later message got two different codes. What do their details have in common?
3. Is a repeated cancel an error or a no-op? What does the specification say, and what do the kit and the reference implementation do?
4. Which call tells the supervisor whether to keep going, and what are its three possible outcomes?
5. How does the supervisor continue the work that the canceled task was doing?

## Walkthrough

1. **Read the send.** The planner asked for the full suite with `returnImmediately` set, and the task came back in `TASK_STATE_SUBMITTED`. The task exists and runs while the client is away.
2. **Read the first cancel.** The reply is the task itself, now in `TASK_STATE_CANCELED`, with the status message "Canceled at the client's request." The history holds the request and the agent's progress message, and the artifacts hold the two log chunks the suite had written. A cancel is a request that the server may refuse, and this one succeeded.
3. **Read the second cancel.** The HTTP status is 200, because JSON-RPC errors travel in a 200. The body has an `error` with code -32002 and the message "Task cannot be canceled". The detail gives the reason `TASK_NOT_CANCELABLE` and, in `metadata`, the state `TASK_STATE_CANCELED`. The error does not say "try later". It says that the task already ended, and how.
4. **Read the message.** The "Try again" message carries the task id and the context id of the canceled task. The code is -32004 and the reason is `UNSUPPORTED_OPERATION`. The metadata names the same state. A terminal task refuses a message, a cancel and a subscription. Only `GetTask` still answers.
5. **Read the rule.** One section of the specification lists `TaskNotCancelableError` for a finished task, and another calls cancel idempotent. Both this server and the reference SDK return -32002, and a cancel on a deleted task may return not found. A client cannot know which server it meets, so after a cancel that errors it calls `GetTask`. Canceled means an earlier cancel worked. Another terminal state means the task ended first. Running means the server could not stop it.
6. **Check the stop set.** Four states are terminal: completed, failed, canceled and rejected. A loop that waits for "a task" as its success condition never ends on a task that is already in one of them.

## Resolution

Nothing was stuck. The supervisor's retry rule treated a permanent state as a transient error, and the engineer's "Try again" repeated the same mistake with a message. The fix is in the client. When `CancelTask` returns an error, the supervisor calls `GetTask` once and reads the state. A terminal state closes the entry. The code -32004 is read with its metadata, because the same code also covers a card without streaming and a card without an extended card. To continue the work, the supervisor starts a new task in the same context and names the finished task in `referenceTaskIds`. It never sends a message to a terminal task. In the capture, every call after the cancel is one request and one definitive answer, which is what the shutdown now takes: one pass over the list.

## Wrong turns

- "Retry the cancel until it returns the task." The second cancel answers -32002 every time, and its metadata already names the final state. The retry can only stop when the client stops it.
- "Message the task to restart it." A terminal task never changes again. The message gets -32004. New work is a new task, with the old id in `referenceTaskIds`.
- "Read -32004 as 'this server does not support cancel'." The code covers three cases: no streaming, no extended card, and a terminal task. The message and the metadata, or a `GetTask`, tell them apart.
- "Stop the loop on completed, failed and canceled." Rejected is terminal too. A loop that forgets it polls a refused task forever.
- "Restart the agent." The agent answered every call at once with a correct error. A restart would throw away the task store and turn the next lookup into a not found.

## Generalize

An error from a mutation is not a reason to repeat the mutation. Read the state that the error names, or fetch it, and decide from the state. Separate the errors that time will change from the ones that no later call can change, and let the terminal set of your state machine end every loop, including the states you did not expect.

## Taught in

The [cancel page of A2A 101](../../../manuals/a2a-101/sections/4-4-cancel-task-and-terminal-states.md) walks through these four exchanges, [the state table](../../../manuals/a2a-101/sections/r-3-task-states.md) gives the client's next step for every state, [the errors page](../../../manuals/a2a-101/sections/5-5-errors.md) explains why one code covers three cases, and the [failure modes lesson](../../../phases/14-agent-engineering/26-failure-modes-agentic/) describes the cascade that starts when a client cannot tell "I failed" from "this cannot be done".
