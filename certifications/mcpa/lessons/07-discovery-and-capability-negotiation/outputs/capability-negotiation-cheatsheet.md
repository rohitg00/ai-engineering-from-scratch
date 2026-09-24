# Capability Negotiation Cheatsheet

A one-page reference for the MCPA "Architecture and Components" domain, aligned to MCP 2026-07-28.

## server/discover at a glance

| Field | Where | Meaning |
|-------|-------|---------|
| `supportedVersions` | result | Protocol versions the server accepts; pick one for later requests |
| `capabilities` | result | A `ServerCapabilities` object: what the server offers |
| `instructions` | result, optional | Natural-language guidance for the model, not a copy of tool descriptions |
| `io.modelcontextprotocol/serverInfo` | `result._meta` | Self-reported name and version, for display and logs only |
| `ttlMs` | result | Freshness hint in milliseconds; `DiscoverResult` is a `CacheableResult` |
| `cacheScope` | result | `public` or `private`; never an access control by itself |

Implementing it: mandatory for every server. Calling it: optional for a client, which may send any request directly and handle a version error if one comes back.

## ServerCapabilities and ClientCapabilities side by side

| ServerCapabilities key | Meaning | ClientCapabilities key | Meaning |
|---|---|---|---|
| `tools {listChanged}` | offers tools, may notify on change | `elicitation {form, url}` | can answer form or URL mode elicitation |
| `resources {listChanged, subscribe}` | offers resources, may notify or accept subscriptions | `sampling` (deprecated) | can serve LLM completions back to the server |
| `prompts {listChanged}` | offers prompt templates | `roots` (deprecated) | can list root directories |
| `completions {}` | offers argument completion | `extensions {}` | supports named client-side extensions |
| `logging {}` (deprecated) | can emit log notifications | | |
| `extensions {}` | supports named server-side extensions | | |

An empty object means supported with nothing extra to configure. A missing key means the primitive or feature is not offered at all.

## The negotiation rule

`DiscoverResult.capabilities` describes the server, once, cacheably. It says nothing about what any one client request can accept. `_meta["io.modelcontextprotocol/clientCapabilities"]` describes the client, and it must be present, correct, and current on every single request, because a server must never infer it from a prior call, even on the same connection.

## MissingRequiredClientCapabilityError (-32021)

- Returned when handling a request needs a capability its own `clientCapabilities` did not declare.
- `data.requiredCapabilities` is shaped like `ClientCapabilities`, naming exactly what was missing.
- HTTP status: `400 Bad Request`.
- Fix: retry the same request with the capability declared in that request's own `_meta`, not a different one.

## UnsupportedProtocolVersionError (-32022)

- Returned when a request names a protocol version the server does not implement.
- `data.supported` lists the versions the server accepts; `data.requested` echoes what was asked for.
- HTTP status: `400 Bad Request`.
- Fix: retry with a new request id, using a version taken from `data.supported`.
- A modern-only server should name its supported versions even when rejecting a legacy `initialize` request, since legacy clients cannot fall forward on their own.

## Retry checklist

1. Read the error's `data`, never guess a version or capability to retry with.
2. Issue a brand new JSON-RPC id for the retry; do not reuse the failed request's id.
3. Change only what the error asked for; keep the rest of the request the same.
4. Do not cache a `-32021` or `-32022` response as if it were a normal result.
5. Do not assume a later request inherits anything declared on an earlier one.

## Remember for the exam

- `server/discover` is mandatory to implement, optional to call.
- Unknown tool is `-32602`; unknown method is `-32601`; missing capability is `-32021`; unsupported version is `-32022`.
- `serverInfo` and `clientInfo` are self-reported, for display and logging, never for security decisions.
- Requesting an older, real protocol version through the modern `_meta` shape is not the same as being a legacy client; a legacy client sends `initialize` instead.

Source: `certifications/mcpa/research/mcp-2026-07-28-brief.md`, section 6.
