---
name: mcp-reliability-reviewer
description: Review MCP cancellation races, deadlines, retries, idempotency, SSE flow control, and reconnect behavior.
version: 1.0.0
phase: 13
lesson: 29
tags: [mcp, reliability, cancellation, idempotency, sse, backpressure]
---

Review one MCP operation from request start through failure recovery.

Ask for these inputs if they are absent:

1. Transport: stdio or Streamable HTTP.
2. Operation semantics and side effects.
3. Idle and absolute maximum timeouts.
4. Progress-token behavior and rate limits.
5. Retry policy and business idempotency storage.
6. SSE buffer, proxy, keepalive, and reconnect settings.
7. Durable Task behavior, if the operation uses the Tasks extension.

Produce the following sections.

## Cancellation wire

- For stdio, require a client-sent `notifications/cancelled` notification that references an active request id.
- For Streamable HTTP, require closure of that request's response stream. Reject an ordinary cancellation POST.
- Require no JSON-RPC response to a cancellation notification.
- Reserve server-sent `notifications/cancelled` for stdio `subscriptions/listen` teardown.
- State what happens when cancellation is unknown, malformed, late, or impossible.

## Race table

Give deterministic outcomes for:

| Event order | Server terminal state | Final response | Client behavior |
|------------|-----------------------|----------------|-----------------|
| Cancel then complete | Cancelled | Suppressed | Continue recovery |
| Complete then cancel | Completed | Preserved | Ignore late cancellation |
| Timeout then late response | Transport-dependent cancellation | Ignore or suppress by observed order | Reconcile before unsafe retry |
| Disconnect during progress | Cancelled in-flight request | No resumable stream | Reconnect and refetch |

## Deadline policy

Require both an idle timeout and an absolute maximum timeout. Progress may reset idle time only when it is valid, monotonic, and rate-limited. Keepalive comments do not count as semantic progress. The maximum timeout never resets.

## Retry classification

Return one class per operation:

- `SAFE`: application contract proves no side effect.
- `CONDITIONAL`: mutation has one durable idempotency key reused with identical arguments.
- `UNSAFE`: mutation lacks authoritative deduplication.

Never treat a new JSON-RPC id, a tool annotation, or a transport reconnect as business idempotency.

For conditional retries, require a stored argument fingerprint and committed result. Reject one key reused with changed arguments.

Require one atomic, durable ledger boundary for the key claim, argument
fingerprint, business effect record, and committed result. A process-local
dictionary or lock is not durable and does not coordinate replicas. Accept a
shared database transaction, transactional outbox, or upstream provider that
enforces the same key. State which effect is actually inside that boundary.

Return a defensive copy of a committed result. Never expose a mutable object
held by the ledger. Prove both properties with a concurrent same-key fixture,
a reopen fixture, and a mutation-alias fixture.

## Flow control

- Set an explicit per-stream or per-client capacity.
- Coalesce replaceable progress.
- Mark dropped progress as requiring authoritative refetch.
- Preserve final JSON-RPC responses.
- Set `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `X-Accel-Buffering: no` for SSE.
- Define keepalive cadence separately from operation progress.
- Reject an unbounded queue.

## Reconnect plan

- Open a new request with a new id.
- Restore subscription filters.
- Do not use `Last-Event-ID` for MCP 2026-07-28.
- Refetch affected resources, lists, prompts, or Tasks.
- Do not replay unsafe mutations automatically.
- Use capped exponential backoff with jitter.

## Durable Tasks

When a Task exists, keep `tasks/cancel` separate from request cancellation. A complete acknowledgement proves only that cancellation intent was accepted. Poll or listen until the durable task reaches a terminal state.

## Required fixtures

Return at least these executable scenarios:

1. stdio cancel before completion;
2. stdio completion before late cancellation;
3. HTTP stream closure before completion;
4. progress resetting idle timeout while maximum timeout still fires;
5. duplicate mutation with two JSON-RPC ids and no idempotency key;
6. duplicate mutation with one key and identical arguments;
7. key reuse with changed arguments;
8. slow consumer exceeding the progress buffer;
9. stream drop followed by new subscription and authoritative refetch;
10. `tasks/cancel` acknowledgement followed by delayed worker cancellation.
11. two independent ledger connections racing on one key and identical arguments;
12. caller mutation of a returned result followed by a clean replay from the durable record.

Refuse a production-ready verdict when retry policy is described only as
"retry on timeout", the ledger is process-local, the external effect sits
outside the claimed atomic boundary without an outbox or upstream key, returned
records alias mutable storage, or queue capacity is unspecified.
