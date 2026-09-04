# MCP Tasks Extension: Durable Work on a Stateless Core

> Stateless MCP does not mean every operation must finish in one request. The official Tasks extension gives long-running work an explicit durable handle. A server can return that handle from `tools/call`, any instance can answer `tasks/get`, and client input arrives through `tasks/update` without reviving protocol sessions.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13 · 09 (transports), Phase 13 · 11 (stateless MRTR), Phase 13 · 12 (elicitation)
**Time:** ~90 minutes

## Learning Objectives

- Distinguish stateless protocol transport from durable application task state.
- Negotiate the `io.modelcontextprotocol/tasks` extension in per-request capabilities and `server/discover`.
- Return a server-directed `CreateTaskResult` with `resultType: "task"` only after durable creation.
- Poll with `tasks/get`, fulfill task input with `tasks/update`, and request cooperative cancellation with `tasks/cancel`.
- Remove the older `tasks/status`, `tasks/result`, and `tasks/list` assumptions.
- Subscribe to optional task notifications through `subscriptions/listen` on a POST response SSE stream.
- Model task expiry, restart recovery, input-key deduplication, and execution errors correctly.

## Why Tasks Are an Extension

Tasks first appeared as an experimental core feature in 2025-11-25. The July 2026 redesign moves them into the official `io.modelcontextprotocol/tasks` extension so clients and servers can opt into the extra lifecycle without expanding the core protocol for everyone.

The extension specification remains a draft surface even though it is the current official home for Tasks. Pin the extension version supported by your SDK, run conformance scenarios, and isolate wire adapters from your worker and storage domain.

Use a task when the operation has one or more of these properties:

- It may outlive an ordinary request timeout.
- A worker queue or external job system already owns execution.
- The client needs to recover after its own restart.
- The operation pauses for user or model input during execution.
- Cancellation and durable result retrieval are product requirements.

Do not create a task for a cheap deterministic lookup. A handle, persistence, polling, expiry, and cancellation are real complexity.

## Stateless Core, Stateful Application

MCP 2026-07-28 removes `initialize`, `notifications/initialized`, protocol sessions, and `Mcp-Session-Id`. That does not prohibit stateful products.

A task id is explicit application state:

- The server persists it before returning it.
- The client can store it and poll again after restart.
- The id can route to any replica backed by the same durable store.
- Authorization is checked on every task method.
- Expiry and deletion are defined by task fields, not a transport lifetime.

This is operationally different from hidden state attached to a connection.

Keep four lifetimes separate:

| State | Lifetime | Where it belongs |
|---|---|---|
| Protocol metadata | One request | `params._meta`, validated again on every call |
| Transport work | One stdio request or HTTP response | In-flight coordinator with a bounded deadline |
| MRTR continuation | One retry sequence | Integrity-protected `requestState`, plus replay controls when needed |
| Durable task | Across requests, replicas, restarts, and reconnects | Shared application store keyed by an authorized `taskId` |

Moving a task record into process memory does not make MCP stateful. It makes the application unreliable. The protocol stays stateless, but a later `tasks/get` routed to another replica cannot recover the record. Persist before returning the handle, then make every task method resolve the same shared record under tenant and principal checks.

## Capability Negotiation

The client advertises support on every eligible request:

```json
{
  "_meta": {
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": {
      "extensions": {
        "io.modelcontextprotocol/tasks": {}
      }
    },
    "io.modelcontextprotocol/clientInfo": {
      "name": "lesson-client",
      "version": "1.0.0"
    }
  }
}
```

The server returns exact `supportedVersions`, capabilities, `ttlMs`, and `cacheScope` from `server/discover`, with the same extension under capabilities. Because it advertises tools, it also implements mandatory `tools/list`. That result returns a deterministic `generate_report` descriptor, valid object `inputSchema`, `resultType: "complete"`, server identity metadata, and public cache hints.

A task method from a client that did not declare the extension returns `-32021`, Missing Required Client Capability, with `data.requiredCapabilities` set to `{"extensions":{"io.modelcontextprotocol/tasks":{}}}`. An unsupported protocol string returns `-32022` with exact `supported` and `requested` data; a missing or non-string version returns `-32602`.

