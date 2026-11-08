---
id: a2a
title: A2A Protocol
code: AP
subtitle: Cards, messages, tasks, states, the three bindings, errors and the 0.3 layer of A2A 1.0.1. Facts from the manual.
hue: 200
sources: manuals/a2a-101
source_hash: ad21d385000c4e28
---

## Protocol architecture
type: architecture
from: manuals/a2a-101/sections/1-1-what-a2a-standardizes.md, manuals/a2a-101/sections/2-1-agentcard-fields.md, manuals/a2a-101/sections/2-2-discovery-and-supported-interfaces.md, manuals/a2a-101/sections/5-1-json-rpc.md, manuals/a2a-101/sections/5-2-http-json.md, manuals/a2a-101/sections/7-2-a-server.md

```arch
node | planner | 1,1 | Planner | client, reads cards | client
node | card | 1,2 | AgentCard | /.well-known/agent-card.json | client
node | jsonrpc | 2,1 | JSON-RPC | /a2a/jsonrpc | process
node | handler | 3,1 | Handler | checks, then executor | process
node | rest | 3,2 | HTTP+JSON | /a2a/rest | process
node | store | 4,1 | Task store | record of each task | store
edge | planner | card | GET
edge | planner | jsonrpc | POST
edge | jsonrpc | handler | method
edge | rest | handler | route
edge | handler | store | task
```

## Send and read a task
type: task-table
from: manuals/a2a-101/sections/2-2-discovery-and-supported-interfaces.md, manuals/a2a-101/sections/4-1-send-message.md, manuals/a2a-101/sections/5-1-json-rpc.md, manuals/a2a-101/sections/5-4-version-and-extension-headers.md, manuals/a2a-101/capture/out/01-agent-cards.http

| Task | Code |
|---|---|
| Read the agent card | `GET /.well-known/agent-card.json HTTP/1.1` |
| Send one message | `"method": "SendMessage"` posted to `/a2a/jsonrpc` |
| Send the version | `A2A-Version: 1.0` |
| Send and return at once | `"returnImmediately": true` in `configuration` |
| Open a stream | `"method": "SendStreamingMessage"` |

## Commands over HTTP+JSON
type: command-table
from: manuals/a2a-101/sections/5-2-http-json.md, manuals/a2a-101/sections/4-4-cancel-task-and-terminal-states.md, manuals/a2a-101/capture/out/16-rest-binding.http

| Command | What it does |
|---|---|
| `POST /a2a/rest/message:send` | Sends a message. The reply is a task or a message. |
| `POST /a2a/rest/tasks/<task id>:cancel` | Asks the server to stop a task that is not terminal. |
| `GET /.well-known/agent-card.json` | Reads the agent card from the well-known path. |
| `POST /a2a/rest/tasks/<task id>:cancel` | Returns a task error when the task is already terminal. |

## Settings and defaults
type: defaults
from: manuals/a2a-101/sections/4-1-send-message.md, manuals/a2a-101/sections/4-3-get-task-and-list-tasks.md, manuals/a2a-101/sections/2-1-agentcard-fields.md, manuals/a2a-101/sections/5-4-version-and-extension-headers.md

| Setting | Default | Note |
|---|---|---|
| `returnImmediately` | false | A send waits for a terminal or interrupted state |
| `historyLength` | unset | The server decides how much history to return. `0` returns no history. |
| `pageSize` | 50 | The maximum in `ListTasks` is 100 |
| `includeArtifacts` | false | Artifacts are left out of list results |
| `A2A-Version` | 1.0 | Required on every request, with no patch number |

## Compare the bindings
type: comparison
from: manuals/a2a-101/sections/5-1-json-rpc.md, manuals/a2a-101/sections/5-2-http-json.md, manuals/a2a-101/sections/5-3-grpc.md, manuals/a2a-101/sections/5-5-errors.md, manuals/a2a-101/sections/5-4-version-and-extension-headers.md

| Factor | JSON-RPC | HTTP+JSON | gRPC |
|---|---|---|---|
| Operation named by | `method`, such as `SendMessage` | route, such as `POST /message:send` | rpc `SendMessage` in `A2AService` |
| Where it is sent | one URL, `/a2a/jsonrpc` in the kit | one route per operation | `lf.a2a.v1.A2AService` over HTTP/2 with TLS |
| Stream frame | a `data:` line with a full JSON-RPC response | a `data:` line with the `StreamResponse` alone | a server-streaming rpc of `StreamResponse` |
| `TaskNotFoundError` | `-32001` with HTTP 200 | HTTP 404 | `NOT_FOUND` |
| Version header | `A2A-Version` header | `A2A-Version` header | `a2a-version` metadata key |

