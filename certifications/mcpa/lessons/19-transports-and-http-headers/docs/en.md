# Transports and the HTTP Header Contract

> A transport does not change what a message means, only how it travels: stdio hands a JSON-RPC line to a subprocess, and Streamable HTTP posts one message at a time while mirroring a few of its fields into headers a gateway can read without touching the body.

**Type:** Reference
**Languages:** Python
**Prerequisites:** Lesson 18
**Time:** ~45 minutes

## Learning Objectives

- Frame and parse newline-delimited JSON-RPC messages the way the stdio transport requires, and explain why an embedded newline breaks that framing
- Describe the Streamable HTTP request and response shapes: one POST per message, a JSON object or a per-request SSE stream, `202 Accepted` for an accepted notification, and no GET endpoint
- Build and validate the required HTTP headers, `MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name`, and mirror a tool argument through `x-mcp-header` with the base64 sentinel encoding
- Explain why Origin validation and localhost binding defend against DNS rebinding, and what a modern server returns for GET, DELETE, and a disallowed Origin
- Tell a `HeaderMismatch` (`-32020`) protocol error apart from the plain HTTP status codes a transport returns for outcomes that never become a JSON-RPC message

## The Problem

Every MCP message already carries everything it needs to be understood: a method, parameters, and per-request metadata in `_meta`. Nothing about that content depends on how the bytes travel between a client and a server. But something still has to carry those bytes, frame one message off from the next, tell a client when a connection has died, and let a load balancer or a gateway route traffic without becoming a JSON-RPC parser itself. That is the job of a transport, and MCP 2026-07-28 defines exactly two standard ones: stdio for a client-launched subprocess, and Streamable HTTP for a network service reachable by any number of clients.

A curriculum that teaches transports as an afterthought leaves a gap the exam is built to find. The stateless core from lesson 04 only works end to end if the binding underneath it never smuggles in state of its own, a session id, a resumable stream, a server that remembers the last request on a connection. Every rule in this lesson exists to keep that promise: a transport frames and delivers messages, and nothing more.

## The Concept

### stdio: a subprocess sharing three streams

In the stdio binding, the client launches the server as a child process and the two sides share its standard streams. The server reads JSON-RPC requests and notifications from `stdin` and writes responses and notifications to `stdout`, one message per line, with no embedded newlines. `stdout` carries only valid MCP messages; the server never writes a JSON-RPC request there, because MRTR (lesson 14) replaced every server-initiated request with an `input_required` result. `stderr` is free for logs of any severity, and a client must not assume that anything appearing there is an error.

There is no header layer on stdio. Every piece of metadata that Streamable HTTP mirrors into a header still exists, but it only ever appears inline in `params._meta`, exactly as it does on any other transport. To cancel an in-flight request the client sends `notifications/cancelled` naming the request's id, since there is no per-request stream to simply close. Shutdown is cooperative: the client closes `stdin`, waits, and escalates to a process signal only if the server does not exit. If the server exits unexpectedly, the client restarts it, loses any requests that were in flight, and re-sends `subscriptions/listen` for any subscription it still wants, because the protocol is stateless and a fresh process is exactly as capable as the one that died.

### Streamable HTTP: one endpoint, one message per POST

A Streamable HTTP server exposes a single MCP endpoint, for example `/mcp`, that accepts POST and nothing else at the protocol level. Every JSON-RPC request or notification is its own POST, and the client's `Accept` header lists both `application/json` and `text/event-stream`, because the server may answer a request with one JSON object or with an SSE stream scoped to that single request, carrying progress or log notifications before the final response. A notification POST that the server accepts gets back `202 Accepted` with no body; there is no JSON-RPC reply to a notification because a notification never has one.

There is no GET endpoint, no session, and no resumability in this revision. A modern server answers GET or DELETE on the MCP endpoint with `405 Method Not Allowed`. It never mints or reads a session header, and a broken SSE stream is not something the client reconnects to with a replay id; it simply loses that request and, if the retry is safe, reissues it with a new JSON-RPC id. When a server opens a long-lived stream, it is expected to send `X-Accel-Buffering: no` so a reverse proxy does not buffer the events, and to emit an occasional SSE comment line as a keep-alive so idle timeouts do not close the connection during quiet periods.