An envelope without a JSON-RPC `id` is a notification. The receiver may process it, but it emits no JSON-RPC result or error. A Streamable HTTP adapter returns `202 Accepted` with no body for an accepted notification.

At present, only `tools/call` supports task-augmented execution. Design your internal abstraction so future request types do not require rewriting storage.

## Server-Directed Task Creation

The old client flag `params._meta.task.required` is gone. The client declares extension support, then the server decides whether a particular `tools/call` becomes a task.

Request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "generate_report",
    "arguments": {"size": "large"},
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "resultType": "task",
    "taskId": "tsk_786512e29e0d",
    "status": "working",
    "statusMessage": "Preparing report outline.",
    "createdAt": "2026-08-21T10:30:00Z",
    "lastUpdatedAt": "2026-08-21T10:30:00Z",
    "ttlMs": 900000,
    "pollIntervalMs": 1000
  }
}
```

The server must not return this handle until a `tasks/get` for the id can resolve. In an eventually consistent store, wait for read visibility before answering. Otherwise a client can receive a valid-looking id and immediately get "not found."

A task response is unsolicited in the sense that the client does not request task mode. It is not unnegotiated: the current request still must advertise the extension.

## The Task Shape

Every task carries:

- `taskId`: stable server-generated identifier;
- `status`: `working`, `input_required`, `completed`, `cancelled`, or `failed`;
- `createdAt` and `lastUpdatedAt`: ISO 8601 timestamps;
- `ttlMs`: expiry duration from creation, or `null` for no advertised limit;
- optional `pollIntervalMs`: the server's current minimum suggested polling cadence;
- optional `statusMessage`: user-facing or model-facing context.

Status-specific fields appear only when relevant:

- `input_required` includes `inputRequests`.
- `completed` includes the original request's `result` shape.
- `failed` includes a JSON-RPC `error` object.

The client should honor `pollIntervalMs`. A server may rate-limit more aggressive polling and may change the interval over the task lifetime.

## Poll with `tasks/get`

The client asks for a current snapshot:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/get
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tasks/get",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

`tasks/get` itself completed, so its result always has `resultType: "complete"`. The nested task can still have `status: "working"` or `status: "input_required"`.

This distinction prevents a common parser bug:

```text
result.resultType = complete    means the tasks/get RPC finished
result.status = working        means the represented job is still running
```

There is no `tasks/result` call. When the task completes, the next `tasks/get` response inlines the original `CallToolResult` under `result`:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "completed",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:34:12Z",
  "ttlMs": 900000,
  "result": {
    "resultType": "complete",
    "content": [
      {"type": "text", "text": "Generated large report with approved outline."}
    ],
    "structuredContent": {"size": "large", "approved": true},
    "isError": false,
    "_meta": {
      "io.modelcontextprotocol/serverInfo": {
        "name": "tasks-demo",
        "version": "1.0.0"
      }
    }
  },
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "tasks-demo",
      "version": "1.0.0"
    }
  }
}
```

The outer `resultType` says the `tasks/get` RPC completed. The nested `result.resultType` says the original tool call completed. That nested discriminator is required. The nested `CallToolResult` SHOULD also carry its own `io.modelcontextprotocol/serverInfo`; this lesson includes it instead of storing an untyped payload.

There is no `tasks/list`. Sessionless servers cannot safely infer which tasks belong in a connection-scoped list. Applications that need history should expose an authorized domain tool with explicit filters and ownership rules.

## Input During Task Execution

Task input and core MRTR look similar but use different continuations.

### Input needed before task creation

Return core `resultType: "input_required"` from the original `tools/call`. The client fulfills it and retries that original call. Only create the task after those synchronous MRTR rounds finish.

### Input needed after task creation

Set the task to `input_required`. `tasks/get` exposes the outstanding `inputRequests`, and the client sends responses through `tasks/update`. The client does not retry the original `tools/call`.

Snapshot:

```json
{
  "resultType": "complete",
  "taskId": "tsk_786512e29e0d",
  "status": "input_required",
  "createdAt": "2026-08-21T10:30:00Z",
  "lastUpdatedAt": "2026-08-21T10:31:00Z",
  "ttlMs": 900000,
  "inputRequests": {
    "approve_outline": {
      "method": "elicitation/create",
      "params": {
        "mode": "form",
        "message": "Approve the generated report outline?",
        "requestedSchema": {
          "type": "object",
          "properties": {"approved": {"type": "boolean"}},
          "required": ["approved"]
        }
      }
    }
  }
}
```

