# Building an MCP Client: Discovery, Routing, and Dual-Era Fallback

> A modern MCP client repeats its contract on every request. Its hardest compatibility decision is knowing when an old server is truly old and when a modern server is reporting a correctable error.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 13, Lesson 07
**Time:** ~85 minutes

## Learning Objectives

- Build every MCP `2026-07-28` request with current metadata.
- Probe stdio servers with `server/discover` and select a mutually supported version.
- Authorize a bounded legacy probe only for explicitly allowlisted peers.
- Accept a legacy era only after validating a positive `initialize` result for a supported revision.
- Merge deterministic tool lists without silently overwriting collisions.
- Route calls to the peer that owns each tool without inventing protocol sessions.

## The Problem

An agent host usually talks to more than one MCP server. It must discover each server, merge tool catalogs, resolve duplicate names, route calls, and recover from transport failure.

The `2026-07-28` revision makes the steady state simpler because each request is self-contained. Compatibility makes startup more subtle. A client may encounter:

- a modern server that supports the preferred version;
- a modern server that returns a recognized version or header error;
- a legacy server that has never heard of `server/discover`;
- a legacy server that stays silent until it receives `initialize`.

Treating every probe error as legacy is dangerous. A malformed modern request, an overloaded server, a dead process, and an old server can all produce the same timeout or connection close. Those signals are ambiguous. The client must combine explicit operator intent with positive protocol evidence before it chooses the legacy era.

## The Concept

### A peer, not a protocol session

Keep one transport peer record for each server process or endpoint:

- transport handle or send function;
- selected protocol era and version;
- last discovered server capabilities;
- last deterministic tool list;
- pending request ids for correlation;
- transport health.

This is client bookkeeping. It is not protocol session state. On modern MCP, the server still receives current version and capabilities on every request.

### Build every modern request from scratch

```python
def modern_request(request_id, method, params, version, capabilities):
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "method": method,
        "params": {
            **params,
            "_meta": {
                "io.modelcontextprotocol/protocolVersion": version,
                "io.modelcontextprotocol/clientCapabilities": capabilities,
                "io.modelcontextprotocol/clientInfo": CLIENT_INFO,
            },
        },
    }
```

Do not attach metadata once to a connection object and assume it reached the wire. Stamp and inspect the final serialized request.

### Modern discovery

`server/discover` returns supported versions, server capabilities, instructions, cache hints, and recommended server identity. A client chooses the highest mutually supported modern version.

Discovery is optional for a modern-only client, but it is recommended on stdio. Some legacy servers accept an operation before initialization, so sending `tools/list` first can produce an ambiguous success. `server/discover` creates a clean era boundary.

### The stdio compatibility probe

A dual-era stdio client sends `server/discover` with its preferred modern metadata before any other request. There are three outcome classes:

1. **DiscoverResult.** The server is modern. Select a mutually supported version and continue with per-request metadata.
2. **Recognized modern error.** The server is modern. For `-32022`, choose from `data.supported` and retry with a new request id. For header or capability errors, correct the request. Do not send `initialize`.
3. **Ambiguous signal.** An unrecognized JSON-RPC error, timeout, connection close, or empty response does not identify an era. Fail closed unless that exact peer is configured for legacy compatibility.

Recognized modern protocol errors include:

- `-32020` HeaderMismatch
- `-32021` MissingRequiredClientCapability
- `-32022` UnsupportedProtocolVersion

Recognized modern errors remain modern even when the peer is on the legacy allowlist. Once a server proves that it understands the modern error vocabulary, sending `initialize` would be a downgrade.

Do not treat `-32601` as positive legacy evidence. It only makes an explicitly allowlisted peer eligible for one legacy probe. The same rule applies to a timeout, connection close, or empty response.

### Allowlisting is operator intent, not evidence

Legacy compatibility must be an explicit property of one pinned peer configuration:

```python
client.add_server("archive", archive_transport, allow_legacy=True)
```

Bind that choice to the configured command or endpoint. Do not use a wildcard that lets an arbitrary server opt itself into weaker semantics. A peer without `allow_legacy=True` fails after an ambiguous discovery outcome and never receives `initialize`.

The allowlist grants permission to probe. It does not select the era. The client sends one `initialize` under a transport-enforced deadline, then requires all of the following:

- a JSON-RPC `2.0` response with the matching request id;
- exactly one `result` and no `error`;
- a `protocolVersion` in the client's configured legacy revision set;
- an object-valued `capabilities` field;
- a `serverInfo` object with non-empty string `name` and `version` fields.

A timeout, connection close, error response, malformed result, mismatched id, or unsupported revision fails closed. Only a structurally valid positive result selects the legacy era. The code passes `legacy_probe_timeout_ms` to the transport adapter; a real stdio or HTTP adapter must enforce that deadline rather than merely record it.

Cache the selected era for the transport peer. Do not probe again before every call.

### Legacy is a compatibility branch

Once the bounded probe returns valid positive legacy evidence, the client uses the selected legacy version exactly as defined by that revision:

