---
id: stateless-request-metadata
title: Why every MCP request repeats its metadata
card: protocols
kind: concept
level: 2
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [ml-breadth, system-design]
tags: [mcp, stateless, json-rpc, discovery, protocol-version]
minutes: 8
lessons: [phases/13-tools-and-protocols/06-mcp-fundamentals, phases/13-tools-and-protocols/07-building-an-mcp-server]
manuals: []
practice: []
cheatsheet: [mcp, mcp-server-build]
related: [protocols/two-error-layers, protocols/post-only-streamable-http]
updated: 2026-11-03
---

A colleague ports an MCP server from the 2025 revision. The port keeps the `initialize` handshake and stores the client's declared capabilities on the connection object for later requests. All the old tests pass. What breaks under the current revision, and where does the metadata have to live instead?

## Short answer

The current revision has no handshake and no protocol session. A server that remembers capabilities from an earlier message can apply the wrong permissions or the wrong wire shape to the next request, which may come from another client on the same process or land on another worker. Every request carries `io.modelcontextprotocol/protocolVersion` and `io.modelcontextprotocol/clientCapabilities` in `params._meta`, and the server validates them on each request and forgets them after it answers.

## Full answer

### The request is the unit of interpretation

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/list",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {"name": "course-client", "version": "1.0.0"}
    }
  }
}
```

The version and the capabilities are required. `clientInfo` is recommended, self-reported, and never a credential. The server must not infer any of these from an earlier request, a stdio process, an HTTP connection or a transport header alone.

### What the server returns

Every successful result includes `resultType: "complete"` and should carry `io.modelcontextprotocol/serverInfo` in its `_meta`. The list results, `resources/read` and `server/discover` also carry `ttlMs` and `cacheScope`, with deterministic ordering so that equal results give stable cache keys.

### Discovery is a method, not a gate

Every server must implement `server/discover`. It returns `supportedVersions`, capabilities, optional instructions and server identity. A client may call it first, but it may also send `tools/list` at once, because that request already carries its metadata.

### The error codes that replace negotiation

| Case | Code |
|---|---|
| metadata missing or malformed | `-32602` |
| header disagrees with body at an HTTP boundary | `-32020` |
| version matched but unsupported | `-32022`, with `requested` and `supported` |

The client picks a mutually supported version from `supported` and retries with a new request id.

### Keep the eras apart

Revisions through `2025-11-25` use `initialize`, `notifications/initialized` and connection-scoped capabilities. A dual-era server may keep that path as an isolated legacy adapter that it selects only when it receives `initialize`. It never routes a current request through the handshake path and never stamps `resultType` onto legacy results.

### Application state is still allowed

A workflow or a draft can live behind an opaque handle in a shared store. The client sends the handle as an ordinary argument, and every replica authenticates and authorizes its use. Protocol context must not leak into that store as a substitute for the removed session.

## Follow-ups

- **Level 2:** Is `clientInfo` required, and can you authorize on it? Expected: it is recommended, not required; it is display and debugging data and never a credential.
- **Level 2:** A client sends `tools/list` without calling `server/discover`. Does the server reject it? Expected: no; the request carries its version and capabilities, so discovery is not a gate.
- **Level 3:** What does closing stdin or ending an HTTP response terminate? Expected: transport activity only; there is no protocol session to end, and the next request must still describe itself.
- **Level 4:** Where does a multi-step workflow keep its state now? Expected: behind a server-minted opaque handle in a shared durable store, returned as a normal result, bound to the authenticated principal, expired, and authorized on every use.

## Wrong answers

- "Stateless means the server cannot keep any state at all." Durable application state behind an explicit handle is allowed. Only hidden protocol context is removed.
- "Send `initialize` first to be safe with every server." A current server must not receive `initialize` by default. Legacy is a documented fallback for a pinned peer.
- "The connection identifies the client, so one capability check per connection is enough." Two clients can share one process or HTTP worker in sequence, and a remote request can land on any replica.

## Taught in

The [fundamentals lesson](../../../phases/13-tools-and-protocols/06-mcp-fundamentals/) traces one request from validation to a complete result, and the [server lesson](../../../phases/13-tools-and-protocols/07-building-an-mcp-server/) builds the dispatch loop.