Update:

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/update
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tasks/update",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "inputResponses": {
      "approve_outline": {
        "action": "accept",
        "content": {"approved": true}
      }
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

The success response is an empty acknowledgement plus `resultType: "complete"`. The state change may be eventually consistent, so the client continues polling or listening.

Each `inputRequests` key must be unique for the entire task lifetime. Repeated `tasks/get` snapshots may show the same outstanding key; clients deduplicate the UI and servers ignore responses for unknown, superseded, or already fulfilled keys. A partial update can leave the task in `input_required` until all required keys are answered.

## Cancellation Is Cooperative

`tasks/cancel` signals intent and returns an empty complete acknowledgement. That acknowledgement does not guarantee the worker stopped. Work may finish first, ignore cancellation, or transition later.

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tasks/cancel
Mcp-Name: tsk_786512e29e0d
```

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tasks/cancel",
  "params": {
    "taskId": "tsk_786512e29e0d",
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {
        "extensions": {
          "io.modelcontextprotocol/tasks": {}
        }
      }
    }
  }
}
```

For all three task methods, `Mcp-Name` mirrors `params.taskId`. It does not repeat the JSON-RPC method name. `code/main.py` centralizes this rule in `make_http_request`.

The lesson worker honors cancellation immediately, making repeated calls idempotent. A production client must still treat cancellation as cooperative rather than infer a final task status from the acknowledgement.

Do not use `notifications/cancelled` to cancel a task. That notification belongs to request cancellation, not durable Tasks.

The distinction matters at the routing boundary. Request cancellation targets one in-flight JSON-RPC operation or its request-scoped HTTP response. If `tools/call` has already returned `resultType: "task"`, that request is complete and closing its transport cannot name or stop the durable job. `tasks/cancel` is a new authorized RPC. It carries `params.taskId`, mirrors that id in `Mcp-Name`, resolves the task's owning backend, records cooperative cancellation intent, and returns an acknowledgement without claiming the worker has stopped.

A gateway must therefore keep request coordinators and task routes in different tables. The request table can disappear when the response finishes. The task route must survive until terminal state and retention expiry. [Lesson 29: MCP Reliability, Cancellation, and Flow Control](../../29-mcp-reliability-cancellation-and-flow-control/docs/en.md) builds the race, timeout, idempotency, backpressure, and retry rules for both paths.

## Optional Notifications

Polling is the baseline. A client that wants push updates sends `subscriptions/listen` with task ids. For Streamable HTTP, this is a POST whose response is a request-scoped SSE stream. There is no standalone GET event stream and no protocol session to keep alive.

The server acknowledges the accepted ids with `notifications/subscriptions/acknowledged` and can then send full snapshots through `notifications/tasks`. The acknowledgement and every task notification carry `io.modelcontextprotocol/subscriptionId` in `_meta`, equal to the `subscriptions/listen` request id. Each task notification is otherwise equivalent to what `tasks/get` would return at that moment.

Clients must still declare the Tasks extension. They should reconnect and resume from durable task ids rather than depend on event replay or `Last-Event-ID`.

## Failure Semantics

Use the two error layers correctly.

### Protocol error

Invalid method parameters or an unknown task id return a JSON-RPC error, commonly `-32602`. Missing extension support returns `-32021` with the required capability object.

### Task execution outcome

- A normal tool result with `isError: true` is still a `completed` task because the tool call produced its defined result.
- A JSON-RPC error during deferred execution makes the task `failed` and stores that JSON-RPC error under `error`.
- User refusal can produce `cancelled`, a completed refusal result, or another domain-specific safe outcome. Document the choice.

## Durability, Expiry, and Ownership

Persist at least the task id, status, timestamps, ttl, poll interval, original operation ownership, result or error, outstanding input requests, and all issued input keys.

The storage key must include or resolve an authoritative tenant and principal. Knowing a task id must not grant access. Check ownership on every `tasks/get`, `tasks/update`, `tasks/cancel`, and subscription.

`ttlMs` is measured from creation and may change. A client can treat it as a backstop when a task has stopped producing observable updates. A server may fail and later delete an expired task. Do not describe it as a promise to retain a completed result for that many milliseconds after completion.

