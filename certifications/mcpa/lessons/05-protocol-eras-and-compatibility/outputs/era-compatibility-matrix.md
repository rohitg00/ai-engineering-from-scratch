# Protocol Era Compatibility Matrix

A one-page reference for the MCPA "MCP Fundamentals" domain, aligned to MCP 2026-07-28.

## Revision timeline

| Revision | Era | Headline change |
|---|---|---|
| 2024-11-05 | Legacy | First public revision: stdio and HTTP+SSE transports, plus the legacy handshake that opened every connection. |
| 2025-03-26 | Legacy | Streamable HTTP replaces HTTP+SSE; OAuth 2.1 authorization; tool annotations; audio content. |
| 2025-06-18 | Legacy | Structured tool output; resource links; elicitation; OAuth resource server classification; MCP-Protocol-Version header; JSON-RPC batching removed. |
| 2025-11-25 | Legacy | Icons; incremental scope consent; tool name guidance; URL mode elicitation; experimental tasks; validation errors become tool execution errors. |
| 2026-07-28 | Modern | Stateless core, no more handshake or sessions; adds server/discover, Multi Round-Trip Requests, resultType, and subscriptions/listen; moves tasks to an extension; deprecates roots, sampling, logging, and Dynamic Client Registration. |

## Terms

- **Modern**: 2026-07-28 and later. Version, identity, and capabilities travel as per-request metadata.
- **Legacy**: 2025-11-25 and earlier. A connection opens with a handshake that creates a session.
- **Dual-era**: an implementation that supports both, with an explicit era decision before parsing.

## The stdio probe

Send `server/discover` before any other request, carrying the client's preferred version in `_meta`:

1. A `DiscoverResult` comes back: the server is modern. Use a version from `supportedVersions`.
2. A recognized modern error comes back (for example `UnsupportedProtocolVersionError`, code -32022): the server is modern but wants a different version. Retry with one of `data.supported`. Do not fall back.
3. Any other error, or no answer within a reasonable timeout: the server is legacy. Fall back to the legacy handshake.

Never key the fallback to one specific error code: an unrecognized error and a timeout both mean the same thing.

## The HTTP probe

Attempt a modern request first. On `400 Bad Request`, read the body before deciding:

- A recognized modern JSON-RPC error in the body: the server is modern. Retry or correct the request; do not fall back.
- An empty body, or a body that is not a recognized modern error: the server is legacy. Fall back to the legacy handshake, and possibly further to the deprecated HTTP+SSE transport.

## Compatibility matrix

| Client | Server | Outcome |
|---|---|---|
| Modern | Modern | Works. server/discover is optional; a version mismatch surfaces as UnsupportedProtocolVersionError and the client retries with a mutually supported version. |
| Modern | Legacy | Fails. The legacy server has no per-request metadata to read; a dual-era probe would have caught this before the request that mattered. |
| Dual-era | Modern | Works. The probe returns a DiscoverResult or a recognized modern error, so the client stays modern. |
| Dual-era | Legacy | Works. The probe returns an unrecognized error or times out, so the client falls back to the legacy handshake. |
| Legacy | Modern | Fails. The legacy client's opening request is a method the modern server does not implement, and it lacks the metadata a modern server requires. |
| Legacy | Dual-era | Works. The server answers the legacy handshake and serves that client under the negotiated legacy revision. |
| Legacy | Legacy | Works, entirely under the legacy revision's own rules. |

## Remember for the exam

- There is no handshake and no session in 2026-07-28; every request is self-describing.
- The era decision is a property of the server, cached per process (stdio) or origin (HTTP), and may be re-probed if it later fails.
- A modern-only server should still name its supported versions in any error it returns to a legacy connection attempt, since a legacy-only client has no other way to learn what would work.
- A recognized modern error never triggers a legacy fallback. Only an unrecognized error or a timeout does.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 1 and 6.
