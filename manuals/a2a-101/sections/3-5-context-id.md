# contextId

> A `contextId` groups many tasks into one conversation, a `taskId` groups many messages into one job, and only the server creates a task id.

`code-reviewer` stops halfway through a review and asks your planner which base branch to use. The answer must reach that same review. Later the diff changes, and the planner wants a second review that remembers the first. Two ids carry this: the task id for the job and the context id for the conversation.

When you finish this section, you can continue a task, start a follow-up in the same context, and know who creates each id.

## Two ids, two scopes

**Context:** an optional identifier that groups related tasks and messages {{spec §2.2}}. Tasks and messages with the same `contextId` should count as one conversational session {{spec §3.4.1}}.

**Task id:** the id of one stateful job. The server generates the task id when it creates a new task in response to a message {{spec §3.4.2}}. [Message](#s-message) gives the rules for sending one back.

The server usually creates the context too. An agent is allowed to generate a new `contextId` for a message that has none {{spec §3.4.1}}, and the response must carry it {{spec §3.4.1}}. In the kit, every first message carries no ids, and every answer, even the direct reply in `02-message-reply.http`, brings back a new context.

A client should treat a `contextId` from the server as an opaque identifier {{spec §3.4.1}}. Behind the id, the agent can keep internal state, conversation history, or LLM context across many interactions {{spec §3.4.1}}.

Propose your own context id only when you understand how the server will process it {{spec §3.4.1}}. A server that cannot take it must reject the request with an error, and it must not generate a new `contextId` for the response {{spec §3.4.1}}. The concept guide describes the context id as an identifier that the server generates {{docs key-concepts}}, which leaves no room for a proposal ([conflict D28](#s-ref-sources)). The specification wins, so expect either answer.

## Continuing a task

When a task waits for you, answer on that same task and send both of its ids, as [Message](#s-message) explains. [Interrupted states](#s-input-required-and-auth-required) follows the review's answer.

Only a task that is not terminal takes more messages {{spec §3.3.3}}. A message to a finished task fails with `UnsupportedOperationError`, as [CancelTask and terminal states](#s-cancel-task-and-terminal-states) shows.

## A follow-up is a new task

Once the review completes, a second round cannot reopen it. A refinement must start a new task in the same `contextId` {{docs life-of-a-task}}. The specification gives the client two fields for that. A client is allowed to send a `contextId` without a `taskId` to start a new task in an existing context {{spec §3.4.3}}. A client should use the `referenceTaskIds` field of the message to point to related tasks {{spec §3.4.3}}.

The captures stop before such a follow-up. The kit's server would accept one: given a `contextId` and no `taskId`, its `send` creates a new task in that context. [The kit's server code](manuals/a2a-101/capture/a2a_ref.py) shows this. [Figure](#fig-context-and-tasks) draws the captured review beside the follow-up a client would send next.

```figure
id: fig-context-and-tasks
kind: tree
title: one context, two tasks
claim: The review task holds both exchanges of the conversation, and a follow-up review joins the same context as a new task, because the review task is terminal.
caption: Read top down: the context, its tasks, and each task's history in order. The dashed task and its message show what a client sends next, because the captures stop before it. Ids shortened to 8 characters. From capture/out/06-input-required.http and capture/out/13-history.http.
```

Nothing limits a context to one task at a time: agents can create a separate, parallel task for each follow-up message {{docs life-of-a-task}}.

## What the agent keeps

The review task keeps its four messages in `history`, and [GetTask and ListTasks](#s-get-task-and-list-tasks) shows how to read them. Do not treat that history as a full transcript, because the agent decides which messages it keeps in the task history {{spec §3.7}}. In particular, messages from before the task was created can be missing from the history {{spec §3.7}}.

Contexts do not live forever either. An agent is allowed to expire or clean up contexts, and it should document any such policy {{spec §3.4.1}}. Check the agent's documentation before you rely on an old context id.

```takeaways
- Send no ids on a first message, then store the `taskId` and `contextId` the server returns.
- Continue a task that is not terminal with both of its ids in every message.
- After a terminal state, send the follow-up with the same `contextId`, no `taskId`, and the old task in `referenceTaskIds`.
- Treat context ids as opaque identifiers that an agent can expire.
```

Sources: spec §2.2, §3.3.3, §3.4.1, §3.4.2, §3.4.3, §3.7 (research/sources/specification.md); proto Task (research/sources/a2a.proto); docs docs/topics/key-concepts.md and docs/topics/life-of-a-task.md at v1.0.1; capture/out/02-message-reply.http, 06-input-required.http, 10-cancel.http, 13-history.http; capture/a2a_ref.py
