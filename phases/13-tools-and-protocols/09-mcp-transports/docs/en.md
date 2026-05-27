# MCP Transports — stdio vs Streamable HTTP vs SSE Migration

> stdio works locally and nowhere else. Streamable HTTP (2025-03-26) is the remote standard. The old HTTP+SSE transport is deprecated and being removed in mid-2026. Picking the wrong transport costs a migration; picking the right one buys a remote-hostable MCP server with session continuity and DNS-rebinding protection.

**Type:** Learn
**Languages:** Python (stdlib, Streamable HTTP endpoint skeleton)
**Prerequisites:** Phase 13 · 07, 08 (MCP server and client)
**Time:** ~45 minutes

## Learning Objectives

- Pick between stdio and Streamable HTTP based on deployment shape (local vs remote, single-process vs fleet).
- Implement the Streamable HTTP single-endpoint pattern: POST for requests, GET for session stream.
- Enforce `Origin` validation and session-id semantics to defeat DNS-rebinding.
- Migrate a legacy HTTP+SSE server to Streamable HTTP before the mid-2026 removal deadlines.

## The Problem

The first MCP remote transport (2024-11) was HTTP+SSE: two endpoints, one for the client's POSTs and one Server-Sent-Events channel for the server-to-client stream. It worked. It was also clumsy: two endpoints per session, broken caches in front of some CDNs, and a hard dependency on long-lived SSE connections that some WAFs terminate aggressively.

The 2025-03-26 spec replaced it with Streamable HTTP: one endpoint, POST for client requests, GET for establishing a session stream, both sharing a `Mcp-Session-Id` header. Every server built or migrated since then uses Streamable HTTP. The old SSE mode is being deprecated — Atlassian Rovo removed it June 30, 2026; Keboola April 1, 2026; most remaining enterprise servers by end of 2026.

And stdio still matters for local servers. Claude Desktop, VS Code, and every IDE-shaped client spawn servers via stdio. The right mental model: stdio for "this machine", Streamable HTTP for "over the network". No cross-over.

## The Concept

### stdio

