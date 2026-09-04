---
name: sampling-loop-designer
description: Migrate model-assisted MCP tools to direct inference or stateless 2026-07-28 MRTR with bounded compatibility sampling.
version: 2.0.0
phase: 13
lesson: 11
tags: [mcp, mrtr, sampling, stateless, migration]
---

Design model-assisted behavior for an MCP server targeting protocol revision `2026-07-28`.

Start with one decision: can the server integrate directly with a model provider? Sampling is deprecated for new designs. Prefer direct integration unless using the client's model and credentials is an explicit product requirement.

Produce:

1. Architecture decision. Choose direct inference or compatibility Sampling and state why.
2. Discovery contract. Show `server/discover` with exact `supportedVersions`, advertised capabilities, `ttlMs`, and `cacheScope`. If tools are advertised, include mandatory deterministic `tools/list` descriptors with valid object `inputSchema`, `resultType: "complete"`, server identity metadata, and cache hints.
3. Request envelope. Include protocol version and client capabilities in `_meta` on every request. Use `-32602` for a missing or non-string version, `-32022` with exact `supported` and `requested` data for an unsupported version, and `-32021` with a `requiredCapabilities` object when Sampling is absent. Treat client identity metadata as informational only. Never emit a JSON-RPC response for an id-less notification; an accepted HTTP notification receives `202` with no body.
4. Round table. For each MRTR round, name the `inputRequests` key, embedded request method, expected response schema, validation, and budget.
5. Retry contract. Require the original method and arguments, a fresh JSON-RPC id, current-round `inputResponses`, and byte-exact `requestState`.
6. State protection. Bind HMAC or authenticated encryption to the authenticated principal, method, argument digest, phase, and short expiry.
7. Safety policy. Define approval, maximum rounds, token and byte limits, response validation, logging, and refusal behavior.
8. Removal plan. If Sampling remains, name the condition and date for replacing it with direct integration.

Hard rejects:

- A new design that adopts deprecated Sampling without a documented requirement.
- A 2026-07-28 server that sends `sampling/createMessage` as a live server-to-client request.
- Any use of `initialize`, `notifications/initialized`, `Mcp-Session-Id`, or hidden protocol-session state.
- Unsigned `requestState` that affects authorization, resource access, or business logic.
- A retry that reuses the original JSON-RPC id or changes the original arguments.
- A client model loop without capability checks, approval policy, validation, and a hard round limit.
- `includeContext: "allServers"` or implicit cross-server context.

Refusal rules:

- Refuse covert model calls or any design that hides the server's intent from the user.
- Refuse model output as proof of identity, authorization, or user consent.
- Refuse a multi-round design when one deterministic tool call is sufficient.
- Refuse to call client and server metadata an authenticated identity.

Output a one-page architecture with the decision, wire flow, round table, signed state contents, safety budget, failure cases, and migration plan. End with a verdict: `direct inference`, `temporary MRTR compatibility`, or `no model required`.
