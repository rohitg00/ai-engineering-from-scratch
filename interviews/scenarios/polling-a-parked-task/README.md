---
id: polling-a-parked-task
title: An hour of polling a task that waited for us
card: scenarios
kind: incident
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, design-review]
tags: [a2a, task-states, input-required, polling, context-id]
minutes: 20
lessons: [phases/14-agent-engineering/26-failure-modes-agentic]
manuals: []
practice: []
cheatsheet: [a2a, agent-failure-modes]
related: [scenarios/cancel-a-finished-task]
updated: 2026-11-03
system:
  version: A2A 1.0.1 with the manual's capture kit (the test-runner, code-reviewer and deployer agents)
  model: no model; the agents are deterministic fixtures
  hardware: one machine, localhost, no network
source:
  - manuals/a2a-101/capture/out/06-input-required.http
  - manuals/a2a-101/capture/out/04-polling.http
  - manuals/a2a-101/capture/out/19-planner.log
  - manuals/a2a-101/sections/4-2-input-required-and-auth-required.md
  - manuals/a2a-101/sections/3-4-task-and-task-state.md
  - manuals/a2a-101/sections/3-1-message.md
  - manuals/a2a-101/sections/r-3-task-states.md
---

## Situation

A planner sends a diff of `payments-api` to the `code-reviewer` agent and waits for the findings. Its wait loop is the one it uses for every remote agent: send the message, then call `GetTask` every few seconds until the state is completed, failed or canceled. Last night a review never came back. The planner polled the same task for an hour, then its own run timed out, and the release waited for a human reviewer in the morning.

The on-call engineer pulls the first reply that the reviewer sent. It was not a failure, and the agent never went quiet. The planner knew the branch the diff was cut from, because it had checked the code out itself. You have the two exchanges of the review from the capture kit, a polling exchange on another agent for comparison, and the log of the kit's own planner, which handled the same question in its run.

## Evidence

- [the reply to the review request](evidence/first-reply.txt)
- [a GetTask on a task that is still running, from another capture](evidence/a-working-task-for-comparison.txt)
- [the message that answers the question](evidence/the-answer.txt)
- [the reply to the answer](evidence/completed-reply.txt)
- [how the kit's planner handled the same question](evidence/planner-log.txt)
- [the nine states, their class, and the client's next step](evidence/state-table.txt)
- [why the answer carries both ids](evidence/send-both-ids.txt)

## Questions

1. What state did the first reply carry, and who wrote the message inside it?
2. How does a task that waits for input differ from one that is working, when you look at two polls?
3. Where does the planner's answer go, and which fields must it carry?
4. Which states must a wait loop stop on, and what is the next step for each of them?
5. The planner had the branch name in its own context. Why did the loop never use it?

## Walkthrough

1. **Read the first reply.** The state is `TASK_STATE_INPUT_REQUIRED`. The status message has the role `ROLE_AGENT` and asks which base branch the diff should be compared against. A blocking send returns at a terminal or an interrupted state, so the question was in the planner's hands from the first reply, before the first poll.
2. **Compare with a working task.** In the polling capture the state is `TASK_STATE_WORKING`, the status message reports progress, and the artifact grows between polls. A parked task does none of that. Its state is the agent saying "your turn", and no number of polls changes it.
3. **Read the answer.** It is an ordinary `SendMessage`. The message has a fresh `messageId`, the role `ROLE_USER`, the text `main`, and both the `contextId` and the `taskId` copied from the task. The reference SDK does not infer the context from the task and stamps a fresh one, so a client sends both ids.
4. **Read the second reply.** The same task id comes back in `TASK_STATE_COMPLETED` with the status message `2 findings`. The history now holds the question and the answer, and the `review.json` artifact names `main` as the base and lists the two findings with their lines. The task never left its id or its context.
5. **Read the planner log.** The kit's planner sees the interrupted state, reads the question, answers from its own context with `main`, and reports the review one call later. The interrupted state is a branch in its loop, not a reason to wait.
6. **Read the state table.** Nine states fall in three classes. Two are interrupted, and each has a different next step: answer on the same task for input, or pass the request to an approver and keep watching for authorization. Four are terminal, and the fourth, rejected, is the one most loops forget.

## Resolution

The loop had the wrong stop set. It waited for three terminal states and treated everything else as "still running", so an interrupted task looked like a slow one. The fix adds the two interrupted states to the stop set and gives each a branch. For `TASK_STATE_INPUT_REQUIRED`, the planner reads the status message and answers with a new message that carries the task id and the context id of the parked task. For `TASK_STATE_AUTH_REQUIRED`, it hands the request to whoever approves and subscribes or polls. For `TASK_STATE_REJECTED`, it stops and follows the message. The capture proves the path: the reviewer finished one call after the answer and returned the review artifact, and the kit's planner log shows the same handling end to end.

## Wrong turns

- "Poll faster, the reviewer is slow." The state says that the agent waits for the client. The poll rate does not move it.
- "Abandon the task and send a new request with the branch in it." It works, and it leaves a parked task behind on the agent, resends the diff, and loses the history. The protocol's path is a new message on the same task.
- "Answer with the taskId only; the server knows the context." The reference SDK stamps a fresh context on such a message. Copy both ids.
- "Treat an interrupted state as a failure and report it." The task kept its id, its history and its artifacts. Nothing failed, and the answer finishes it.
- "Send the answer as ROLE_AGENT, because the planner is an agent." The role is the direction of the message, not the kind of party. The client side is `ROLE_USER`, and the kit refuses the other role with -32602.

## Generalize

A wait loop must know every state the other side can enter, and it must stop on each state that asks something of the caller, not only on the states that end the work. When a remote system pauses with a question, the answer is often already in the caller's context, and the loop is the only thing that stands between the two.

## Taught in

The [interrupted states page of A2A 101](../../../manuals/a2a-101/sections/4-2-input-required-and-auth-required.md) follows this review from the question to the answer, [the task state page](../../../manuals/a2a-101/sections/3-4-task-and-task-state.md) and [the state table](../../../manuals/a2a-101/sections/r-3-task-states.md) classify the nine states, [the message page](../../../manuals/a2a-101/sections/3-1-message.md) gives the id rules, and the [failure modes lesson](../../../phases/14-agent-engineering/26-failure-modes-agentic/) names context loss as one of the five ways an agent loop breaks.