Origin validation exists for one reason: an MCP server bound to `127.0.0.1` is still reachable from a malicious web page through DNS rebinding unless the server checks who is asking. If the `Origin` header is present and not one the server allows, it answers `403 Forbidden`. A client with no `Origin` at all, such as a non-browser HTTP client, is not automatically suspicious. None of this is authentication; a server still needs its own bearer-token check on top of Origin validation.

### The header mirror and its contract

Streamable HTTP mirrors a handful of body fields into headers so that a gateway or load balancer can route MCP traffic without parsing JSON. Every POST carries `MCP-Protocol-Version`, which must equal `params._meta["io.modelcontextprotocol/protocolVersion"]`. Every request carries `Mcp-Method`, equal to the JSON-RPC `method`. A `tools/call`, `resources/read`, or `prompts/get` request also carries `Mcp-Name`, equal to `params.name` or, for a resource read, `params.uri`. A server that finds any of these disagreeing with the body, or missing, rejects the request with HTTP `400` and a JSON-RPC error whose code is `-32020`, `HeaderMismatch`. This is not a suggestion: different network components can disagree about which value is true, a gateway routing on the header while the server executes on the body, and that gap is exactly what an attacker would try to open.

A tool can go further and ask a client to mirror one of its own arguments into a header, using `x-mcp-header` in that property's schema. A parameter marked `"x-mcp-header": "Region"` becomes the header `Mcp-Param-Region`, carrying the same value the body's `arguments.region` holds. Header values must be visible ASCII, so a value that is not, non-ASCII characters, control characters, leading or trailing whitespace, or a value that happens to already look like the sentinel, is base64-encoded as `=?base64?{value}?=` before it goes on the wire, and a server decodes that sentinel before comparing it against the body. Header names are case-insensitive; header values, including method and tool names, are case-sensitive. Mirroring has limits of its own: it applies only to integer, string, and boolean parameters statically reachable from the schema root, never to `number`; a client on Streamable HTTP must exclude a tool whose `x-mcp-header` values break those constraints from its `tools/list` result rather than call it; and server developers should not mark sensitive parameters such as API keys or tokens, because header values are visible to every proxy, load balancer, and log along the way.

Custom transports that run over a reliable byte stream reuse the stdio framing rather than inventing a new one, since stdio is already just newline-delimited JSON-RPC over a stream. The older HTTP+SSE transport from 2024-11-05 is Deprecated: new servers should not adopt it, and existing ones migrate to Streamable HTTP.

```http
POST /mcp HTTP/1.1
Content-Type: application/json
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: run_report
Mcp-Param-Region: us-west1

{"jsonrpc": "2.0", "id": 7, "method": "tools/call", "params": {"name": "run_report", "arguments": {"region": "us-west1", "dataset": "signups"}, "_meta": {"io.modelcontextprotocol/protocolVersion": "2026-07-28", "io.modelcontextprotocol/clientCapabilities": {}}}}
```

```json
{"jsonrpc": "2.0", "id": 7, "error": {"code": -32020, "message": "Header mismatch: Mcp-Method", "data": {"headers": ["Mcp-Method"]}}}
```

```figure
mcpa-19-transports
```

## Interactive Lab

The figure sets stdio and Streamable HTTP side by side. On the left, a client and a server exchange lines over `stdin`, `stdout`, and a dashed `stderr`, with no header layer at all: every field lives in `_meta`. On the right, a client posts to one endpoint and the server posts back a response; the arrow carries a small checkpoint where the server compares the mirrored headers against the body, and a mismatch turns into `400` plus `-32020` rather than reaching the tool. Trace one call through both paths and notice that the JSON-RPC body barely changes: only the envelope around it does.

## Practice Lab

