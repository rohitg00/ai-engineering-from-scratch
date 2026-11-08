---
id: post-only-streamable-http
title: Sticky sessions, GET streams and resume on the modern wire
card: protocols
kind: concept
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, ml-breadth]
tags: [mcp, streamable-http, transport, sse, subscriptions]
minutes: 9
lessons: [phases/13-tools-and-protocols/09-mcp-transports]
manuals: []
practice: []
cheatsheet: [mcp-client-transports]
related: [protocols/stateless-request-metadata, protocols/draft-lost-across-replicas]
updated: 2026-11-03
---

A platform team deploys an MCP server over Streamable HTTP behind a load balancer with two replicas. They configure sticky routing keyed on `Mcp-Session-Id`, keep a standalone `GET /mcp` stream for change notifications, and plan to resume a broken stream with `Last-Event-ID`. Which of these belong to the current revision, and what replaces the rest?

## Short answer

None of the three belongs to the current revision. The endpoint accepts POST only: `GET /mcp` and `DELETE /mcp` return `405`, `Mcp-Session-Id` is ignored and never minted, and `Last-Event-ID` is ignored because streams do not resume. Change notifications arrive on a client-opened `subscriptions/listen` POST whose response stays open as SSE, and a dropped stream is replaced by a new listen request and a refetch of the affected data.

## Full answer

### The modern wire in one table

| Message | HTTP shape |
|---|---|
| any JSON-RPC request | a new POST with one message in the body |
| the response | `application/json` with one response, or `text/event-stream` with related notifications and then the final response |
| an accepted notification | `202 Accepted` with no body |
| `GET` or `DELETE` on the endpoint | `405 Method Not Allowed` |

The client advertises both response types with `Accept: application/json, text/event-stream`.

### Why stickiness is not needed

Every request carries its protocol version and client capabilities in `params._meta`, so any healthy worker can validate it. Three headers mirror the body for routing and policy: `MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name` for `tools/call`, `resources/read` and `prompts/get`. The server compares each header with the body before it executes. A missing or mismatched header is HTTP `400` with JSON-RPC `-32020`.

### Where notifications come from

The client sends `subscriptions/listen` as a normal request with a `notifications` filter, for example `toolsListChanged: true` and a list of `resourceSubscriptions`. The first message on the stream is `notifications/subscriptions/acknowledged`. Every event and the final result carry `io.modelcontextprotocol/subscriptionId`, equal to the listen request id. When the stream drops, the client reissues the request with a new id and refetches tools, resources or prompts. `resources/subscribe` belongs to the legacy era.

### What a broken request-scoped stream means

The in-flight request is lost. The client may issue a new request with a new JSON-RPC id when a retry is safe. It must not attempt stream resumption, and the server must not add SSE ids for replay.

### Two more rules at the boundary

- Validate `Origin` with exact matching, and return `403` when it is present and not allowed. Local servers bind to `127.0.0.1`. This defends against DNS rebinding and is not authentication.
- Keep a legacy HTTP+SSE bridge, if you need one, on separate endpoints, and never describe its GET stream, session id or replay as part of the current revision.

## Follow-ups

- **Level 2:** How does a client cancel an in-flight request over this transport? Expected: it closes that request's response stream; there is no cancellation POST.
- **Level 3:** Why is a `startswith` test on the trusted origin unsafe? Expected: it accepts an attacker-controlled suffix on the host name; match the canonical origin exactly.
- **Level 3:** A dual-era client receives `405` from an unknown server. Does it fall back to the old GET endpoint? Expected: only after reading the body; a recognized modern JSON-RPC error proves the server is modern, and only an empty or unrecognized body justifies the legacy attempt.
- **Level 4:** A workflow needs state across two calls on two replicas. Where does it live? Expected: behind a server-minted opaque handle in a shared store, returned as an ordinary result, bound to the principal, expired, and authorized on each use.

## Wrong answers

- "Sticky routing is harmless, so keep it as a safety net." It hides a correctness bug until a rollout, a reschedule or a failover moves the next request to another replica.
- "Add SSE event ids so that clients can resume." Modern streams are not resumable. A lost request is retried with a new id when the operation allows it.
- "Origin validation authenticates the caller." It stops DNS rebinding only. A network service still authenticates and authorizes every request.

## Taught in

The [transports lesson](../../../phases/13-tools-and-protocols/09-mcp-transports/) defines the POST-only endpoint, the mirrored headers and the `subscriptions/listen` stream.