1. Verify the response envelope and correlation id.
2. Verify the negotiated revision is in the configured legacy set.
3. Record validated capabilities and server identity.
4. Send `notifications/initialized` only after all checks pass.
5. Use legacy request shapes for that transport lifetime.

This branch exists for interoperability with known peers. It is not the default design for new servers or new requests. If the transport restarts or its endpoint changes, discard the peer-era cache and negotiate again.

### Discovering and caching tools

For each active peer, call `tools/list`. A modern result includes `resultType`, `ttlMs`, and `cacheScope`. Honor the freshness hint within the correct authorization context. Re-fetch after expiry or a subscribed list-change event.

Clients must treat a missing `resultType` from a legacy server as `"complete"`. Do not require modern cache fields on a response from an earlier negotiated era.

The server should return deterministic ordering. The client should also sort before merging so local registry order does not depend on process startup timing.

### Collision-safe namespace merge

Two servers may both expose `search`. Choose a declared policy:

1. **Prefix on collision.** Keep the first canonical name and expose later collisions as `<server>/<tool>`.
2. **Reject on collision.** Do not load the duplicate and surface a clear configuration error.
3. **Silent overwrite.** Never use this. It hides which server receives a model-selected action.

Store both canonical and local names. The model sees the canonical name. The outgoing `tools/call` uses the local name the owning server declared.

### Routing a call

Routing is a pure lookup:

```text
canonical tool name
  -> peer name + local tool name
  -> new JSON-RPC request id
  -> modern request metadata or explicit legacy shape
  -> matching response id
```

Do not send a call when its owning transport is unavailable. Reconnect or restart the transport, then re-run discovery and `tools/list`. Modern in-flight requests lost on a broken transport can be retried with a new JSON-RPC id when the operation's safety policy permits it.

### Notifications and subscriptions

Modern list and resource changes arrive only on a client-opened `subscriptions/listen` stream. The client sends the notification filter, waits for `notifications/subscriptions/acknowledged`, and correlates events with the listen request id in notification metadata.

On disconnect, open a new listen request and refetch relevant lists or resources. Modern streams do not resume with `Last-Event-ID`.

### No server-initiated requests

Modern servers do not call the client with independent JSON-RPC requests for sampling, elicitation, or roots. They return `input_required`, and the client retries the original request after fulfilling the embedded input requests.

Do not block the peer's response reader while fulfilling input. Preserve correlation and create a new JSON-RPC id for the retry.

```figure
tp-client-merge
```

## Use It

`code/main.py` uses in-process peer functions so the protocol decisions stay visible. It connects to two modern peers and one intentionally allowlisted legacy peer, then merges and routes their tools. The transport callable receives a timeout budget so the compatibility branch cannot hide an unbounded probe.

```bash
cd code
python3 main.py
python3 -m unittest discover tests -v
```

The tests prove boundaries that normal demos miss:

- modern requests repeat metadata;
- `-32022` retries modern discovery without initialization;
- recognized modern errors never downgrade, even for an allowlisted peer;
- timeouts, connection closes, empty responses, and unrecognized errors do not trigger `initialize` without an allowlist;
- an allowlisted peer becomes legacy only after a valid, supported `initialize` result;
- malformed and unsupported legacy results leave the peer unavailable;
- a successfully selected era is cached for the transport lifetime.

## Ship It

This lesson ships `outputs/skill-mcp-client-harness.md`. It scaffolds modern request stamping, stdio era negotiation, deterministic namespace merge, routing, and a fail-closed legacy compatibility branch.

## Exercises

1. Make a fake server return `-32022` with no mutually supported version. Confirm the client fails instead of sending `initialize`.
2. Allowlist a fake legacy server, make its bounded `initialize` probe time out, and prove the peer stays `unknown` and unavailable.
3. Add `cacheScope: "private"` tool lists for two authorization contexts. Confirm the client never shares one context's cached result with the other.
4. Change the collision policy to rejection and make startup fail with both peer names in the error.
5. Add a finite `subscriptions/listen` simulator. On stream loss, re-listen with a new request id and refetch tools.

## Key Terms

| Term | Meaning |
|------|---------|
| Peer | Client-side record for one server transport and its discovered data |
| Protocol era | Modern per-request metadata or legacy initialization semantics |
| Discovery probe | Initial `server/discover` used to identify the stdio era |
| Recognized modern error | Error that proves modern behavior and forbids legacy fallback |
| Legacy allowlist | Operator configuration permitting one bounded compatibility probe for a pinned peer |
| Positive legacy evidence | Valid, correlated `initialize` result for an explicitly supported legacy revision |
| Merged namespace | Canonical tool names across all active peers |
| Collision policy | Prefix or reject rule for duplicate tool names |
| Era cache | Selected modern or legacy behavior stored for one transport peer |
| Transport recovery | Restart or reconnect, rediscover, relist, and retry safely with a new id |

## Further Reading

- [MCP Specification 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/)
- [MCP Server Discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)
- [MCP stdio Transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio)
- [MCP Versioning](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [MCP Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