Open `code/main.py`. It builds one server with a `run_report` tool whose `region` argument is marked `x-mcp-header: Region`, then drives the same call three ways. `call_stdio` sends the request straight to the server, the way a subprocess would see it, with framing available through `frame_message` and `parse_frames`. `call_http` builds the mirrored headers with `build_http_headers`, validates them with `handle_http_request`, and only then dispatches to the server, logging both the request and the response wrapped as `{"http": {...}, "message": {...}}`. `call_http_with_header_mismatch` takes the same request, changes only its `Mcp-Method` header to `prompts/get`, and shows the resulting `400` plus `-32020`; that entry is wrapped with `"violation"` so the transcript checker skips validating its intentionally wrong headers and instead checks the error response that follows it.

```bash
python3 code/main.py
```

Outcomes that never become a JSON-RPC message, a `405` for GET or DELETE, a `403` for a disallowed Origin, and a `202` with no body for an accepted notification, are not in the transcript at all, because there is no `result` or `error` object to represent them; they live in `handle_http_get_or_delete`, `validate_origin`, and `handle_http_notification`, and in the tests that exercise each one directly. Try changing the `region` argument to a value with a comma or a non-ASCII character and rerun; watch `encode_header_value` switch to the base64 sentinel, and confirm `decode_header_value` reverses it exactly.

## Shipped Artifact

`outputs/transport-selection-guide.md` is a one-page reference: when to reach for stdio versus Streamable HTTP, the exact header table with its source field and required-for column, the base64 sentinel rule, and a status-code decision list for GET, DELETE, a bad Origin, a header mismatch, and an accepted notification.

## Verify It

Run the tests from the lesson directory:

```bash
python3 -m unittest discover code/tests
```

They check the claims in this lesson: a stdio frame round trips through `parse_frames`, a pretty-printed message with embedded newlines is rejected, the mirrored headers for a `tools/call` match the body exactly including the `x-mcp-header` parameter, the base64 sentinel encoding matches the specification's own worked examples and decodes back to the original value, `Mcp-Name` is sourced from `params.uri` for `resources/read` and omitted for a method with no name field, matching headers pass validation while a changed `Mcp-Method` header comes back as `400` with `-32020`, a disallowed Origin is `403` while an allowed one and a missing one are not, GET and DELETE are both `405`, an accepted notification is `202`, and the transcript's deliberate mismatch example is wrapped as a violation immediately followed by the real error response. The repository's wire checker also validates the lesson's transcript against the 2026-07-28 rules:

```bash
python3 scripts/check_mcpa_wire.py certifications/mcpa/lessons/19-transports-and-http-headers
```

## Capstone Connection

The capstone's end-to-end exchange has to travel over some transport, and every header it carries has to satisfy the same body-is-truth rule this lesson builds: mirrored fields exist for routing, never as a second source of authority. When the capstone scenario validates a request at the wire level, it is running the same header-versus-body comparison you implemented here, and when it argues why a broken stream cannot simply resume, it is leaning on the same statelessness this lesson's stdio restart and HTTP reissue both depend on.

## Key Terms

| Term | Meaning |
|------|---------|
| stdio | The transport binding a client uses to launch and talk to a server as a subprocess |
| Streamable HTTP | The transport binding where every JSON-RPC message is its own POST to one MCP endpoint |
| Frame | One newline-delimited JSON-RPC message on stdio, never containing an embedded newline |
| `MCP-Protocol-Version` | The required header that must equal the request's `_meta` protocol version |
| `Mcp-Method` | The required header mirroring the JSON-RPC `method` of the request |
| `Mcp-Name` | The header mirroring `params.name` or `params.uri` for `tools/call`, `resources/read`, and `prompts/get` |
| `x-mcp-header` | A tool schema annotation that mirrors one argument into an `Mcp-Param-{Name}` header |
| Base64 sentinel | The `=?base64?{value}?=` encoding used when a header value is not safely plain ASCII |
| `HeaderMismatch` | The `-32020` error a server returns, with HTTP `400`, when a mirrored header disagrees with the body |
| Origin validation | The check that rejects a disallowed `Origin` header with `403` to defend against DNS rebinding |

## Further Reading

- [Transports overview](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports)
- [stdio transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http)
- [Tool definitions: x-mcp-header](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#x-mcp-header)
- `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 9
- `phases/13-tools-and-protocols/09-mcp-transports`, which works through the same POST-only contract in more depth