## Task states
type: concepts
from: manuals/a2a-101/sections/3-4-task-and-task-state.md, manuals/a2a-101/sections/4-2-input-required-and-auth-required.md, manuals/a2a-101/sections/4-4-cancel-task-and-terminal-states.md

- **Active**: `TASK_STATE_SUBMITTED` and `TASK_STATE_WORKING`. The agent is still working.
- **Interrupted**: `TASK_STATE_INPUT_REQUIRED` and `TASK_STATE_AUTH_REQUIRED`. The task waits for you.
- **Terminal**: `TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`, `TASK_STATE_CANCELED`, `TASK_STATE_REJECTED`. The task never changes again.
- **TASK_STATE_UNSPECIFIED**: never sent by the kit. Treat it as an error.

## One task, step by step
type: flow
from: manuals/a2a-101/sections/1-1-what-a2a-standardizes.md, manuals/a2a-101/sections/3-1-message.md, manuals/a2a-101/sections/4-1-send-message.md, manuals/a2a-101/sections/4-2-input-required-and-auth-required.md, manuals/a2a-101/sections/4-3-get-task-and-list-tasks.md

1. **Client**: sends a blocking `SendMessage` with a new `messageId` and no `taskId`.
2. **Server**: creates the task and mints its `taskId` and `contextId`.
3. **Agent**: stops at `TASK_STATE_INPUT_REQUIRED`, and the call returns the task with its question.
4. **Client**: answers with a second `SendMessage` with the same `taskId` and `contextId`.
5. **Server**: returns the same task in `TASK_STATE_COMPLETED`, with its artifact.
6. **Client**: calls `GetTask` with the `taskId` to read the stored task again.

## JSON-RPC request
type: annotated-code
lang: bash
from: manuals/a2a-101/sections/5-1-json-rpc.md, manuals/a2a-101/sections/3-1-message.md, manuals/a2a-101/sections/5-4-version-and-extension-headers.md, manuals/a2a-101/capture/out/02-message-reply.http

```bash
curl -s http://localhost:41242/a2a/jsonrpc \  # one URL for every operation
  -H 'Content-Type: application/json' \  # JSON body
  -H 'A2A-Version: 1.0' \  # required on every request
  -d '{
    "jsonrpc": "2.0",  # envelope version, always 2.0
    "id": 1,  # the reply repeats this id
    "method": "SendMessage",  # PascalCase operation name
    "params": {"message": {
      "messageId": "d95bafc8-f2a4-427b-9cf4-bb99f4bea973",  # minted by the client
      "role": "ROLE_USER",  # the client always sends ROLE_USER
      "parts": [{"text": "What languages can you review?"}]  # at least one part
    }}
  }'
```

## Troubleshooting
type: troubleshooting
from: manuals/a2a-101/sections/5-4-version-and-extension-headers.md, manuals/a2a-101/sections/5-5-errors.md, manuals/a2a-101/sections/4-4-cancel-task-and-terminal-states.md, manuals/a2a-101/sections/7-4-from-0-3-to-1-0.md, manuals/a2a-101/sections/3-5-context-id.md

| Symptom | Cause | Fix |
|---|---|---|
| `-32009` on every call | No `A2A-Version` header | Send `A2A-Version: 1.0` |
| `-32601` with `message/send` | A 0.3 method name | Send `SendMessage` |
| `-32004` on a finished task | The task is terminal | Start a task with `referenceTaskIds` in the same context |
| `-32003` on a push config call | The card has no `pushNotifications` flag | Read the card before the call |
| `-32602` with a `BadRequest` detail | `message.messageId` is missing | Mint a `messageId` for every message |
| `-32001` or HTTP 404 | The id is unknown, purged, or hidden | Check the id, then stop |

## Questions and answers
type: qa
from: manuals/a2a-101/sections/4-1-send-message.md, manuals/a2a-101/sections/3-1-message.md, manuals/a2a-101/sections/3-3-artifact-and-chunks.md, manuals/a2a-101/sections/6-1-security-schemes-and-in-task-authorization.md

- **Why does a send wait?** The default `returnImmediately` is false. The call holds until a terminal or interrupted state.
- **Where is the result?** In `artifacts`. A message should not carry a task's output.
- **Why answer `TaskNotFoundError` for another caller's task?** The spec forbids revealing that a resource exists.

## Tips
type: tips
from: manuals/a2a-101/sections/3-1-message.md, manuals/a2a-101/sections/3-2-part.md, manuals/a2a-101/sections/4-3-get-task-and-list-tasks.md, manuals/a2a-101/sections/2-2-discovery-and-supported-interfaces.md

- Mint a new `messageId` for each new message. Reuse it only to retry.
- Send `ROLE_USER` from the client and `ROLE_AGENT` from the server.
- Send `historyLength` 0 for a status check.
- Read the card and check its capability flags before an optional call.
