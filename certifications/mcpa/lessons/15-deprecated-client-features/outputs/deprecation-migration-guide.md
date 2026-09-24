# Deprecated Client Feature Migration Guide

A one-page reference for the MCPA "Interactions and Execution" domain, aligned to MCP 2026-07-28.

## What Deprecated means

- Active: fully specified, required by the current revision.
- Deprecated: still fully specified and fully functional, with a documented migration path, and a minimum twelve month window (measured from the deprecating revision's release) before it is even eligible for removal.
- Removed: deleted from the draft specification, absent from the next Current revision.
- Earliest removal is the first revision released as Current on or after the window elapses. The actual removal date is a separate Core Maintainer decision and can land later.

## The three client-facing features deprecated by SEP-2577

| Feature | What it did | Migration path | Earliest removal |
|---|---|---|---|
| Roots | Let a client hand a server directory hints as informational guidance | Pass directories or files via tool parameters, resource URIs, or server configuration | First revision on or after 2027-07-28 |
| Sampling | Let a server ask the client to run an LLM generation on its behalf | Integrate directly with an LLM provider API | First revision on or after 2027-07-28 |
| Logging | Let a server send structured log notifications to a client | Log to stderr on stdio transports, or use OpenTelemetry for observability | First revision on or after 2027-07-28 |

## Also on the deprecated registry

| Feature | Deprecated in | Migration path | Earliest removal |
|---|---|---|---|
| Dynamic Client Registration | 2026-07-28 | Client ID Metadata Documents | First revision on or after 2027-07-28 |
| `includeContext: "thisServer" / "allServers"` | 2025-11-25 | Omit the field, or send `"none"` (the default) | Follows Sampling |
| HTTP+SSE transport | 2025-03-26 | Streamable HTTP | Three months after SEP-2596 reaches Final |

## Still valid, still on the wire today (do not wrap these as legacy)

- `roots/list` as an MRTR `inputRequests` entry, gated by the client declaring the `roots` capability.
- `sampling/createMessage` as an MRTR `inputRequests` entry, gated by the client declaring the `sampling` capability.
- A per-request `io.modelcontextprotocol/logLevel` key in `_meta`, answered by `notifications/message` on that request's own response stream, at or above the requested level, only while that request is in flight.

## Actually removed by 2026-07-28 (a different, shorter list)

- `initialize` and `notifications/initialized`
- `Mcp-Session-Id` and the Streamable HTTP GET and DELETE session endpoints
- `resources/subscribe` and `resources/unsubscribe` (use `subscriptions/listen`)
- `ping`
- `logging/setLevel` (the connection wide log level setter; no session left to hold a level)
- `notifications/roots/list_changed`
- `Last-Event-ID` and SSE resumability
- Any server-initiated request outside MRTR
- `tasks/result` and `tasks/list` (tasks moved to the `io.modelcontextprotocol/tasks` extension)
- `notifications/elicitation/complete` and the URL-mode `elicitationId` field
- Error codes `-32002` and `-32042`

## Remember for the exam

- Deprecated is not removed. A feature can be both fully functional today and scheduled for removal later.
- `roots/list`, `sampling/createMessage`, and a per-request `logLevel` all pass a 2026-07-28 wire checker unwrapped.
- `logging/setLevel` and `notifications/roots/list_changed` do not exist in 2026-07-28 at all.
- A distractor naming an exact removal date (rather than "the first revision on or after") is describing the window wrong.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, sections 11 and 15.
