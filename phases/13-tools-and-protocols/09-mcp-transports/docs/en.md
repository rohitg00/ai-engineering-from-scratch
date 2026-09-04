# MCP Transports: stdio and Stateless Streamable HTTP

> Transport carries MCP messages. It does not supply missing protocol state. In `2026-07-28`, local stdio and remote Streamable HTTP both carry self-describing requests.

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 13, Lessons 07 and 08
**Time:** ~65 minutes

## Learning Objectives

- Choose stdio for local child processes and Streamable HTTP for network services.
- Implement the modern single-endpoint, POST-only Streamable HTTP contract.
- Mirror and validate MCP version, method, and name headers against the JSON-RPC body.
- Deliver request-scoped SSE and long-lived `subscriptions/listen` streams correctly.
- Migrate session-based and legacy HTTP+SSE deployments without presenting legacy behavior as modern.

## The Problem

Earlier Streamable HTTP revisions combined protocol negotiation with connection and session behavior. A server could mint `Mcp-Session-Id`, expose a standalone GET stream, accept DELETE for session termination, and resume SSE with `Last-Event-ID`.

MCP `2026-07-28` removes those mechanisms from the modern wire. Every request can land on any healthy worker because its protocol version and client capabilities travel in the request body. HTTP headers mirror selected fields for routing and policy, but the server validates those headers against the body before execution.

The result is easier to scale and easier to reason about. It also means that a server teaching the 2025 transport as current is teaching the wrong failure and security model.

## The Concept

### stdio

The stdio binding is for a client-launched subprocess:

- Client writes one UTF-8 JSON-RPC message per line to stdin.
- Server writes one UTF-8 JSON-RPC message per line to stdout.
- Server writes diagnostics to stderr.
- Server exits promptly on stdin EOF.
- Every modern request carries version and client capabilities in `params._meta`.

The process may live for many calls, but it is not a modern protocol session. If it exits unexpectedly, in-flight requests are lost. Restart the process, rediscover, relist, reopen subscriptions, and retry safe operations with new request ids.

### Streamable HTTP in 2026-07-28

A modern server exposes one MCP endpoint, such as `/mcp`, that accepts POST.

Every JSON-RPC request or notification is a new HTTP POST. The body contains one JSON-RPC message. Clients do not send JSON-RPC responses to the server.

For a request, the server returns either:

- `Content-Type: application/json` with one JSON-RPC response; or
- `Content-Type: text/event-stream` with notifications related to that request, followed by the final JSON-RPC response.

For an accepted notification, the server returns `202 Accepted` with no body.

Clients advertise both response types:

```http
Accept: application/json, text/event-stream
```

### POST-only means POST-only

Modern Streamable HTTP has no standalone GET stream and no DELETE session endpoint.

- `GET /mcp` returns `405 Method Not Allowed`.
- `DELETE /mcp` returns `405 Method Not Allowed`.
- `Mcp-Session-Id` is ignored and never minted or echoed.
- `Last-Event-ID` is ignored because modern streams are not resumable.

If a request-scoped stream breaks before its final response, the client has lost that in-flight request. It may issue a new request with a new JSON-RPC id when retry is safe. It must not attempt stream resumption.

### Origin validation

Servers validate `Origin` on incoming connections to prevent DNS rebinding. If the header is present and not explicitly allowed, return `403 Forbidden`. A non-browser client may omit `Origin`, which the official transport rules permit.

Local servers should bind to `127.0.0.1`, not every interface. Network services still need authentication and authorization on every request. Origin validation is not authentication.

Use exact origin matching after canonical configuration. Prefix checks such as `origin.startswith("https://trusted.example")` are unsafe because they can accept attacker-controlled suffixes.

### Required HTTP metadata headers

Every modern POST request includes:

```http
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: notes_search
```

Header rules:

- `MCP-Protocol-Version` is required and must equal `params._meta.io.modelcontextprotocol/protocolVersion`.
- `Mcp-Method` is required and must equal the JSON-RPC `method`.
- `Mcp-Name` is required for `tools/call`, `resources/read`, and `prompts/get`.
- `Mcp-Name` equals `params.name`, or `params.uri` for `resources/read`.
- Header values are case-sensitive even though header names are case-insensitive.

Unsafe or non-ASCII `Mcp-Name` values use the exact UTF-8 Base64 sentinel:

```text
=?base64?{Base64EncodedValue}?=
```

The server decodes that value before comparing it with the body.

Missing, malformed, or mismatched mirrored headers return HTTP `400` with JSON-RPC code `-32020`. If header and body agree on a version the server does not support, return HTTP `400` with `-32022` and exact error data such as `{"supported":["2026-07-28"],"requested":"2027-01-01"}`.

An unknown modern method returns HTTP `404` with JSON-RPC `-32601`. The JSON-RPC body is important because a dual-era client uses it to distinguish a modern error from a legacy endpoint miss.

### Request-scoped SSE

A server may choose SSE for one long-running request:

```text
POST tools/call id=41
  <- notifications/progress related to id=41
  <- notifications/progress related to id=41
  <- JSON-RPC response id=41
stream closes
```

The server must not send independent JSON-RPC requests on this stream. Sampling, elicitation, and roots interactions use Multi Round-Trip Request results. Closing the response stream cancels that request.

Do not add SSE event ids for replay. `Last-Event-ID` resumption is not part of the modern revision.

### Long-lived changes use subscriptions/listen

