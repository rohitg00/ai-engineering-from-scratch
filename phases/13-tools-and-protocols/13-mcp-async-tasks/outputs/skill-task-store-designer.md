---
name: task-store-designer
description: Design durable MCP work with the current Tasks extension, stateless requests, explicit ownership, polling, input updates, and cancellation.
version: 2.0.0
phase: 13
lesson: 13
tags: [mcp, tasks, extension, durable-state, stateless]
---

Design long-running MCP work against the `io.modelcontextprotocol/tasks` extension.

Produce:

1. Eligibility decision. Explain why the operation needs a task instead of a synchronous `tools/call`.
2. Capability contract. Show exact `supportedVersions`, capabilities, `ttlMs`, and `cacheScope` in `server/discover`, plus the Tasks extension in per-request client capabilities. If tools are advertised, include mandatory deterministic `tools/list` descriptors with a valid object `inputSchema`, server identity metadata, and cache hints. Use `-32021` with a `requiredCapabilities` object when the extension is absent, and `-32022` with exact `supported` and `requested` data for an unsupported version.
3. Creation transaction. Persist the task until `tasks/get` can resolve it, then return server-directed `resultType: "task"`.
4. State shape. Include `taskId`, `status`, `statusMessage`, ISO timestamps, `ttlMs`, `pollIntervalMs`, authoritative owner, original operation reference, result or error, outstanding input requests, and all issued input keys. A completed task's nested `CallToolResult` has required `resultType: "complete"` and SHOULD include its own `io.modelcontextprotocol/serverInfo` metadata.
5. Current methods. Define `tasks/get`, `tasks/update`, and `tasks/cancel`. For Streamable HTTP, each request sets `Mcp-Name` to `params.taskId`. Do not introduce `tasks/status`, `tasks/result`, or `tasks/list`.
6. Input continuation. Separate pre-creation MRTR from post-creation `tasks/get` plus `tasks/update`. Require lifetime-unique input keys and partial-response handling.
7. Durability plan. Choose atomic filesystem storage, a transactional database, or a shared queue and store. Include worker leasing and restart behavior.
8. Ownership policy. Authorize every task method and subscription by tenant and principal. Never treat task-id knowledge as permission.
9. Cancellation contract. State that acknowledgement is cooperative and may not lead to `cancelled`.
10. Notification option. Use `subscriptions/listen` on a POST response SSE stream and `notifications/tasks`, with polling as the baseline. Put `io.modelcontextprotocol/subscriptionId`, equal to the listen request id, in the acknowledgement and every task notification. An id-less notification receives no JSON-RPC response; an accepted HTTP notification receives `202` with no body.
11. Expiry policy. Interpret `ttlMs` from creation, define purge behavior, and avoid leaking whether another tenant's task exists.
12. Migration map. Replace client-requested task flags and the removed experimental methods with the current extension flow.

Hard rejects:

- Returning a task handle before durable read visibility.
- Returning `resultType: "task"` to a request that did not advertise the extension.
- Using `params._meta.task.required`, `tasks/status`, `tasks/result`, or `tasks/list` as the current API.
- Using `initialize`, `Mcp-Session-Id`, sticky routing, or hidden transport-session state as the task store.
- Treating `tasks/cancel` acknowledgement as proof that the worker stopped.
- Reusing an `inputRequests` key during one task lifetime.
- Returning a task to a caller that is not its authoritative owner.
- Implementing notification delivery through standalone GET, session SSE, or `Last-Event-ID` replay.

Refusal rules:

- Refuse a task for a fast deterministic lookup unless the caller gives a concrete durability requirement.
- Refuse an in-memory-only production store when work must survive process restart.
- Refuse an unbounded result payload; store large artifacts externally and return an authorized resource handle.
- Refuse a history endpoint without explicit tenant ownership, filtering, pagination, and retention policy.

Output a one-page design with a lifecycle table, wire methods, persistence transaction, ownership rules, input flow, polling cadence, cancellation semantics, subscription option, expiry cleanup, failure model, and legacy migration map.
