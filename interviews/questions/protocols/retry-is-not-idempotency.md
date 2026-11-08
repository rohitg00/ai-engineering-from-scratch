---
id: retry-is-not-idempotency
title: The charge that ran twice after a timeout
card: protocols
kind: design
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer, ai-evaluation-reliability-engineer]
rounds: [system-design, debugging]
tags: [mcp, idempotency, retry, cancellation, timeout, backpressure]
minutes: 12
lessons: [phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control]
manuals: []
practice: []
cheatsheet: [mcp-gateways-operations]
related: [protocols/cancel-signal-per-transport, protocols/draft-lost-across-replicas]
updated: 2026-11-03
---

Over Streamable HTTP, a client calls `charge_account`. A reverse proxy buffers the response stream, the client reaches its timeout and disconnects, and the server commits the charge a moment later. The client sends the call again with a fresh JSON-RPC id, and the customer is charged twice. The team proposes to deduplicate on the JSON-RPC id. Design the fix.

## Short answer

A JSON-RPC id correlates one message and never identifies a business operation, so two ids are two charges to the server. Add an application idempotency key to the arguments, and make the server store the key, a fingerprint of the arguments and the committed result in one atomic durable transaction. The same key with the same arguments returns the stored result, and the same key with different arguments is rejected.

## Full answer

### The key, not the id

```json
{
  "name": "charge_account",
  "arguments": {"account": "acct-7", "cents": 1200, "idempotencyKey": "checkout-7"}
}
```

The lesson shows the two-id case: a charge with id `41` loses its response, the retry carries id `42`, and the server sees two different messages. Without an application key it cannot know they are one checkout.

### The ledger boundary must be atomic and durable

This sequence is unsafe:

```text
check key
run mutation
store result
```

Two workers can both observe a missing key and both run the mutation. A crash after the effect and before the store creates the same ambiguity on retry. The lesson uses a file-backed SQLite ledger with `BEGIN IMMEDIATE`, so the key check, the business effect, the execution counter and the stored result commit as one unit, and two connections racing on one key produce one execution. Return defensive copies of stored results so that a caller's mutation cannot corrupt a later replay.

A local table does not make a real payment atomic. Production needs a shared durable transaction, a transactional outbox, or an upstream provider that enforces the same key. A process lock protects neither replicas nor restarts.

### Classify every mutation before you retry

| Class | Example | Rule |
|---|---|---|
| safe | a deterministic read | retry with a new id once the failure boundary is understood |
| conditional | a mutation with a durable key | retry with the same key and identical arguments |
| unsafe | a mutation with no deduplication | do not retry automatically; reconcile first |

`idempotentHint` and `readOnlyHint` are untrusted hints. The application contract and the server implementation decide.

### Fix the timeout too

Use two clocks: an idle timeout that progress may reset, and a maximum timeout from request start that nothing resets. In the lesson's example, progress at `400`, `800` and `1200` ms keeps a `500` ms idle clock alive, and the `2000` ms maximum still cancels the request. For the buffering proxy, send `Content-Type: text/event-stream`, `Cache-Control: no-cache` and `X-Accel-Buffering: no`, and emit SSE comment keepalives on quiet streams. A keepalive is not progress and must not reset the idle clock.

### The race the fix must respect

Cancellation and completion race. If cancellation wins, the server suppresses the response. If completion wins, the client ignores the late cancellation and the server ignores the late notification. On HTTP the cancellation signal is closing the request's response stream, so the disconnect in the scenario was a cancellation the server observed too late to stop the commit. The key makes that harmless.

## Follow-ups

- **Level 3:** The same key arrives with a different `cents` value. What happens? Expected: the server compares the argument fingerprint and rejects the call, because one key must not alias two business intents.
- **Level 3:** Two workers see the key missing at the same instant. What prevents two charges? Expected: the key claim, the effect and the result commit in one atomic durable transaction; a check-then-write sequence cannot.
- **Level 4:** The charge is executed by an external payment provider. Does the local ledger make it atomic? Expected: no; either the provider accepts the same idempotency key, or a transactional outbox bridges the local commit to the remote effect.
- **Level 4:** The client reconnects a dropped `subscriptions/listen` stream. Does it resend the lost charge? Expected: no; it opens a new listen request, refetches authoritative state, deduplicates by stable identifiers, and never replays an unsafe mutation because a response was lost.

## Wrong answers

- "Deduplicate on the JSON-RPC id." Ids correlate messages, and a retry carries a new id by design.
- "Set `idempotentHint` and let clients retry freely." Annotations are untrusted hints. The application contract and the ledger decide retry safety.
- "Check the key, run the charge, then store the result." Two workers can both miss the key, and a crash between the effect and the store leaves the retry ambiguous.

## Taught in

The [reliability lesson](../../../phases/13-tools-and-protocols/29-mcp-reliability-cancellation-and-flow-control/) builds the atomic ledger, the two clocks and the retry matrix.