Use atomic writes or transactions. The lesson writes a temporary file and atomically renames it. A multi-replica service should use a shared durable store and a worker lease or equivalent concurrency control.

```figure
tp-task-lifecycle
```

## Build It

`code/main.py` implements a deterministic task service:

- `server/discover` returns `supportedVersions`, cache hints, and the Tasks extension.
- `tools/list` returns a deterministic, cacheable `generate_report` descriptor with a valid input schema.
- `tools/call` creates and persists the task before returning `resultType: "task"`.
- A new service instance reloads the same task, demonstrating restart recovery.
- `tasks/get` returns complete task snapshots.
- The worker moves from `working` to `input_required`.
- `tasks/update` accepts a form response and returns an empty complete acknowledgement.
- The worker stores a nested `CallToolResult` with its own `resultType` and server identity, then transitions to `completed`.
- `tasks/cancel` is idempotent in this implementation.
- The HTTP builder sets `Mcp-Name` to `params.taskId` for `tasks/get`, `tasks/update`, and `tasks/cancel`.
- Notification helpers use `notifications/subscriptions/acknowledged` and `notifications/tasks`, both tagged with the listen request id.
- Id-less notifications produce no JSON-RPC response.

The worker advances explicitly instead of sleeping in a background thread. That makes every state transition deterministic and keeps the protocol example separate from queue mechanics.

## Use It

From the repository root:

```bash
cd phases/13-tools-and-protocols/13-mcp-async-tasks/code
python3 main.py
python3 -m unittest discover tests -v
```

Expected result sequence:

```text
id=0 resultType=complete status=ack
id=1 resultType=task status=working
id=2 resultType=complete status=working
id=3 resultType=complete status=input_required
id=4 resultType=complete status=ack
id=5 resultType=complete status=completed
```

Also verify that `tasks/status`, `tasks/result`, and `tasks/list` return method-not-found in the modern service.
Verify that `tools/list` is deterministic and every current HTTP task method mirrors its task id through `Mcp-Name`.

## Ship It

`outputs/skill-task-store-designer.md` now produces an extension-aware design: capability negotiation, durable-before-return creation, current methods, input update flow, ownership, expiry, cancellation, subscription, and migration from the removed experimental methods.

## Exercises

1. Add a second outstanding input key. Send a partial `tasks/update` and prove the task remains `input_required` until both keys are answered.
2. Add tenant ownership to the store and reject a valid task id presented by the wrong authenticated principal.
3. Add a worker lease with expiry. Demonstrate that two service instances cannot complete the same task concurrently.
4. Implement a POST-response SSE adapter for `subscriptions/listen`. Do not add GET, `Last-Event-ID`, or a session header.
5. Add expiry cleanup. Distinguish an expired task from a malformed task id without leaking cross-tenant existence.

## Key Terms

| Term | Meaning in the current extension |
|------|----------------------------------|
| Tasks extension | Optional `io.modelcontextprotocol/tasks` capability for durable async work |
| `CreateTaskResult` | Server-directed `resultType: "task"` response to an eligible request |
| `tasks/get` | Poll a full current task snapshot, including terminal result or pending input |
| `tasks/update` | Submit responses to a task's outstanding `inputRequests` |
| `tasks/cancel` | Acknowledge cooperative cancellation intent |
| `input_required` | Task status indicating client input is outstanding |
| `pollIntervalMs` | Server-suggested minimum delay before another poll |
| `ttlMs` | Expiry duration measured from task creation |
| Durable-before-return | Rule that the task id must resolve before its handle is sent |
| `notifications/tasks` | Optional full task snapshot delivered on a subscribed SSE response |

## Legacy Compatibility

The 2025-11-25 experimental surface used client-requested task augmentation, `tasks/status`, `tasks/result`, and optional `tasks/list`. Keep those names only inside a pinned legacy adapter. A current client uses the extension capability, accepts server-directed handles, polls `tasks/get`, supplies input with `tasks/update`, and reads the final result from the task snapshot.

## Further Reading

- [Official MCP Tasks extension](https://tasks.extensions.modelcontextprotocol.io/specification/draft/tasks)
- [MCP 2026-07-28 Multi Round-Trip Requests](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [MCP 2026-07-28 Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
