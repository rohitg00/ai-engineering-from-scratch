---
name: mcp-server-designer
description: Design a stateless MCP 2026-07-28 server with explicit discovery, state, transport, and safety contracts.
version: 2.0.0
phase: 11
lesson: 14
tags: [llm-engineering, mcp, stateless, tool-use]
---

Given a domain (internal API, database, file source) and the hosts that will mount the server, output:

1. Primitive map. Which capabilities become `tools` (action), which become `resources` (read-only data), which become `prompts` (user-invoked templates). One line per primitive.
2. Discovery contract. Draft `server/discover` with the exact versions the implementation supports, capabilities, server identity, instructions, `ttlMs`, and `cacheScope`.
3. Request contract. Require a string protocol version and object client capabilities in `params._meta` on every request. Recommend client identity. Return Invalid Params (`-32602`) for missing or ill-typed required metadata. Return `UnsupportedProtocolVersionError` (`-32022`) with `data.supported` and `data.requested` only for a supplied version string the server does not implement.
4. Result contract. Add `resultType`, server identity metadata, deterministic list ordering, and cache policy to every applicable result.
5. MRTR plan. Use `input_required` only for `tools/call`, `resources/read`, or `prompts/get`. Include at least one of `inputRequests` or opaque `requestState`; retry the original method with a new JSON-RPC ID, corresponding input responses when requested, and the exact state value when present.
6. State plan. For every multi-call workflow, define a server-minted opaque handle passed as an ordinary tool argument. Do not hide state behind a connection or protocol session.
7. Transport and auth plan. Choose stdio or the 2026-07-28 Streamable HTTP POST endpoint. For HTTP, define Origin validation and per-request authorization. Require `MCP-Protocol-Version` on POST requests, `Mcp-Method` on JSON-RPC requests, and `Mcp-Name` only for `tools/call`, `resources/read`, and `prompts/get`. An accepted notification POST returns HTTP 202 with no body.
8. Schema draft. Write JSON Schema for every tool parameter, with descriptions tuned for model selection and explicit bounds for untrusted input.
9. Destructive-action list. Mark every mutating tool with `destructiveHint: true` and require human approval.
10. Verification plan. Cover notifications producing no JSON-RPC response, malformed envelopes and request IDs, metadata rejection, discovery, deterministic lists, version mismatch, cache fields, header-to-body mismatch, authorization, approval, and one prompt-injection case.

Reject a design that uses `initialize`, `notifications/initialized`, `Mcp-Session-Id`, standalone HTTP GET, HTTP DELETE, or `Last-Event-ID` as its modern path. Permit those mechanisms only inside a clearly isolated adapter for protocol versions through 2025-11-25. Do not add deprecated Roots, Sampling, or Logging to a new implementation; compatibility support must be labeled and Roots or Sampling input must use MRTR. Refuse a server that writes to disk or calls an external API without authorization, validation, and an approval path.
