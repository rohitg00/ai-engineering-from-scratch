# Long Running Work Patterns

A one-page decision reference for MCP 2026-07-28, aligned to the "Interactions and Execution" domain. Keep this next to a server's tool descriptions when a tool might not finish inside one request.

## Decide in this order

1. **Plain call.** The work is cheap and deterministic and finishes well inside a normal request timeout. Return `resultType: "complete"` directly. Most tools stop here.
2. **Multi Round-Trip Request (MRTR).** The server needs one short answer from the client, an elicitation, a sampling call, or a roots list, before it can finish this same request. Return `resultType: "input_required"` and let the client retry the original request with a new id, `inputResponses`, and the echoed `requestState`. The whole exchange still completes in a handful of round trips.
3. **A task.** The work itself may outlive a request timeout, may need input mid-execution rather than up front, benefits from surviving a client restart, or should support cooperative cancellation. Requires the client to have declared `io.modelcontextprotocol/tasks` on this request and the server to advertise it in `server/discover`.
4. **A server-minted handle.** The state is not about waiting for one operation to finish at all. It is cross-call application state, a cart, an open session, a transaction, that the model carries forward as an ordinary argument (the SEP-2567 pattern from lesson 04). A task's `taskId` is one instance of this general pattern, scoped specifically to polling one unit of deferred work.

## Capability negotiation checklist

- Client declares support in `io.modelcontextprotocol/clientCapabilities.extensions["io.modelcontextprotocol/tasks"]` on every request that might need it, not once for the whole session; there is no session to remember it in.
- Server declares the same extension in `server/discover` `capabilities.extensions`.
- A server MUST NOT return `CreateTaskResult` to a request that did not declare the extension. If it can still complete the work within that request it returns an ordinary result; only when it cannot service the request without a task does it return `-32021` (Missing Required Client Capability) with `data.requiredCapabilities`. `tasks/get`, `tasks/update`, and `tasks/cancel` from a client that did not declare the extension on that request also get `-32021`.
- The server decides per request whether to create a task. A client that declared the extension must handle either a normal result or `resultType: "task"` for the same tool.
- Only `tools/call` supports task augmentation in this revision.

## CreateTaskResult fields

| Field | Meaning |
|---|---|
| `resultType` | Always `"task"` on this result |
| `taskId` | Server-generated, unguessable, durable identifier |
| `status` | Usually `"working"` at creation |
| `createdAt`, `lastUpdatedAt` | ISO 8601 timestamps |
| `ttlMs` | Expiry duration from creation, or `null` for no advertised limit |
| `pollIntervalMs` | Suggested minimum delay before the next poll |
| `statusMessage` | Optional human or model facing context |

Durable before return: a server must not hand back a `taskId` until a `tasks/get` for it would already resolve.

## Polling and status rules

- `tasks/get` itself always completes, so its own `resultType` is `"complete"`. The nested `status` field, not the outer `resultType`, carries `working`, `input_required`, `completed`, `failed`, or `cancelled`.
- There is no `tasks/result`. A `completed` snapshot inlines the original result under `result`. A `failed` snapshot inlines the JSON-RPC error under `error`.
- There is no `tasks/list`. Statelessness removed the session a list could safely be scoped to; expose an authorized, filtered domain tool instead if history is a product requirement.
- A tool result with `isError: true` is still a `completed` task; `failed` is reserved for a JSON-RPC protocol error during execution.

## Mid-flight input versus MRTR

| | Before task creation | During task execution |
|---|---|---|
| Mechanism | Core MRTR on the original request | Task `input_required` plus `tasks/update` |
| Client action | Retry the original method with a new id, `inputResponses`, echoed `requestState` | Send `tasks/update` with `inputResponses`; do not retry `tools/call` |
| Where to see it | The `tools/call` response itself | The `tasks/get` response's `inputRequests` map |

`inputRequests` keys are unique for the life of the task. A server ignores `inputResponses` for unknown, already answered, or superseded keys. A client deduplicates repeated keys across polls before showing them again.

## Cancellation

- `tasks/cancel` is cooperative: it signals intent and returns an empty `resultType: "complete"` acknowledgement. It does not guarantee the work stopped, and the task may still reach a different terminal status.
- Never use `notifications/cancelled` for a task. That notification cancels one in-flight request; once a request has returned `resultType: "task"`, it has already completed, and only `tasks/cancel` can reach the durable job.

## What changed from the 2025-11-25 experimental feature

| 2025-11-25 (removed) | 2026-07-28 extension |
|---|---|
| Client generated `taskId` via a `_meta` task key | Server generated `taskId` returned in `CreateTaskResult` |
| `notifications/tasks/created` announced readiness | The result that creates the task already carries the handle |
| Blocking `tasks/result` call | Inlined into the same `tasks/get` response |
| Paginated `tasks/list` | Removed; no safe cross-caller scope without sessions |
| Initial `submitted` status | Tasks begin at `working` (or a later status if execution is immediate) |
| A `tasks` capability negotiated at connection setup | `io.modelcontextprotocol/tasks` declared per request, no connection setup exists |

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 4 and 14.
