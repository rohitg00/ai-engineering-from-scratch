---
id: draft-lost-across-replicas
title: The draft that vanished on the second replica
card: protocols
kind: debug
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [debugging, system-design]
tags: [mcp, stateless, replicas, state-handle, load-balancer]
minutes: 10
lessons: [phases/13-tools-and-protocols/09-mcp-transports, phases/19-capstone-projects/13-mcp-server-with-registry]
manuals: []
practice: []
cheatsheet: [mcp-server-build]
related: [protocols/post-only-streamable-http, protocols/stateless-request-metadata]
updated: 2026-11-03
---

A document MCP server runs as two replicas behind a load balancer. Its `draft_create` tool keeps the new draft in a dictionary inside the process and returns `{"ok": true}`. The next call, `draft_append`, fails about half the time with "no draft", and the failures stop when the operator turns on sticky routing. Explain the failure, say why the operator's fix is wrong, and redesign the two tools.

## Short answer

The first call created the draft in the memory of one replica and returned no name for it, because the design assumed the connection identifies the draft. The second call is a fresh POST that can land on the other replica, which has valid protocol metadata and no way to load the draft. Sticky routing hides the bug until a restart, a rollout or a failover moves the next request. Return a server-minted opaque handle from `draft_create`, keep the draft in a shared durable store, and make `draft_append` take the handle as an ordinary argument.

## Full answer

### The mechanical failure

1. Request A reaches replica one and creates a draft in that process.
2. The response returns no draft handle.
3. Request B is a new POST and reaches replica two.
4. Replica two cannot name or load the draft, so the call fails or reads the wrong local object.
5. Sticky routing appears to fix the symptom until the next request moves.

Half the appends fail because half the requests land on the other replica. Nothing in the current revision ties two requests together: there is no `Mcp-Session-Id`, and every request is independently interpretable.

### The correct boundary

Protocol context stays in each request. Durable application state lives in a shared store under a handle the server mints and returns to the client. The next call supplies the handle, any replica loads the same record, and authorization binds the record to the authenticated principal and tenant. Replica memory may cache the record. It cannot be the only copy that correctness needs.

### The redesigned pair

- `draft_create` returns `{"draftId": "<unguessable>"}` from a shared store, bound to the principal, with an expiry.
- `draft_append` takes `draftId` as an argument, authorizes the principal for that draft on every call, and applies concurrency control and idempotency for the append.

### Choose the mechanism by lifetime

| Lifetime | Mechanism |
|---|---|
| one call | request-local variables |
| a short MRTR continuation | integrity-protected `requestState` echoed by the client |
| a draft or durable task | an explicit handle plus shared persistence, expiry, concurrency control and idempotency |

None of these is an MCP protocol session.

### Prove it

Place two stateless replicas behind one balancer and send at least `100` concurrent requests. Route consecutive calls to alternating replicas and show that correctness does not depend on affinity. Replace hidden process memory with an explicit handle wherever the workflow needs persistence.

## Follow-ups

- **Level 3:** Where may replica memory still be used? Expected: as a cache of the stored record, never as the only copy required for correctness.
- **Level 3:** How do you test that the fix holds? Expected: alternate replicas for consecutive calls and run many concurrent requests; every append must find its draft without affinity.
- **Level 4:** What does the handle need beyond being random? Expected: binding to the authenticated principal and tenant, expiry, authorization on each use, and concurrency plus idempotency rules for appends.
- **Level 4:** Why not carry the draft in `requestState` instead of a store? Expected: `requestState` suits a short input-required continuation; a durable draft needs shared persistence, and a client-echoed value is not storage.

## Wrong answers

- "Sticky routing fixed it, so ship it." Affinity breaks on restart, rollout, reschedule or failover. Correctness must not depend on which replica answers.
- "Replicate the dictionary between the two processes." That hides protocol context in a store as a substitute for the removed session. The fix is an explicit handle and shared storage the client can name.
- "Use `Mcp-Session-Id` to find the draft." The current revision ignores that header and never mints it.

## Taught in

The [transports lesson](../../../phases/13-tools-and-protocols/09-mcp-transports/) traces the hidden-replica failure step by step, and the [capstone](../../../phases/19-capstone-projects/13-mcp-server-with-registry/) requires two replicas without affinity.
