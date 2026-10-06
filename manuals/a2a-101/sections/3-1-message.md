# Message

> A `Message` is one turn in a conversation, and its `role` and three ids say which way it travels and which task it continues.

The planner sends `code-reviewer` a diff to review. The reviewer asks which base branch to compare against, the planner answers `main`, and the reviewer finishes the task with two findings.

When you finish this section, you can build a valid message and set its ids to continue a task.

## messageId, role, and parts

**Message:** "one unit of communication between client and server" {{proto Message}}. It has eight fields, and only `messageId`, `role`, and `parts` are REQUIRED {{proto Message}}. The `parts` list "MUST contain at least one element" {{spec §5.7}}, and [Part](#s-part) explains what a part holds.

[Figure](#fig-message-fields) sets three messages of that review side by side and names who sets each field.

```figure
id: fig-message-fields
kind: structure
title: who sets each field of a message
claim: A message carries an id its sender mints, while its `contextId` and `taskId` come from the server and the client echoes them to continue.
caption: Columns are three messages from capture/out/06-input-required.http, in the order they were sent. The right column names who sets each field. Ids shortened to 8 characters.
```

The sender creates `messageId`: "This is created by the message creator" {{proto Message}}. The kit refuses a message without one, as [Errors](#s-errors) shows. Spec samples in §11.2 and §6.3 leave `messageId` out {{spec §11.2}} {{spec §6.3}}, so never copy a sample as it stands ([conflict D23](#s-ref-sources)).

**Role:** the direction a message travels. The value `ROLE_USER` marks a message "from the client to the server" {{proto Role}}, and `ROLE_AGENT` marks one from the server to the client {{proto Role}}. The planner is an agent, yet its messages to `code-reviewer` carry `ROLE_USER`, because it is the client there.

The glossary in §2.2 still writes the roles as "user" and "agent" {{spec §2.2}} {{spec §5.5}} ([conflict D35](#s-ref-sources)). The spec names no error for a client that sends `ROLE_AGENT`, and the kit answers `-32602`, as [the kit README](manuals/a2a-101/capture/README.md) lists.

## contextId and taskId

A client message with neither id starts something new. The server's messages then carry the `contextId` it minted, plus the `taskId` of any task it creates {{proto Message}}. The direct reply in `02-message-reply.http` carries a `contextId` and no `taskId`, because the reviewer answered without creating a task:

```listing
title: a server message with a context and no task
source: capture/out/02-message-reply.http
lang: json
note: The result of the only exchange in the file, complete.
---
  "result": {
    "message": {
      "messageId": "3b4b1206-4b6f-467f-b735-2d7e4f7f4bcd",
      "contextId": "dc423c62-d5f4-48e5-82c0-4963b9bc4334",
      "role": "ROLE_AGENT",
      "parts": [
        {
          "text": "I review unified diffs in Python, TypeScript and Go. Send the diff as a text/x-diff part and name the base branch."
        }
      ]
    }
  }
```

To continue a task, the client copies both ids from the task into its next message, as the planner's answer does:

```listing
title: the planner's answer, with both ids copied from the task
source: capture/out/06-input-required.http
lang: json
note: The message of exchange 2, complete.
---
    "message": {
      "messageId": "096d3737-42f9-4039-8320-a4737c2b3abe",
      "contextId": "49c5a238-4158-455d-8d63-b2cb39c0ecac",
      "taskId": "e5c95b09-6d4b-4b3b-8693-91e81472d12f",
      "role": "ROLE_USER",
      "parts": [
        {
          "text": "main"
        }
      ]
    }
```

Three rules govern those two ids:

- **A client `taskId` must name a live task.** "When a client includes a `taskId` in a Message, it MUST reference an existing task" {{spec §3.4.2}}. An unknown id gets `TaskNotFoundError`, and [CancelTask and terminal states](#s-cancel-task-and-terminal-states) covers a finished task.
- **The two ids must agree.** "Agents MUST reject messages containing mismatching `contextId` and `taskId`" {{spec §3.4.3}}. The spec names no error for this, and both the kit and the reference SDK answer `-32602` {{sdk src/a2a/server/request_handlers/default_request_handler_v2.py}}.
- **The context follows the task.** "Agents MUST infer `contextId` from the task if only `taskId` is provided" {{spec §3.4.3}}. The kit does, and the table below says what each SDK does.

A message with a `contextId` and no `taskId` starts a new task in that conversation, as [contextId](#s-context-id) shows.

## What the SDKs do with the ids

"Send Message operations MAY be idempotent. Agents may utilize the messageId to detect duplicate messages" {{spec §3.3.1}}. So a retry of a send that timed out can reuse the same `messageId`. No SDK rejects a repeated id, and without a `taskId` each one creates another task for it.

| SDK | Message with only `taskId` | Same `messageId` sent twice to one task |
|---|---|---|
| Python 1.2.2 | Does not read the task, and stamps a fresh `contextId` on the message {{sdk src/a2a/server/agent_execution/context.py}} | Accepted. The history skips a second copy, and the agent runs again {{sdk src/a2a/server/agent_execution/active_task.py}} |
| Go v2.6.0 | The agent context gets the task's `contextId`, and the stored message stays as sent {{sdk-go a2asrv/agentexec.go at v2.6.0}} | Accepted. The history skips a second copy, and the agent runs again {{sdk-go a2asrv/agentexec.go at v2.6.0}} |
| Java v1.4.0.Final | The agent context and its events get the task's `contextId`, and the stored message stays as sent {{sdk-java server-common/src/main/java/org/a2aproject/sdk/server/requesthandlers/DefaultRequestHandler.java at v1.4.0.Final}} | Accepted. The message is appended to history again, and the agent runs again {{sdk-java server-common/src/main/java/org/a2aproject/sdk/server/tasks/TaskManager.java at v1.4.0.Final}} |
| JS v1.3.0 | The agent context and its copy of the message get the task's `contextId`, and the stored message stays as sent {{sdk-js src/server/request_handler/default_request_handler.ts at v1.3.0}} | Accepted. The message is appended to history again, and the agent runs again {{sdk-js src/server/request_handler/default_request_handler.ts at v1.3.0}} |
| .NET v1.0.0-preview2 | The agent context gets the task's `contextId`, and the stored message stays as sent {{sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2}} | Accepted. The message is appended to history again, and the handler runs again {{sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2}} |
| Rust a2a-server-lf-v0.5.1 | The executor context gets the task's `contextId`, and the stored message stays as sent {{sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1}} | Accepted. The message is appended to history again, and the executor runs again {{sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1}} |

Five SDKs infer the context for the agent and store the message as sent, and the reference SDK generates a new one. Send both ids, and the difference never reaches you.

## Optional fields and the status message

No message in the kit's captures sets these three:

- **`referenceTaskIds`** lists "task IDs that this message references for additional context" {{proto Message}}.
- **`extensions`** lists "The URIs of extensions that are present or contributed to this Message" {{proto Message}}, and [extensions](#s-extensions) covers them.
- **`metadata`** is a free-form JSON object {{proto Message}}.

**Status message:** the one `message` a `TaskStatus` can hold, the agent's words inside a task {{proto TaskStatus}}. The reviewer's question was a status message, and the findings themselves arrive in the `review.json` artifact, as [what A2A standardizes](#s-what-a2a-standardizes) explains.

```takeaways
- Mint a fresh `messageId` for every message you send, and reuse it only to retry the same message.
- Send `ROLE_USER` from the client and `ROLE_AGENT` from the server, whatever the party is.
- Copy both `taskId` and `contextId` from the task into each follow-up, because the reference SDK does not infer the context.
```

Sources: proto Message, Role, TaskStatus (research/sources/a2a.proto); spec §2.2, §3.3.1, §3.4.2, §3.4.3, §5.5, §5.7, §6.3, §11.2 (research/sources/specification.md); sdk src/a2a/server/agent_execution/active_task.py, src/a2a/server/agent_execution/context.py, src/a2a/server/request_handlers/default_request_handler_v2.py; sdk-go a2asrv/agentexec.go at v2.6.0; sdk-java server-common/src/main/java/org/a2aproject/sdk/server/requesthandlers/DefaultRequestHandler.java, server-common/src/main/java/org/a2aproject/sdk/server/tasks/TaskManager.java at v1.4.0.Final; sdk-js src/server/request_handler/default_request_handler.ts at v1.3.0; sdk-dotnet src/A2A/Server/A2AServer.cs at v1.0.0-preview2; sdk-rust a2a-server/src/handler.rs at a2a-server-lf-v0.5.1; capture/README.md; capture/out/02-message-reply.http, 06-input-required.http
