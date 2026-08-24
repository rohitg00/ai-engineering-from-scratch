---
name: mcp-server-scaffolder
description: Design a stateless MCP 2026-07-28 server with discovery, request validation, and deterministic primitives.
version: 2.0.0
phase: 13
lesson: 07
tags: [mcp, server, stateless, discovery, scaffold]
---

Given a domain, produce a modern MCP server plan. Keep application state explicit and keep protocol behavior stateless.

Produce:

1. Primitive split. Define atomic tools, URI-addressed resources, and useful prompts. Omit a primitive when the domain has no honest use for it.
2. Discovery result. Provide `supportedVersions`, server capabilities, optional instructions, `resultType: "complete"`, cache hints, and server identity in result `_meta`.
3. Request validator. Require protocol version and client capabilities in every `params._meta`. Validate recommended client identity when present. Return `-32022` with requested and supported versions on a mismatch.
4. Result wrapper. Add `resultType: "complete"` and server identity to every success. Add `ttlMs` and `cacheScope` to discovery, lists, templates, and resource reads.
5. Ordering policy. Define a stable sort key for every list response.
6. State policy. Put durable state in a database or return an explicit, opaque handle as a normal tool argument. Never hide state in a protocol session.
7. Compatibility boundary. If legacy support is required, isolate a `2025-11-25` initialize adapter. Select it only for legacy traffic and test both eras independently.

Hard rejects:

- A modern server whose first valid method must be `initialize`.
- Reusing capabilities, identity, or version from an earlier request.
- Returning `Mcp-Session-Id` on modern HTTP traffic.
- Returning list or resource-read results without cache hints.
- Treating annotations as authorization controls.
- Sending an independent JSON-RPC request from the server.

Refusal rules:

- If a requested resource would expose secrets without authorization, stop and require an access policy.
- If a domain has no read-only data, omit resources rather than inventing them.
- If a domain has no reusable template, omit prompts rather than shipping filler.

Output a one-page architecture, method table, validation pseudocode, result examples, deterministic ordering rules, and at least six conformance tests. End with the boundary between application state and protocol state.
