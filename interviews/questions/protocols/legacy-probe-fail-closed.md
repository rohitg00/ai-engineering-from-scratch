---
id: legacy-probe-fail-closed
title: When an old server is really old
card: protocols
kind: design
level: 3
roles: [agentic-ai-engineer, forward-deployed-ai-engineer]
rounds: [system-design, design-review]
tags: [mcp, client, stdio, legacy, discovery, fail-closed]
minutes: 12
lessons: [phases/13-tools-and-protocols/08-building-an-mcp-client]
manuals: []
practice: []
cheatsheet: [mcp-client-transports]
related: [protocols/stateless-request-metadata, protocols/post-only-streamable-http]
updated: 2026-11-03
---

Your agent host launches several MCP servers over stdio. One is current. One is an old archive server that understands only `initialize`. One is current but slow to start. A teammate proposes a simple rule: send `server/discover`, and on any error or timeout send `initialize`. Design the startup so that the slow server is never downgraded and the archive server still works.

## Short answer

Treat an ambiguous signal as ambiguous. A timeout, a connection close, an empty response or an unrecognized error does not identify an era, so the client fails closed unless that exact peer is configured with `allow_legacy=True`. A recognized modern error such as `-32022` proves the server is current and forbids `initialize`. For the archive peer on the allowlist, send one `initialize` under a transport-enforced deadline and select the legacy era only after a structurally valid positive result.

## Full answer

### Three outcome classes for the probe

| Outcome of `server/discover` | Meaning | Next step |
|---|---|---|
| a `DiscoverResult` | current server | pick the highest mutually supported version and continue with per-request metadata |
| a recognized modern error | current server | correct the request or retry an advertised version; never send `initialize` |
| an ambiguous signal | unknown | fail closed, unless this pinned peer allows one bounded legacy probe |

Recognized modern errors are `-32020` HeaderMismatch, `-32021` MissingRequiredClientCapability and `-32022` UnsupportedProtocolVersion. They remain modern even when the peer is on the legacy allowlist, because a server that speaks the modern error vocabulary would be downgraded by `initialize`.

`-32601` is not positive legacy evidence. It only makes an explicitly allowlisted peer eligible for one probe, and so does a timeout, a connection close or an empty response.

### The allowlist is intent, not evidence

```python
client.add_server("archive", archive_transport, allow_legacy=True)
```

Bind the choice to the configured command or endpoint. A wildcard would let an arbitrary server opt itself into weaker semantics. A peer without the flag fails after an ambiguous outcome and never receives `initialize`.

### Positive legacy evidence

The one `initialize` runs under `legacy_probe_timeout_ms`, which a real adapter must enforce. The client then requires all of:

- a JSON-RPC `2.0` response with the matching request id;
- exactly one `result` and no `error`;
- a `protocolVersion` in the client's configured legacy revision set;
- an object-valued `capabilities`;
- a `serverInfo` object with non-empty string `name` and `version`.

Anything else leaves the peer `unknown` and unavailable. Only after all checks pass does the client send `notifications/initialized` and use legacy request shapes for that transport lifetime.

### After the era is chosen

Cache the era per transport peer and do not probe before every call. When the transport restarts or the endpoint changes, discard the cache and negotiate again. Then call `tools/list`, sort the result before merging, and apply a declared collision policy: prefix later duplicates as `<server>/<tool>` or reject the duplicate with both peer names in the error. Never overwrite silently.

### Why the slow server survives

Its first probe times out, which is an ambiguous signal. It is not allowlisted, so the client marks it unavailable instead of sending `initialize`. A later retry of `server/discover` succeeds and the peer joins as a current server with the correct era.

## Follow-ups

- **Level 3:** The allowlisted archive peer answers `-32022` to discovery. Which era? Expected: current; a recognized modern error forbids the legacy probe, so choose from `data.supported` and retry with a new request id.
- **Level 3:** The `initialize` probe times out. What state is the peer in? Expected: `unknown` and unavailable; no era is selected and `notifications/initialized` is never sent.
- **Level 4:** A legacy server accepts `tools/list` before initialization. Why does that make discovery-first safer on stdio? Expected: the ambiguous success would hide the era; `server/discover` creates a clean era boundary before any operation.
- **Level 4:** The archive process crashes and restarts. Do you reuse the cached legacy era? Expected: no; discard the peer-era cache, rediscover, relist, reopen subscriptions, and retry only safe operations with new ids.

## Wrong answers

- "Any error from discovery means the server is old." A malformed request, an overloaded server, a dead process and an old server can all produce the same timeout or close.
- "Send `initialize` first; a current server will reject it." Sending `initialize` to a current server is a downgrade and must never be the default path.
- "A method-not-found error proves the server is legacy." It only makes an allowlisted peer eligible for one bounded probe; the positive evidence is a valid `initialize` result.

## Taught in

The [client lesson](../../../phases/13-tools-and-protocols/08-building-an-mcp-client/) defines the probe outcomes, the allowlist and the positive evidence checklist.