- Child-process transport. Client spawns server, communicates via stdin/stdout.
- One JSON object per line. Newline-delimited.
- No session id; process identity is the session.
- No auth needed (the child inherits the parent's trust boundary).
- Never use for remote servers — you would need SSH or socat to tunnel, at which point use Streamable HTTP.

### Streamable HTTP

Single endpoint `/mcp` (or any path). Supports three HTTP methods:

- **POST /mcp.** Client sends a JSON-RPC message. Server replies with either a single JSON response, or an SSE stream of one-or-more responses (useful for batched responses and notifications related to that request).
- **GET /mcp.** Client opens a long-lived SSE channel. Server uses it for server-to-client requests (sampling, notifications, elicitation).
- **DELETE /mcp.** Client explicitly terminates the session.

Sessions are identified by the `Mcp-Session-Id` header the server sets on the first response and the client echoes on every subsequent request. Session ids MUST be cryptographically random (128+ bits); client-chosen ids are rejected for safety.

### Single endpoint vs two

Two-endpoint mode from the old spec is still callable in 2026 — the spec declares it "legacy compatible". But all new servers should be single-endpoint. The official SDKs emit single-endpoint; use the legacy mode only when talking to an unmigrated remote.

### `Origin` validation and DNS-rebinding

Browsers are not MCP clients (today), but an attacker can craft a webpage that convinces a browser to POST to `localhost:1234/mcp` — where the user's local MCP server listens. If the server does not check `Origin`, the browser's same-origin policy will not save it because `Origin: http://evil.com` is valid cross-origin.

The 2025-11-25 spec requires servers to reject requests whose `Origin` is not on an allowlist. The allowlist typically contains the MCP client host (`https://claude.ai`, `vscode-webview://*`) and localhost variants for local UIs.

### Session id lifecycle

1. Client sends first request without `Mcp-Session-Id`.
2. Server assigns a random id, sets `Mcp-Session-Id` on the response header.
3. Client echoes that header on all subsequent requests and on `GET /mcp` for the stream.
4. Session can be revoked by the server; client sees 404 on subsequent requests and must re-initialize.
5. Client can explicitly DELETE the session for clean shutdown.

### Keepalive and reconnect

SSE connections drop. The client re-establishes by re-GETing with the same `Mcp-Session-Id`. Server MUST queue events missed during the outage (up to a reasonable window) and replay via the `last-event-id` header the client echoes.

Phase 13 · 13 covers Tasks, which let long-running work survive even a full-session reconnect.

### Backwards compatibility probe

A client that wants to support both old and new servers:

1. POST to `/mcp`.
2. If response is `200 OK` with JSON or SSE, this is Streamable HTTP.
3. If response is `200 OK` with `Content-Type: text/event-stream` AND a `Location` header pointing to a secondary endpoint, this is legacy HTTP+SSE; follow the `Location`.

### Cloudflare, ngrok, and hosting

Production remote MCP servers in 2026 run on Cloudflare Workers (with their MCP Agents SDK), Vercel Functions, or containerized Node/Python. Key: your hosting must support long-lived HTTP connections for the SSE GET. Vercel's free tier caps at 10 seconds and is unsuitable. Cloudflare Workers support indefinite streams.

### Gateway composition

When you front multiple MCP servers with a gateway (Phase 13 · 17), the gateway is a single Streamable HTTP endpoint that rewrites session ids and multiplexes upstream. Tools are merged at the gateway layer; the client sees a single logical server.

### Transport failure modes

- **stdio SIGPIPE.** Child process death mid-write raises SIGPIPE; servers should exit cleanly. Clients should detect EOF and mark the session dead.
- **HTTP 502 / 504.** Cloudflare, nginx, and other proxies emit these on upstream failure. Streamable HTTP clients should retry once after a short backoff.
- **SSE connection drop.** TCP RST, proxy timeout, or client network change closes the stream. Client reconnects with `Mcp-Session-Id` and optional `last-event-id` to resume.
- **Session revocation.** Server invalidates a session id; client sees 404 on next request. Client must re-handshake.
- **Clock skew.** Resource-TTL calculations on the client diverge from the server. Client should treat server timestamps as authoritative.

### When to bypass Streamable HTTP

Some enterprises deploy MCP servers behind gRPC or message-queue transports inside their own networks. This is non-standard — MCP's spec does not formally define these. Gateways can expose a Streamable HTTP surface to MCP clients while using gRPC internally. Keep the external surface spec-compliant; the gateway owns the translation.

## Use It

`code/main.py` implements a minimal Streamable HTTP endpoint using `http.server` (stdlib). It handles POST, GET, and DELETE on `/mcp`, sets `Mcp-Session-Id` on first response, validates `Origin`, and rejects requests from non-allowlisted origins. The handler reuses the Lesson 07 notes server's dispatch logic.

What to look at:

- The POST handler reads the JSON-RPC body, dispatches, and writes a JSON response (the single-response variant; SSE variant is structurally similar).
- The `Origin` check rejects the default `http://evil.example` probe but accepts `http://localhost`.
- Session ids are random 128-bit hex strings; the server keeps per-session state in memory.

## Ship It

This lesson produces `outputs/skill-mcp-transport-migrator.md`. Given an HTTP+SSE (legacy) MCP server, the skill produces a migration plan to Streamable HTTP with session-id continuity, Origin checks, and backwards-compatible probe support.

## Exercises

1. Run `code/main.py`. POST an `initialize` from `curl` and observe the `Mcp-Session-Id` response header. POST a second request echoing the header and verify session continuity.

2. Add a GET handler that opens an SSE stream. Send one `notifications/progress` event every five seconds. Reconnect by re-GETing with the same session id and confirm the server accepts it.

3. Implement the `last-event-id` replay logic. On reconnect, replay any events generated since that id.

4. Extend `Origin` validation to support a wildcard pattern (`https://*.example.com`) and confirm it accepts `https://app.example.com` but rejects `https://evil.example.com.attacker.net`.

5. Take a legacy HTTP+SSE server from the official registry (there are several) and sketch the migration: what changes in endpoint handling, session id generation, and header semantics.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| stdio transport | "Local child process" | JSON-RPC over stdin/stdout, newline-delimited |
| Streamable HTTP | "The remote transport" | Single-endpoint POST + GET + optional SSE, 2025-03-26 spec |
| HTTP+SSE | "Legacy" | Two-endpoint model being removed in mid-2026 |
| `Mcp-Session-Id` | "Session header" | Server-assigned random id echoed on every subsequent request |
| `Origin` allowlist | "DNS-rebinding defense" | Reject requests whose Origin is not approved |
| Single endpoint | "One URL" | `/mcp` handles POST / GET / DELETE for all session operations |
| `last-event-id` | "SSE replay" | Header used to resume a dropped stream without missing events |
| Backwards-compat probe | "Old vs new detection" | Client response-shape check that auto-selects transport |
| Long-lived HTTP | "SSE streaming" | Server pushes events for minutes or hours on one TCP connection |
| Session revocation | "Force re-init" | Server invalidates a session id; client must handshake again |

## Further Reading

- [MCP — Basic transports spec 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) — canonical reference for stdio and Streamable HTTP
- [MCP — Basic transports spec 2025-03-26](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — the revision that introduced Streamable HTTP
- [Cloudflare — MCP transport](https://developers.cloudflare.com/agents/model-context-protocol/transport/) — Workers-hosted Streamable HTTP patterns
- [AWS — MCP transport mechanisms](https://builder.aws.com/content/35A0IphCeLvYzly9Sw40G1dVNzc/mcp-transport-mechanisms-stdio-vs-streamable-http) — comparison across deployment shapes
- [Atlassian — HTTP+SSE deprecation notice](https://community.atlassian.com/forums/Atlassian-Remote-MCP-Server/HTTP-SSE-Deprecation-Notice/ba-p/3205484) — concrete migration deadline example
