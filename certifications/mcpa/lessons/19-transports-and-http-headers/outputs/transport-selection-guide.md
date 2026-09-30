# Transport Selection Guide

A one-page reference for the MCPA "Interactions and Execution" and "Architecture and Components" domains, aligned to MCP 2026-07-28.

## Choosing a transport

| Situation | Use | Why |
|---|---|---|
| A client launches and owns the server's lifecycle (a local tool, an IDE extension) | stdio | Simplest framing, no network surface, credentials read from the environment |
| A server is reachable over the network by many clients | Streamable HTTP | One endpoint, independent POSTs, works behind load balancers and gateways |
| A reliable byte stream that is neither a subprocess nor HTTP (a Unix socket, a TCP connection) | Reuse stdio framing | The stdio binding is already newline-delimited JSON-RPC over a stream; only launch, `stderr`, and shutdown are subprocess-specific |
| An older client or server that predates 2026-07-28 | Detect the era first (lesson 05), then fall back | Never assume; probe and cache the decision per server process or origin |

## stdio at a glance

- Newline-delimited JSON-RPC, one message per line, no embedded newlines.
- `stdout` carries only MCP messages; the server never writes a request there.
- `stderr` is for logs of any severity; a client must not treat it as an error signal by itself.
- No header layer at all: version, capabilities, and identity live only in `_meta`.
- Cancel with `notifications/cancelled`; shut down by closing `stdin`, then escalate if needed.
- On unexpected exit: restart, lose in-flight requests, re-send `subscriptions/listen`.

## Streamable HTTP required headers

| Header | Source field | Required for | On mismatch |
|---|---|---|---|
| `MCP-Protocol-Version` | `params._meta["io.modelcontextprotocol/protocolVersion"]` | Every POST | `400` + `-32020` |
| `Mcp-Method` | `method` | Every request | `400` + `-32020` |
| `Mcp-Name` | `params.name`, or `params.uri` for `resources/read` | `tools/call`, `resources/read`, `prompts/get` | `400` + `-32020` |
| `Mcp-Param-{Name}` | A tool argument marked `x-mcp-header` in its schema | Only tools that declare it | `400` + `-32020` |

Header names are case-insensitive; header values, including method and tool names, are case-sensitive.

## Base64 sentinel encoding

Applies to `Mcp-Name` and any `Mcp-Param-{Name}` value. Encode as `=?base64?{Base64EncodedValue}?=` whenever the value:

- contains a character outside visible ASCII, space, and horizontal tab,
- has leading or trailing whitespace, or
- already matches the sentinel pattern itself, to avoid ambiguity.

Otherwise, send the value unchanged. A server decodes the sentinel before comparing a header to the body.

## HTTP status codes that are not JSON-RPC errors

| Situation | Status | JSON-RPC body |
|---|---|---|
| GET or DELETE to the MCP endpoint | `405` | None required |
| `Origin` header present and not allowed | `403` | None required |
| Accepted notification POST | `202` | None; a notification never gets a JSON-RPC reply |
| Header disagrees with the body | `400` | `-32020` `HeaderMismatch` |
| Unsupported protocol version | `400` | `-32022` `UnsupportedProtocolVersionError` |
| Unknown method | `404` | `-32601` `Method not found` |

## What 2026-07-28 removed from Streamable HTTP

- The standalone GET stream and its `endpoint` event.
- `Mcp-Session-Id` and session-scoped state; every request is self-describing.
- HTTP DELETE for ending a session.
- Stream resumption via `Last-Event-ID`; a broken stream loses that request, reissued with a new id if safe.

## Remember for the exam

- The body is always the source of truth; headers exist for routing, never as a second authority.
- A `403` for a bad Origin, a `405` for GET or DELETE, and a `202` for an accepted notification are HTTP-level outcomes, not JSON-RPC results or errors.
- `-32020` is `HeaderMismatch`; it is unrelated to `-32021` (missing capability) and `-32022` (unsupported version).
- Custom transports over a byte stream reuse stdio framing rather than inventing a new one.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 9.