Change notifications use a client-opened request, not standalone GET:

```json
{
  "jsonrpc": "2.0",
  "id": "listen-1",
  "method": "subscriptions/listen",
  "params": {
    "notifications": {
      "toolsListChanged": true,
      "resourceSubscriptions": ["notes://note-1"]
    },
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": {
        "name": "course-client",
        "version": "1.0.0"
      }
    }
  }
}
```

The POST response is a long-lived SSE stream. Its first protocol message is `notifications/subscriptions/acknowledged`. The acknowledgement, every change notification, and the final result carry `io.modelcontextprotocol/subscriptionId` in `_meta`, equal to the listen request id. The server may emit SSE comments as keepalives. When the stream drops, the client reissues `subscriptions/listen` with a new request id and refetches affected data.

`resources/subscribe` and `resources/unsubscribe` belong to the legacy era. Do not use them on a modern connection.

### Explicit application state

Removing protocol sessions does not forbid workflows with state. The server may mint an opaque state handle and return it as a normal tool result. The client passes that handle as an explicit argument on later calls.

Bind handles to the authenticated principal, make them unguessable, expire them, and authorize every use. This makes state visible at the application layer instead of hiding it in transport affinity.

The failure caused by hidden replica state is mechanical:

1. Request A reaches replica 1 and creates a draft in that process's memory.
2. The response does not return a draft handle because the implementation assumes the connection identifies the draft.
3. Request B is a fresh POST and reaches replica 2.
4. Replica 2 has valid protocol metadata but no way to name or load the draft, so the workflow fails or reads the wrong local object.
5. Sticky routing appears to fix the symptom until a restart, rollout, reschedule, or failover moves the next request.

The correct boundary has two parts. Protocol context stays in each request. Durable application state lives in a shared store under a server-minted handle returned to the client. The next call supplies that handle, any replica loads the same record, and authorization binds the record to the authenticated principal and tenant. Replica memory may cache a record, but it cannot be the only copy required for correctness.

Choose the state mechanism by lifetime. Request-local variables can serve one call. A short MRTR continuation can use integrity-protected `requestState`. A draft or durable task needs an explicit handle plus shared persistence, expiry, concurrency control, and idempotency. None of those objects is an MCP protocol session.

### HTTP dual-era compatibility

A client that supports modern and legacy servers attempts a modern POST first. If it receives HTTP `400`, `404`, or `405`, it inspects the body:

- A recognized modern JSON-RPC error proves the server is modern. Correct the request or retry an advertised version. Do not downgrade.
- An empty body or an unrecognized response may indicate a legacy HTTP+SSE server. Only then try the old GET endpoint and expect its legacy `endpoint` event.

A server can support both eras during migration by routing modern metadata to the modern POST-only implementation and retaining separate legacy endpoints for old clients. Never describe the legacy GET, DELETE, session id, or replay behavior as part of `2026-07-28`.

```figure
tp-transport-handshake
```

## Use It

`code/main.py` implements a finite, modern Streamable HTTP server with the Python standard library. It validates Origin and mirrored headers, ignores removed session headers, returns JSON for normal calls, and demonstrates a finite `subscriptions/listen` SSE stream.

```bash
cd code
python3 main.py --probe
python3 -m unittest discover tests -v
```

The probe checks:

- invalid Origin is rejected;
- discovery succeeds without a session id;
- `Mcp-Session-Id` and `Last-Event-ID` are ignored;
- header mismatch returns `-32020`;
- unsupported version returns `-32022` with exact `supported` and `requested` data;
- an accepted id-less notification returns HTTP `202` with no body;
- GET and DELETE return `405`;
- `subscriptions/listen` is a POST response stream whose acknowledgement, notifications, and final result carry its subscription id.

## Ship It

This lesson ships `outputs/skill-mcp-transport-migrator.md`. It removes modern protocol sessions, adds header-body validation, replaces standalone GET with `subscriptions/listen`, and keeps any legacy bridge visibly separate.

## Exercises

1. Remove `Mcp-Method` from a POST. Confirm HTTP `400` and error `-32020`.
2. Send matching header and body version `2027-01-01`. Confirm HTTP `400`, error `-32022`, and exact data `{"supported":["2026-07-28"],"requested":"2027-01-01"}`.
3. Send a Base64 sentinel `Mcp-Name` for a non-ASCII resource URI. Confirm the decoded value is compared with `params.uri`.
4. Break the finite listen stream before its final response. Reissue it with a new JSON-RPC id and refetch tools.
5. Add an explicit workflow handle to the ping tool. Bind it to an authorization subject without using connection affinity.

## Key Terms

| Term | Meaning |
|------|---------|
| stdio | Newline-delimited JSON-RPC over a client-launched subprocess |
| Streamable HTTP | Single endpoint where each modern message is a new POST |
| Request-scoped SSE | POST response stream containing related notifications and final response |
| `subscriptions/listen` | Long-lived POST request for opted-in change notifications |
| Header mismatch | HTTP `400` and JSON-RPC `-32020` when mirrored headers disagree with body |
| Origin validation | DNS-rebinding defense for incoming connections, not authentication |
| Explicit state handle | Application token passed as an ordinary argument instead of hidden session state |
| Legacy bridge | Separate earlier-era behavior kept only for compatibility |

## Further Reading

- [MCP Transport Overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [MCP Subscriptions](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/subscriptions)
- [MCP 2026-07-28 Changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
