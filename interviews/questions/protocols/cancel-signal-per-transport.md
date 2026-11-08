---
id: cancel-signal-per-transport
title: Three cancellations that look like one
card: protocols
kind: concept
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [ml-depth, coding]
tags: [mcp, cancellation, stdio, streamable-http, tasks]
minutes: 8
lessons: [phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control]
manuals: []
practice: []
cheatsheet: [mcp-client-transports, mcp-tasks-elicitation-apps]
related: [protocols/retry-is-not-idempotency]
updated: 2026-11-03
---

A client library exposes one `cancel(request)` method that behaves the same on stdio and on Streamable HTTP: it writes or POSTs a `notifications/cancelled` notification for the request id. Over HTTP, servers keep running the work and sometimes send a response after the cancel. A second method, `cancelTask`, returns success, the UI shows "stopped", and the worker keeps going. What is wrong with both methods?

## Short answer

Cancellation is transport-specific, and a durable task is a third thing. On stdio the client sends `notifications/cancelled` with the request id and receives no response. On Streamable HTTP the signal is closing that request's response stream, and a POSTed cancellation notification is the wrong signal. `tasks/cancel` acknowledges intent for a durable task that may stay `working` until a worker checkpoint observes the flag, so the UI must poll until a terminal status.

## Full answer

### Three mechanisms

| Mechanism | Target | Signal | What success means |
|---|---|---|---|
| request cancellation on stdio | one in-flight RPC | `notifications/cancelled` | the client abandoned the request; the server should stop if practical |
| request cancellation on HTTP | one in-flight response stream | close the stream | the same |
| `tasks/cancel` | one durable Task | an ordinary MCP request | the server acknowledged the intent |

The intent is the same on both transports: the client no longer needs the result. The wire signal differs because stdio shares one channel for everything, while each HTTP request owns its own response or SSE stream.

### Cancellation is a race

Two orders are both valid. If the cancellation arrives first, the server marks the request cancelled and suppresses the response when the worker finishes. If the worker commits first, the server sends the response and ignores the late notification, and the client ignores a late response for a request it abandoned. Neither side can prove which event the other saw first. Malformed, unknown and already-completed cancellations are ignored, because turning those races into errors would create more races.

### What a server may send

A server does not use `notifications/cancelled` to cancel arbitrary client calls. On stdio, server-sent cancellation is reserved for terminating a `subscriptions/listen` request. Progress notifications must increase and stop after completion or cancellation.

### Why the task outlives the connection

The reason to create a Task is that its lifecycle outlives one request and one connection. Do not erase task state when the HTTP connection closes, and do not treat a `tasks/cancel` result as proof the worker stopped. Poll the Task until a terminal status.

### Two timeouts, not one

A cancel often comes from a timeout. Use an idle timeout that progress may reset and a maximum timeout from request start that nothing resets. A keepalive comment on the stream is not progress.

## Follow-ups

- **Level 2:** The server receives a cancellation for a request that already finished. Does it return an error? Expected: no, it ignores the notification; a notification receives no response in any case.
- **Level 3:** The worker commits a mutation just before the cancel reaches the server. What does each side do? Expected: the server has sent the response and ignores the late notification; the client ignores the late response, and the idempotency contract decides whether a retry is safe.
- **Level 3:** When may a server itself send `notifications/cancelled`? Expected: on stdio only, to terminate a `subscriptions/listen` request; never for ordinary client calls.
- **Level 4:** A `subscriptions/listen` stream drops mid-task. Does the Task behind it change state? Expected: no; the client opens a new listen request with a new id and refetches the Task, and durable state is untouched by the dropped stream.

## Wrong answers

- "POST `notifications/cancelled` over HTTP too, for symmetry." Each HTTP request owns its response stream, and closing it is the signal that matches the request lifetime.
- "A successful `tasks/cancel` means the worker stopped." It acknowledges the request. The task can stay `working` until a checkpoint, and the work can finish first.
- "Return an error for a cancellation of an unknown request id." Unknown, malformed and completed cancellations are ignored by design.

## Taught in

The [reliability lesson](../../../phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/) gives the three mechanisms and both orders of the race.
